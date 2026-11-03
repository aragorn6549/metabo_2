-- ============================================================
-- MetaBo · диагностика: проверка наличия ВСЕХ нужных объектов БД
-- Просто выполнить ЦЕЛИКОМ в Supabase Dashboard → SQL Editor → Run.
-- Скрипт ничего не меняет (только SELECT) — безопасен.
-- Результат: таблица «checklist» с колонкой status:
--   OK        — объект есть
--   MISSING   — объекта нет (нужно выполнить соответствующую миграцию)
--   EXTRA     — лишняя колонка sleep_start/sleep_end (устарела, можно удалить
--               скриптом supabase/remove_sleep_columns.sql)
-- ============================================================

with required_tables(name) as (
  values ('profiles'), ('inbody_logs'), ('entries'), ('dishes'), ('goals'), ('admin_roles')
),
table_check as (
  select 'Таблица: ' || t.name as object,
         case when exists (
                select 1 from information_schema.tables c
                 where c.table_schema = 'public' and c.table_name = t.name
         ) then 'OK' else 'MISSING' end as status
    from required_tables t
),
required_columns(table_name, column_name) as (
  values
    ('entries', 'id'), ('entries', 'user_id'), ('entries', 'type'), ('entries', 'subtype'),
    ('entries', 'name'), ('entries', 'occurred_at'), ('entries', 'calories'),
    ('entries', 'protein'), ('entries', 'fat'), ('entries', 'carbs'),
    ('entries', 'duration_min'), ('entries', 'sleep_hours'), ('entries', 'sleep_quality'),
    ('entries', 'created_at'),
    ('dishes', 'id'), ('dishes', 'user_id'), ('dishes', 'name'), ('dishes', 'calories'),
    ('dishes', 'protein'), ('dishes', 'fat'), ('dishes', 'carbs'),
    ('goals', 'id'), ('goals', 'user_id'), ('goals', 'goal_type'), ('goals', 'target_date'),
    ('goals', 'target_weight_kg'), ('goals', 'target_fat_pct'), ('goals', 'target_muscle_pct'),
    ('goals', 'assessment'), ('goals', 'status'), ('goals', 'is_active'),
    ('admin_roles', 'user_id'), ('admin_roles', 'role'),
    ('inbody_logs', 'weight_kg'), ('inbody_logs', 'fat_percent'),
    ('inbody_logs', 'muscle_percent'), ('inbody_logs', 'bmr'), ('inbody_logs', 'measured_at'),
    ('profiles', 'id'), ('profiles', 'email'), ('profiles', 'name'), ('profiles', 'age'),
    ('profiles', 'gender'), ('profiles', 'height_cm'), ('profiles', 'activity_level')
),
column_check as (
  select 'Колонка: ' || c.table_name || '.' || c.column_name as object,
         case when exists (
                select 1 from information_schema.columns x
                 where x.table_schema = 'public'
                   and x.table_name = c.table_name
                   and x.column_name = c.column_name
         ) then 'OK' else 'MISSING' end as status
    from required_columns c
),
legacy_column_check as (
  select 'Лишняя колонка: entries.' || c.column_name as object,
         'EXTRA (удалить через remove_sleep_columns.sql)' as status
    from unnest(array['sleep_start','sleep_end']) as c(column_name)
   where exists (
     select 1 from information_schema.columns x
      where x.table_schema = 'public' and x.table_name = 'entries'
        and x.column_name = c.column_name
   )
),
required_funcs(name) as (
  values ('is_admin'), ('admin_list_users'), ('admin_delete_user')
),
func_check as (
  select 'RPC-функция: ' || f.name as object,
         case when exists (
                select 1 from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = f.name
         ) then 'OK' else 'MISSING' end as status
    from required_funcs f
),
rls_check as (
  select 'RLS включена: entries' as object,
         case when exists (
                select 1 from pg_class c
                 join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'entries' and c.relrowsecurity
         ) then 'OK' else 'MISSING' end as status
  union all
  select 'RLS включена: admin_roles',
         case when exists (
                select 1 from pg_class c
                 join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'admin_roles' and c.relrowsecurity
         ) then 'OK' else 'MISSING' end
)
-- Оборачиваем UNION в подзапрос: в PostgreSQL после UNION/INTERSECT/EXCEPT
-- в ORDER BY нельзя использовать выражения (CASE...), только имена колонок.
-- Поэтому порядковый номер sort_order вычисляется внутри, а снаружи — по имени.
select object, status
  from (
    select object, status,
           case when status = 'MISSING' then 0
                when status like 'EXTRA%' then 1
                else 2 end as sort_order
      from table_check
    union all
    select object, status,
           case when status = 'MISSING' then 0
                when status like 'EXTRA%' then 1
                else 2 end
      from column_check
    union all
    select object, status,
           case when status = 'MISSING' then 0
                when status like 'EXTRA%' then 1
                else 2 end
      from legacy_column_check
    union all
    select object, status,
           case when status = 'MISSING' then 0
                when status like 'EXTRA%' then 1
                else 2 end
      from func_check
    union all
    select object, status,
           case when status = 'MISSING' then 0
                when status like 'EXTRA%' then 1
                else 2 end
      from rls_check
  ) u
order by sort_order, object;
