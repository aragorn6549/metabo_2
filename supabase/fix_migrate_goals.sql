-- ============================================================
-- MetaBo · миграция таблицы goals под типы целей приложения
-- Выполнить в Supabase Dashboard → SQL Editor → Run (один раз)
--
-- Причина: в goals был CHECK (target_type in ('weight','fatPercent','muscleMass','recomposition')),
-- а приложение пишет goal_type = 'musclePercent' (вкладка «Цель»). Из-за этого INSERT цели
-- падал с ошибкой 400 / check_violation, цель не сохранялась и нижний блок оценки не появлялся.
-- ============================================================

begin;

-- 1. Новые колонки (значение цели хранится по типу в отдельной колонке)
alter table public.goals
  add column if not exists goal_type text,
  add column if not exists target_weight_kg numeric,
  add column if not exists target_fat_pct numeric,
  add column if not exists target_muscle_pct numeric;

-- 2. Перенос данных из старых колонок (если они ещё есть)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='goals' and column_name='target_type') then
    update public.goals set goal_type = target_type where goal_type is null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='goals' and column_name='target_value') then
    update public.goals set target_weight_kg = target_value where goal_type = 'weight' and target_weight_kg is null;
    update public.goals set target_fat_pct   = target_value where goal_type = 'fatPercent' and target_fat_pct is null;
    -- старые значения muscleMass/recomposition трактуем как % мышц
    update public.goals set target_muscle_pct = target_value where goal_type in ('musclePercent','muscleMass','recomposition') and target_muscle_pct is null;
    -- нормализуем старые типы к тому, что понимает приложение
    update public.goals set goal_type = 'musclePercent' where goal_type in ('muscleMass','recomposition');
  end if;
end $$;

-- 3. Если вдруг goal_type пуст у каких-то строк — ставим weight (безопасный дефолт)
update public.goals set goal_type = 'weight' where goal_type is null;

-- 4. Удаляем старый CHECK и колонки
alter table public.goals drop constraint if exists goals_target_type_check;
alter table public.goals drop column if exists target_type;
alter table public.goals drop column if exists target_value;

-- 5. Новый CHECK + NOT NULL
alter table public.goals
  alter column goal_type set not null,
  add constraint goals_goal_type_check check (goal_type in ('weight','fatPercent','musclePercent'));

-- 6. Индексы и RLS (политики идентичны остальным таблицам приложения)
create index if not exists goals_user_status_idx on public.goals (user_id, status);

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
