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

commit;
