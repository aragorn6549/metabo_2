// Serverless-эндпоинт админки: отправка письма «Сброс пароля» от имени сервиса.
// Требует env SUPABASE_SERVICE_ROLE_KEY (только на сервере! в клиент бандл не попадает).
// Авторизация: вызывающий обязан быть админом — проверяется дважды:
//   1) токеном через getUser + запрос к admin_roles;
//   2) повторным вызовом RPC admin_send_password_reset ключом anon (RLS/is_admin внутри функции).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    return res.status(501).json({ error: 'Сервер сброса не настроен: добавьте SUPABASE_SERVICE_ROLE_KEY в переменные окружения хостинга.' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Нет токена' });

  let email = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    email = String(body?.email || '').trim().toLowerCase();
  } catch { /* ниже проверка email */ }
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Некорректный email' });

  const { createClient } = await import('@supabase/supabase-js');

  // 1) Проверяем, что токен принадлежит админу
  const userClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await userClient.auth.setSession({ access_token: token, refresh_token: '' });
  const { data: ud } = await userClient.auth.getUser();
  if (!ud?.user) return res.status(401).json({ error: 'Сессия недействительна' });
  const { data: roleRow, error: roleErr } = await userClient
    .from('admin_roles').select('user_id').eq('user_id', ud.user.id).eq('role', 'admin').maybeSingle();
  if (roleErr || !roleRow) return res.status(403).json({ error: 'Требуется роль администратора' });

  // 2) Двойная защита: тот же RPC в БД ещё раз проверяет is_admin(auth.uid())
  const rpcRes = await fetch(`${url}/rest/v1/rpc/admin_send_password_reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email }),
  });
  if (!rpcRes.ok) return res.status(403).json({ error: 'RPC отклонил запрос (не админ)' });

  // 3) Сам сброс — сервисным ключом (письмо со ссылкой восстановления)
  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const redirectTo = `${req.headers.origin || 'https://metabo.vercel.app'}/#/auth?mode=recovery`;
  const { error } = await adminClient.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true, email });
}
