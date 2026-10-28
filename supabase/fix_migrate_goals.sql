-- ============================================================
-- MetaBo · миграция таблицы goals (v2, безопасная)
-- Выполнить в Supabase Dashboard → SQL Editor → Run (один раз)
-- Все шаги идемпотентны, можно запускать повторно.
-- ============================================================

begin;

-- 1. Колонки новой схемы (значение цели хранится по типу в отдельной колонке)
alter table public.goals
  add column if not exists goal_type text,
  add column if not exists target_weight_kg numeric,
  add column if not exists target_fat_pct numeric,
  add column if not exists target_muscle_pct numeric,
  add column if not exists status text default 'active';

-- 2. Перенос данных из старых колонок target_type/target_value (если они ещё есть)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='goals' and column_name='target_type') then
    update public.goals set goal_type = target_type where goal_type is null;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='goals' and column_name='target_value') then
    update public.goals set target_weight_kg = target_value where goal_type = 'weight'     and target_weight_kg is null;
    update public.goals set target_fat_pct   = target_value where goal_type = 'fatPercent' and target_fat_pct is null;
    -- старые значения muscleMass/recomposition трактуем как % мышц
    update public.goals set target_muscle_pct = target_value where goal_type in ('musclePercent','muscleMass','recomposition') and target_muscle_pct is null;
  end if;
end $$;

-- 3. Нормализация типов и дефолты
update public.goals set goal_type = 'musclePercent' where goal_type in ('muscleMass','recomposition');
update public.goals set goal_type = 'weight'        where goal_type is null;
update public.goals set status    = 'active'        where status is null or status not in ('active','completed','cancelled');

-- 4. Удаляем старый CHECK и устаревшие колонки
alter table public.goals drop constraint if exists goals_target_type_check;
alter table public.goals drop column if exists target_type;
alter table public.goals drop column if exists target_value;

-- 5. Новый CHECK + NOT NULL (повторный запуск безопасен — игнорируем «уже существует»)
do $$
begin
  alter table public.goals
    alter column goal_type set not null,
    alter column status set not null,
    alter column status set default 'active',
    add constraint goals_goal_type_check check (goal_type in ('weight','fatPercent','musclePercent')),
    add constraint goals_status_check check (status in ('active','completed','cancelled'));
exception when duplicate_object or duplicate_table or invalid_table_definition then
  null; -- ограничения уже добавлены предыдущим запуском
end $$;

-- 6. Индекс (после того, как status точно существует)
create index if not exists goals_user_status_idx on public.goals (user_id, status);

-- 7. RLS
alter table public.goals enable row level security;

drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own" on public.goals
  for select using (auth.uid() = user_id);

drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own" on public.goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own" on public.goals
  for delete using (auth.uid() = user_id);

commit;
