# metabo_2
metabolism calculator

## Админка (доп. ТЗ)

Возможности:
1. **Удаление пользователей вместе с историей** — вкладка «🛡 Админка» (видна только админам).
   Удаление идёт через RPC `admin_delete_user` (каскад по FK в БД: журнал, замеры, цели, блюда, профиль).
2. **Восстановление пароля** — на экране входа ссылка «Забыли пароль?»: письмо со ссылкой
   (`supabase.auth.resetPasswordForEmail`), по ссылке открывается форма задания нового пароля.
3. **Смена пароля** — кнопка «🔑 Пароль» в шапке (desktop) и «🔑 Сменить пароль» в профиле (mobile);
   в админке есть «📩 Сброс пароля» для любого пользователя (шлёт ему письмо-ссылку).

### Установка
1. Supabase Dashboard → SQL Editor → выполнить целиком `supabase/schema.sql`, затем `supabase/admin.sql`.
   - Если база уже создана по старой схеме — дополнительно выполнить `supabase/fix_sleep_columns.sql`
     (добавляет колонки `sleep_start`/`sleep_end` в `entries`; без них сохранение активности «Сон»
     падает с 400 PGRST204 "Could not find the 'sleep_end' column of 'entries'").
2. Создать администратора **admin@admin / admin123**:
   - зарегистрироваться в приложении с этим email/паролем (или Dashboard → Authentication → Add user, Auto Confirm = ON);
   - в SQL Editor выполнить из конца `supabase/admin.sql`:
     `insert into public.admin_roles (user_id) select id from auth.users where email = 'admin@admin';`
3. Для кнопки «Сброс пароля» в админке добавить в переменные окружения Vercel (только сервер!):
   `SUPABASE_SERVICE_ROLE_KEY` (Dashboard → Settings → API → service_role). Без неё кнопка
   вернёт понятную ошибку, а пользователи смогут восстановить пароль сами со страницы входа.
4. В Supabase Dashboard → Authentication → URL Configuration добавить Site URL / Redirect URLs
   вашего домена (форма входа сама шлёт redirectTo `<origin>/#/auth?mode=recovery`).
