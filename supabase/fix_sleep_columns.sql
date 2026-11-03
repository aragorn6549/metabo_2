-- ============================================================
-- MetaBo · миграция: колонки границ сна в entries
-- Ошибка в проде: POST /rest/v1/entries → 400
--   code PGRST204: "Could not find the 'sleep_end' column of 'entries' in the schema cache"
-- Причина: ActivityLogger сохраняет сон с полями sleep_start/sleep_end
-- (src/features/activities/ActivityLogger.jsx, src/store/useMetaboStore.js → entryPayload),
-- а в таблице public.entries этих колонок нет.
-- Выполнить ЦЕЛИКОМ в Supabase Dashboard → SQL Editor → Run (идемпотентно).
-- После выполнения достаточно перезагрузить страницу — PostgREST сам обновит кэш схемы.
-- ============================================================

alter table public.entries
  add column if not exists sleep_start text,   -- «заснул», локальное ISO 'YYYY-MM-DDTHH:MM'
  add column if not exists sleep_end   text;   -- «проснулся», локальное ISO 'YYYY-MM-DDTHH:MM'

-- Принудительно обновить кэш схемы PostgREST (не обязательно — он обновляется автоматически)
notify pgrst, 'reload schema';
