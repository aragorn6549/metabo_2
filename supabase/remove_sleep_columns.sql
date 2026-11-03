-- ============================================================
-- MetaBo · миграция: убрать зависимость entries от колонок границ сна
-- Ошибка в проде: POST /rest/v1/entries → 400
--   code PGRST204: "Could not find the 'sleep_end' column of 'entries' in the schema cache"
--
-- РЕШЕНИЕ: приложение больше НЕ отправляет sleep_start/sleep_end — сон хранится
-- как раньше: sleep_hours + sleep_quality, а occurred_at = момент пробуждения.
-- Поэтому колонки границ не нужны вообще.
--
-- Выполнить ЦЕЛИКОМ в Supabase Dashboard → SQL Editor → Run (идемпотентно):
--  - если таблицы entries нет — она создаётся заново (актуально для пустой/новой базы);
--  - если колонки sleep_start/sleep_end когда-то были добавлены — удаляются;
--  - пересоздаются RLS-политики (безопасно, идентичны schema.sql).
-- После выполнения достаточно перезагрузить страницу приложения.
-- ============================================================

create extension if not exists "pgcrypto";

-- Таблица записей журнала (если ещё не существует)
create table if not exists public.entries (
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
create index if not exists entries_user_time_idx on public.entries (user_id, occurred_at);

-- Убираем колонки границ сна, если они были добавлены прежним скриптом fix_sleep_columns.sql
alter table public.entries
  drop column if exists sleep_start,
  drop column if exists sleep_end;

-- RLS-политики (идемпотентно: drop+create, идентичны schema.sql)
alter table public.entries enable row level security;

drop policy if exists entries_select on public.entries;
drop policy if exists entries_insert on public.entries;
drop policy if exists entries_update on public.entries;
drop policy if exists entries_delete on public.entries;

create policy entries_select on public.entries for select using (auth.uid() = user_id);
create policy entries_insert on public.entries for insert with check (auth.uid() = user_id);
create policy entries_update on public.entries for update using (auth.uid() = user_id);
create policy entries_delete on public.entries for delete using (auth.uid() = user_id);

-- Принудительно обновить кэш схемы PostgREST
notify pgrst, 'reload schema';
