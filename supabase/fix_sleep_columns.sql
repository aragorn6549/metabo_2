-- ============================================================
-- MetaBo · миграция: колонки границ сна в entries
-- Ошибка в проде: POST /rest/v1/entries → 400
--   code PGRST204: "Could not find the 'sleep_end' column of 'entries' in the schema cache"
-- Причина: ActivityLogger сохраняет сон с полями sleep_start/sleep_end
-- (src/features/activities/ActivityLogger.jsx, src/store/useMetaboStore.js → entryPayload),
-- а в таблице public.entries этих колонок нет.
-- Выполнить ЦЕЛИКОМ в Supabase Dashboard → SQL Editor → Run (идемпотентно).
-- После выполнения достаточно перезагрузить страницу — PostgREST сам обновит кэш схемы.
--
-- ВАЖНО: скрипт работает даже если таблицы entries ещё нет (например, база создана
-- из старой версии schema.sql или SQL Editor подключился не к той базе).
-- В этом случае таблица будет создана заново (пустой) со всеми нужными колонками.
-- Если данные в entries уже были и вы видите эту ошибку — проверьте, что в SQL Editor
-- выбрана правильная база/схема, и вместо этого скрипта выполните supabase/schema.sql.
--
-- Требуется расширение pgcrypto (gen_random_uuid()) — как в schema.sql. Supabase
-- включает его по умолчанию; на всякий случай создаём здесь же.
-- ============================================================

create extension if not exists "pgcrypto";

do $$
begin
  if to_regclass('public.entries') is null then
    raise notice 'Таблица public.entries не найдена — создаём её со всеми колонками';

    create table public.entries (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      type text not null check (type in ('food','workout','sleep','other')),
      subtype text,
      name text,
      occurred_at timestamptz not null default now(),
      calories numeric, protein numeric, fat numeric, carbs numeric,   -- food
      duration_min numeric,                                            -- workout/other
      sleep_hours numeric,                                             -- sleep
      sleep_quality int check (sleep_quality between 1 and 5),         -- sleep
      created_at timestamptz not null default now()
    );
    create index entries_user_time_idx on public.entries (user_id, occurred_at);
  end if;
end $$;

alter table public.entries
  add column if not exists sleep_start text,   -- «заснул», локальное ISO 'YYYY-MM-DDTHH:MM'
  add column if not exists sleep_end   text;   -- «проснулся», локальное ISO 'YYYY-MM-DDTHH:MM'

-- RLS-политики (только если таблица была создана этим скриптом, а не schema.sql).
-- Идемпотентно: drop+create, безопасны повторить поверх существующей схемы.
alter table public.entries enable row level security;

drop policy if exists entries_select on public.entries;
drop policy if exists entries_insert on public.entries;
drop policy if exists entries_update on public.entries;
drop policy if exists entries_delete on public.entries;

create policy entries_select on public.entries for select using (auth.uid() = user_id);
create policy entries_insert on public.entries for insert with check (auth.uid() = user_id);
create policy entries_update on public.entries for update using (auth.uid() = user_id);
create policy entries_delete on public.entries for delete using (auth.uid() = user_id);

-- Принудительно обновить кэш схемы PostgREST (не обязательно — он обновляется автоматически)
notify pgrst, 'reload schema';
