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
