-- ============================================================
-- MetaBo · Supabase schema (ТЗ §5, §8)
-- Выполнить целиком в Supabase Dashboard → SQL Editor → Run
-- ============================================================
create extension if not exists "pgcrypto";

-- 1. Профили (только статичные поля; вес/жир/мышци — в inbody_logs, ТЗ §5.2)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  age int not null default 30,
  gender text not null default 'male' check (gender in ('male','female')),
  height_cm numeric not null default 178,
  activity_level text not null default 'moderate'
    check (activity_level in ('sedentary','light','moderate','high','extreme')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2. Записи журнала: еда + активности в одной таблице (ТЗ §5)
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('food','workout','sleep','other')),
  subtype text,            -- strength/cardio/volleyball/padel/...
  name text,
  occurred_at timestamptz not null default now(),
  calories numeric, protein numeric, fat numeric, carbs numeric,   -- food
  duration_min numeric,                                            -- workout/other
  sleep_hours numeric,                                             -- sleep
  sleep_quality int check (sleep_quality between 1 and 5),         -- sleep
  created_at timestamptz not null default now()
);
create index if not exists entries_user_time_idx on public.entries (user_id, occurred_at);

-- 3. Справочник блюд
create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  calories numeric not null default 0,
  protein numeric not null default 0,
  fat numeric not null default 0,
  carbs numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 4. Цели
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('weight','fatPercent','muscleMass','recomposition')),
  target_value numeric not null,
  target_date date not null,
  assessment jsonb not null default '{}'::jsonb,  -- результат assessGoal (ТЗ §6)
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  created_at timestamptz not null default now()
);

-- 5. Замеры InBody (baseline = последний по дате, ТЗ §5.2)
create table if not exists public.inbody_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric not null,
  fat_percent numeric not null,
  muscle_percent numeric not null,
  bmr numeric not null,
  bmi numeric,
  created_at timestamptz not null default now()
);
create index if not exists inbody_user_time_idx on public.inbody_logs (user_id, measured_at);

-- 6. История (материализация дневных точек; upsert по user+day)
create table if not exists public.history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

-- ============================================================
-- RLS: каждый пользователь видит/меняет только свои строки
-- ============================================================
alter table public.profiles    enable row level security;
alter table public.entries     enable row level security;
alter table public.dishes      enable row level security;
alter table public.goals       enable row level security;
alter table public.inbody_logs enable row level security;
alter table public.history     enable row level security;

drop policy if exists profiles_select    on public.profiles;
drop policy if exists profiles_insert    on public.profiles;
drop policy if exists profiles_update    on public.profiles;
drop policy if exists entries_select     on public.entries;
drop policy if exists entries_insert     on public.entries;
drop policy if exists entries_update     on public.entries;
drop policy if exists entries_delete     on public.entries;
drop policy if exists dishes_select      on public.dishes;
drop policy if exists dishes_insert      on public.dishes;
drop policy if exists dishes_update      on public.dishes;
drop policy if exists dishes_delete      on public.dishes;
drop policy if exists goals_select       on public.goals;
drop policy if exists goals_insert       on public.goals;
drop policy if exists goals_update       on public.goals;
drop policy if exists goals_delete       on public.goals;
drop policy if exists inbody_select      on public.inbody_logs;
drop policy if exists inbody_insert      on public.inbody_logs;
drop policy if exists inbody_update      on public.inbody_logs;
drop policy if exists inbody_delete      on public.inbody_logs;
drop policy if exists history_select     on public.history;
drop policy if exists history_insert     on public.history;
drop policy if exists history_update     on public.history;
drop policy if exists history_delete     on public.history;

create policy profiles_select on public.profiles    for select using (auth.uid() = id);
create policy profiles_insert on public.profiles    for insert with check (auth.uid() = id);
create policy profiles_update on public.profiles    for update using (auth.uid() = id);

create policy entries_select  on public.entries     for select using (auth.uid() = user_id);
create policy entries_insert  on public.entries     for insert with check (auth.uid() = user_id);
create policy entries_update  on public.entries     for update using (auth.uid() = user_id);
create policy entries_delete  on public.entries     for delete using (auth.uid() = user_id);

create policy dishes_select   on public.dishes      for select using (auth.uid() = user_id);
create policy dishes_insert   on public.dishes      for insert with check (auth.uid() = user_id);
create policy dishes_update   on public.dishes      for update using (auth.uid() = user_id);
create policy dishes_delete   on public.dishes      for delete using (auth.uid() = user_id);

create policy goals_select    on public.goals       for select using (auth.uid() = user_id);
create policy goals_insert    on public.goals       for insert with check (auth.uid() = user_id);
create policy goals_update    on public.goals       for update using (auth.uid() = user_id);
create policy goals_delete    on public.goals       for delete using (auth.uid() = user_id);

create policy inbody_select   on public.inbody_logs for select using (auth.uid() = user_id);
create policy inbody_insert   on public.inbody_logs for insert with check (auth.uid() = user_id);
create policy inbody_update   on public.inbody_logs for update using (auth.uid() = user_id);
create policy inbody_delete   on public.inbody_logs for delete using (auth.uid() = user_id);

create policy history_select  on public.history     for select using (auth.uid() = user_id);
create policy history_insert  on public.history     for insert with check (auth.uid() = user_id);
create policy history_update  on public.history     for update using (auth.uid() = user_id);
create policy history_delete  on public.history     for delete using (auth.uid() = user_id);

-- ============================================================
-- Авто-создание профиля при регистрации (ТЗ §8.1)
-- ============================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
