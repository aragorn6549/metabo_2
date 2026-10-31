-- ============================================================
-- MetaBo · Админка (роль admin, удаление пользователей, сброс пароля)
-- Выполнить ЦЕЛИКОМ в Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Таблица ролей
create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);
alter table public.admin_roles enable row level security;
drop policy if exists admin_roles_select on public.admin_roles;
create policy admin_roles_select on public.admin_roles
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- 2. Функция проверки админа — ДВА канала: таблица admin_roles И метаданные пользователя
create or replace function public.is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_roles ar where ar.user_id = uid and ar.role = 'admin')
     or exists (select 1 from auth.users u where u.id = uid
                and (u.raw_app_meta_data->>'role' = 'admin'
                     or u.raw_user_meta_data->>'role' = 'admin'));
$$;

-- 3. RPC: список пользователей для админки (только для админов)
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

-- 4. RPC: удаление пользователя вместе со всей историей (каскад по FK)
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

-- 5. RPC: заглушка сброса пароля (реальный сброс делает /api/admin-reset service-ключом)
create or replace function public.admin_send_password_reset(email text)
returns text
language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden: требуется роль администратора' using errcode = '42501';
  end if;
  return 'ok';
end; $$;

grant execute on function public.is_admin(uuid)                      to authenticated;
grant execute on function public.admin_list_users()                  to authenticated;
grant execute on function public.admin_delete_user(uuid)             to authenticated;
grant execute on function public.admin_send_password_reset(text)     to authenticated;

-- Назначить админа через таблицу:
insert into public.admin_roles (user_id)
select id from auth.users where email = 'admin@admin.ru'
on conflict (user_id) do nothing;

-- Или назначить админа через метаданные (работает даже без таблицы):
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where email = 'admin@admin.ru';
-- ВАЖНО: после изменения метаданных выйти и войти заново (роль зашита в JWT).
-- ============================================================
