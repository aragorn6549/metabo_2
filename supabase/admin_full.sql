-- ============================================================
-- MetaBo · Админка — ПОЛНЫЙ скрипт (однократное выполнение)
-- Роль admin, RPC для админки, агрегаты дашборда, назначение админа.
-- Выполнить ЦЕЛИКОМ в Supabase Dashboard → SQL Editor → Run
-- Скрипт идемпотентен: можно запускать повторно.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Зависимые таблицы (если проект новый и schema.sql ещё не выполнялся).
--    Если schema.sql уже выполнен — эти блоки ничего не меняют.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  occurred_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.inbody_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- null = глобальное блюдо справочника
  name text not null,
  kcal numeric, protein numeric, fat numeric, carbs numeric,
  per100 boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 1. Таблица ролей администраторов
-- ------------------------------------------------------------
create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);
alter table public.admin_roles enable row level security;
drop policy if exists admin_roles_select on public.admin_roles;
create policy admin_roles_select on public.admin_roles
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- ------------------------------------------------------------
-- 2. Функция проверки админа — ДВА канала: таблица admin_roles И метаданные пользователя
-- ------------------------------------------------------------
create or replace function public.is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_roles ar where ar.user_id = uid and ar.role = 'admin')
     or exists (select 1 from auth.users u where u.id = uid
                and (u.raw_app_meta_data->>'role' = 'admin'
                     or u.raw_user_meta_data->>'role' = 'admin'));
$$;

-- ------------------------------------------------------------
-- 3. RPC: список пользователей для админки (только для админов)
-- ------------------------------------------------------------
create or replace function public.admin_list_users()
returns table (
  id uuid, email text, name text,
  created_at timestamptz, last_activity timestamptz,
  entries_count bigint, inbody_count bigint, is_admin boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden: требуется роль администратора' using errcode = '42501';
  end if;
  return query
    select
      u.id, u.email::text, p.name, u.created_at,
      (select max(e.occurred_at) from public.entries e where e.user_id = u.id) as last_activity,
      (select count(*) from public.entries e where e.user_id = u.id) as entries_count,
      (select count(*) from public.inbody_logs l where l.user_id = u.id) as inbody_count,
      public.is_admin(u.id) as is_admin
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end; $$;

-- ------------------------------------------------------------
-- 4. RPC: удаление пользователя вместе со всей историей (каскад по FK)
-- ------------------------------------------------------------
create or replace function public.admin_delete_user(target uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden: требуется роль администратора' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'Нельзя удалить самого себя';
  end if;
  delete from public.admin_roles where user_id = target;
  delete from auth.users where id = target;
end; $$;

-- ------------------------------------------------------------
-- 5. RPC: заглушка сброса пароля (реальный сброс делает /api/admin-reset service-ключом).
--    Используется как «второй фактор»: эндпоинт вызывает её токеном клиента,
--    и функция в БД ещё раз проверяет is_admin(auth.uid()).
-- ------------------------------------------------------------
create or replace function public.admin_send_password_reset(email text)
returns text
language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden: требуется роль администратора' using errcode = '42501';
  end if;
  return 'ok';
end; $$;

-- ------------------------------------------------------------
-- 6. RPC: агрегаты для дашборда админки (AdminPage.jsx) — всего по БД, только для админа
-- ------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden: требуется роль администратора' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'entries_count', (select count(*) from public.entries),
    'inbody_count',  (select count(*) from public.inbody_logs),
    'dishes_count',  (select count(*) from public.dishes),
    'profiles_count',(select count(*) from public.profiles),
    'by_type', (
      select coalesce(jsonb_object_agg(t.cnt_type, t.n), '{}'::jsonb)
      from (
        select case when e.type in ('food','workout','sleep') then e.type else 'other' end as cnt_type,
               count(*) as n
        from public.entries e group by 1
      ) t
    ),
    'active_7d', (
      select count(distinct e.user_id) from public.entries e
      where e.occurred_at > now() - interval '7 days'
    )
  ) into result;
  return result;
end; $$;

-- ------------------------------------------------------------
-- 7. Права на исполнение (только для залогиненных; внутри функций проверка is_admin)
-- ------------------------------------------------------------
grant execute on function public.is_admin(uuid)                      to authenticated;
grant execute on function public.admin_list_users()                  to authenticated;
grant execute on function public.admin_delete_user(uuid)             to authenticated;
grant execute on function public.admin_send_password_reset(text)     to authenticated;
grant execute on function public.admin_dashboard_stats()             to authenticated;

-- ------------------------------------------------------------
-- 8. Назначение администратора (admin@admin) — оба канала сразу
-- ------------------------------------------------------------
-- 8.1 Через таблицу ролей:
insert into public.admin_roles (user_id)
select id from auth.users where email = 'admin@admin'
on conflict (user_id) do nothing;

-- 8.2 Через метаданные (работает даже без таблицы, роль попадает в JWT):
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where email = 'admin@admin';

-- ВАЖНО: после изменения метаданных выйти и войти заново (роль зашита в JWT).

-- ============================================================
-- Проверка выполнения (запустите отдельно, если хотите убедиться):
--   select public.is_admin(id) from auth.users where email = 'admin@admin';  -- должно быть true
--   select public.admin_dashboard_stats();                                      -- из сессии админа
-- ============================================================
