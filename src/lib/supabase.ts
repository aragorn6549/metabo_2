import { createClient } from '@supabase/supabase-js';

// DECISION: фикс «дашборд появляется на мгновение и исчезает после логина».
// Приложение использует только вход по email+паролю (PKCE-редиректов нет), поэтому:
//  1) flowType: 'implicit' — клиент не ждёт ?code=... в URL и не пытается обменять несуществующий код;
//  2) detectSessionInUrl включаем только если в URL реально есть редирект-параметры
//     (#access_token / code= / error_code) — иначе на Vercel (rewrites без /api/rewrite-redirect)
//     init вызывал exchangeCode → ошибку → TOKEN_REFRESHED/signedOut и мгновенный выброс на экран логина.
const hasAuthInUrl = typeof window !== 'undefined' &&
  (window.location.search.includes('code=') ||
   window.location.hash.includes('access_token') ||
   window.location.hash.includes('error_code'));

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'implicit',
      detectSessionInUrl: hasAuthInUrl,
    },
  }
);
