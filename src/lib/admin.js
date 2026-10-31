import { supabase } from '@/lib/supabase';

// DECISION: роль администратора хранится в таблице public.admin_roles (supabase/admin.sql).
// Клиент проверяет её однократно на вход пользователя (без кэша между сессиями) —
// сами опасные операции (список/удаление) на сервере продублированы проверкой is_admin() внутри RPC,
// поэтому обход клиентской проверки не даёт прав.
let adminCheckCache = { uid: null, isAdmin: false };

export async function fetchIsAdmin(userId) {
  if (!userId) return false;
  if (adminCheckCache.uid === userId) return adminCheckCache.isAdmin;
  const { data, error } = await supabase
    .from('admin_roles')
    .select('user_id, role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  // RLS может молча вернуть пустую строку вместо ошибки — это просто «не админ»
  const isAdmin = !error && !!data;
  adminCheckCache = { uid: userId, isAdmin };
  return isAdmin;
}

export function invalidateAdminCache() {
  adminCheckCache = { uid: null, isAdmin: false };
}

export async function adminListUsers() {
  const { data, error } = await supabase.rpc('admin_list_users');
  if (error) throw new Error(error.message || 'Не удалось получить список пользователей');
  return data || [];
}

export async function adminDeleteUser(targetUserId) {
  const { error } = await supabase.rpc('admin_delete_user', { target: targetUserId });
  if (error) throw new Error(error.message || 'Не удалось удалить пользователя');
}

// Админ-сброс пароля: генерирует письмо Supabase со ссылкой восстановления на указанный email.
// Работает только если на хостинге настроен edge-эндпоинт /api/admin-reset с SUPABASE_SERVICE_ROLE_KEY
// (см. README «Админка»). Иначе бросает понятную ошибку — пользователь всегда может сам
// воспользоваться формой «Забыли пароль?» на экране входа.
export async function adminSendPasswordReset(email) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Нет активной сессии');
  let res;
  try {
    res = await fetch('/api/admin-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email }),
    });
  } catch {
    throw new Error('Сервер сброса недоступен (/api/admin-reset не настроен). Пусть пользователь нажмёт «Забыли пароль?» на экране входа.');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Не удалось отправить сброс пароля');
  return json;
}


-- ============================================================
-- MetaBo · Админка (роль admin, удаление пользователей, сброс пароля)
-- Выполнить ЦЕЛИКОМ в Supabase Dashboard → SQL Editor → Run
-- После выполнения — создать администратора:
--   1) Зарегистрироваться в приложении как admin@admin.ru (пароль admin123), ЛИБО
--      создать пользователя через Dashboard → Authentication → Add user
--   2) Выполнить внизу этого файла блок «Создание администратора»
-- ============================================================

-- 1. Таблица ролей (отдельно от profiles, чтобы не светить права в клиентских селектах)
create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);
alter table public.admin_roles enable row level security;
drop policy if exists admin_roles_select on public.admin_roles;
-- читать свою роль может только сам пользователь; список всех админов — только админам (через RPC)
create policy admin_roles_select on public.admin_roles
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- 2. Функция проверки админа (security definer — чтобы политика на admin_roles сама себя не блокировала)
create or replace function public.is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_roles ar where ar.user_id = uid and ar.role = 'admin');
$$;

-- 3. RPC: список пользователей для админки (email + профиль + объём данных). Только для админов.
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  name text,
  created_at timestamptz,
  last_activity timestamptz,
  entries_count bigint,
  inbody_count bigint,
  is_admin boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden: требуется роль администратора' using errcode = '42501';
  end if;
  return query
    select
      u.id,
      u.email::text,
      p.name,
      u.created_at,
      (select max(e.occurred_at) from public.entries e where e.user_id = u.id) as last_activity,
      (select count(*) from public.entries e where e.user_id = u.id) as entries_count,
      (select count(*) from public.inbody_logs l where l.user_id = u.id) as inbody_count,
      public.is_admin(u.id) as is_admin
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end; $$;

-- 4. RPC: удаление пользователя ВМЕСТЕ со всей его историей.
--    Все таблицы схемы ссылаются на auth.users с on delete cascade,
--    поэтому DELETE из auth.users каскадно снимает profiles/entries/dishes/goals/inbody_logs/history.
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

-- 5. RPC: генерация ссылки восстановления пароля (кнопка в админке).
--    Требует на хосте env SUPABASE_SERVICE_ROLE_KEY (см. vercel.json / README).
--    Без него вернёт понятную ошибку — пользователь при этом всё равно может
--    самостоятельно воспользоваться формой «Забыли пароль?» на экране входа.
create or replace function public.admin_send_password_reset(email text)
returns text
language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden: требуется роль администратора' using errcode = '42501';
  end if;
  return 'error: админ-сброс недоступен без серверного ключа (SUPABASE_SERVICE_ROLE_KEY). Пользователь может использовать «Забыли пароль?» на экране входа.';
end; $$;

-- 6. Триггер: авто-очистка строк auth.users, удалённых напрямую из Dashboard (обход каскада не нужен,
--    но страховка от осиротевших profiles/admin_roles при ручных операциях).
--    ON DELETE CASCADE уже покрывает основной путь; триггер не создаётся, чтобы не дублировать логику.

-- ============================================================
-- Создание администратора admin@admin.ru / admin123
-- Вариант А (рекомендуемый): зарегистрируйтесь в приложении с этим email/паролем,
-- затем выполните:
grant execute on function public.is_admin(uuid)                      to authenticated;
grant execute on function public.admin_list_users()                  to authenticated;
grant execute on function public.admin_delete_user(uuid)             to authenticated;
grant execute on function public.admin_send_password_reset(text)     to authenticated;

insert into public.admin_roles (user_id)
select id from auth.users where email = 'admin@admin.ru'
on conflict (user_id) do nothing;

-- Вариант Б (если регистрация выключена / email-подтверждение мешает):
-- создайте пользователя в Dashboard → Authentication → Users → Add user
-- (email admin@admin.ru, password admin123, "Auto Confirm User" = ON),
-- затем повторно выполните INSERT выше.
-- ============================================================



export function isAdminFromMetadata(user) {
  if (!user) return false;
  return user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin';
}

export async function fetchIsAdmin(userId, user = null) {
  if (!userId) return false;
  // Быстрый путь: роль в метаданных токена — работает даже без выполненной миграции admin.sql
  if (isAdminFromMetadata(user)) {
    adminCheckCache = { uid: userId, isAdmin: true };
    return true;
  }
  if (adminCheckCache.uid === userId) return adminCheckCache.isAdmin;
  const { data, error } = await supabase
    .from('admin_roles').select('user_id, role')
    .eq('user_id', userId).eq('role', 'admin').maybeSingle();
  const isAdmin = !error && !!data;
  adminCheckCache = { uid: userId, isAdmin };
  return isAdmin;
}
