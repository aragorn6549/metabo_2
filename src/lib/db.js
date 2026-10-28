// DECISION: слой доступа к данным (ТЗ §5, §8). Supabase = источник истины.
// timestamp в БД — timestamptz; наружу отдаём unix ms (как ожидает математика из прототипа).
import { supabase } from '@/lib/supabase';

const toMs = (s) => (s ? new Date(s).getTime() : 0);
const toIso = (ms) => new Date(ms).toISOString();

// ---------- profiles + baseline ----------
export async function fetchProfile(uid) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
  if (error) throw error;
  return data;
}

export async function fetchLatestInBody(uid) {
  const { data, error } = await supabase.from('inbody_logs')
    .select('*').eq('user_id', uid).order('measured_at', { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export function buildBaseline(profile, latestInbody) {
  if (!latestInbody) return null; // нужен онбординг
  return {
    name: profile?.name || '',
    age: profile?.age ?? 30,
    gender: profile?.gender || 'male',
    height: profile?.height_cm ?? 178,
    activityLevel: profile?.activity_level || 'moderate',
    weight: latestInbody.weight_kg,
    fatPercent: latestInbody.fat_percent,
    musclePercent: latestInbody.muscle_percent,
    bmr: latestInbody.bmr,
    bmi: latestInbody.bmi,
  };
}

export async function updateProfile(uid, patch) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', uid);
  if (error) throw error;
}

// ---------- entries (food + activities в одной таблице, как в ТЗ) ----------
function rowToEntry(r) {
  return {
    id: r.id, type: r.type, subtype: r.subtype || undefined, name: r.name || undefined,
    timestamp: toMs(r.occurred_at),
    calories: r.calories ?? undefined, protein: r.protein ?? undefined,
    fat: r.fat ?? undefined, carbs: r.carbs ?? undefined,
    duration: r.duration_min ?? undefined, duration_min: r.duration_min ?? undefined,
    hours: r.sleep_hours ?? undefined, quality: r.sleep_quality ?? undefined,
  };
}
function entryToRow(uid, e) {
  return {
    user_id: uid, type: e.type, subtype: e.subtype || null, name: e.name || null,
    occurred_at: toIso(e.timestamp),
    calories: e.calories ?? null, protein: e.protein ?? null,
    fat: e.fat ?? null, carbs: e.carbs ?? null,
    duration_min: e.duration_min ?? e.duration ?? null,
    sleep_hours: e.hours ?? null, sleep_quality: e.quality ?? null,
  };
}

export async function fetchEntries(uid) {
  const { data, error } = await supabase.from('entries')
    .select('*').eq('user_id', uid).order('occurred_at', { ascending: true });
  if (error) throw error;
  const all = (data || []).map(rowToEntry);
  return { foodLogs: all.filter(e => e.type === 'food'), activities: all.filter(e => e.type !== 'food') };
}

export async function insertEntry(uid, e) {
  const { data, error } = await supabase.from('entries').insert(entryToRow(uid, e)).select().single();
  if (error) throw error;
  return rowToEntry(data);
}

export async function updateEntry(uid, id, e) {
  const row = entryToRow(uid, e);
  delete row.user_id;
  const { data, error } = await supabase.from('entries').update(row).eq('id', id).eq('user_id', uid).select().single();
  if (error) throw error;
  return rowToEntry(data);
}

export async function deleteEntry(id) {
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw error;
}

// ---------- dishes ----------
export async function fetchDishes(uid) {
  const { data, error } = await supabase.from('dishes').select('*').eq('user_id', uid).order('created_at');
  if (error) throw error;
  return data || [];
}
export async function insertDish(uid, d) {
  const { data, error } = await supabase.from('dishes')
    .insert({ user_id: uid, name: d.name, calories: d.calories, protein: d.protein, fat: d.fat, carbs: d.carbs })
    .select().single();
  if (error) throw error;
  return data;
}
export async function updateDish(id, d) {
  const { error } = await supabase.from('dishes')
    .update({ name: d.name, calories: d.calories, protein: d.protein, fat: d.fat, carbs: d.carbs })
    .eq('id', id);
  if (error) throw error;
}
export async function deleteDish(id) {
  const { error } = await supabase.from('dishes').delete().eq('id', id);
  if (error) throw error;
}

// ---------- inbody logs ----------
export async function fetchInBodyLogs(uid) {
  const { data, error } = await supabase.from('inbody_logs')
    .select('*').eq('user_id', uid).order('measured_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, date: r.measured_at, weight: r.weight_kg, fatPercent: r.fat_percent,
    musclePercent: r.muscle_percent, bmr: r.bmr, bmi: r.bmi,
  }));
}
// UUID v4 (строгий): только он валиден для колонки uuid в Supabase/Postgres.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function upsertInBodyLog(uid, log) {
  const row = {
    user_id: uid, measured_at: log.date.includes?.('T') ? log.date : new Date(log.date).toISOString(),
    weight_kg: log.weight, fat_percent: log.fatPercent, muscle_percent: log.musclePercent,
    bmr: Math.round(log.bmr), bmi: log.bmi ?? null,
  };
  // DECISION (исправление бага 406 + «Cannot read properties of undefined (reading 'toFixed')»):
  // раньше при логированном id делался только PATCH (.eq('id', ...) без .select()), и если строки
  // с таким id в БД нет (локальный id из редактора или id, удалённый в другой сессии), Supabase
  // возвращал 406 PGRST116, а upsert бросал ошибку ДО обновления локального состояния.
  // В итоге inbodyLogs оставался пустым/без замера, baseline = null, план по цели не пересчитывался,
  // и GoalTab падал на undefined.toFixed → ErrorBoundary показывал «Что-то пошло не так».
  // Теперь: PATCH выполняется с .select().maybeSingle(); если строка не найдена или id не валидный
  // uuid — делаем INSERT и возвращаем реальную запись из БД (её uuid подставится в стор).
  const canPatch = typeof log.id === 'string' && UUID_RE.test(log.id);
  let data, error;
  if (canPatch) {
    const r = { ...row }; delete r.user_id;
    ({ data, error } = await supabase.from('inbody_logs').update(r)
      .eq('id', log.id).eq('user_id', uid).select().maybeSingle());
    if (error) {
      console.warn('upsertInBodyLog: update failed, falling back to insert:', error.message);
      data = null;
    }
  }
  if (!data) {
    ({ data, error } = await supabase.from('inbody_logs').insert(row).select().single());
  }
  if (error) throw error;
  return { id: data.id, date: data.measured_at, weight: data.weight_kg, fatPercent: data.fat_percent,
    musclePercent: data.muscle_percent, bmr: data.bmr, bmi: data.bmi };
}
export async function deleteInBodyLog(id) {
  const { error } = await supabase.from('inbody_logs').delete().eq('id', id);
  if (error) throw error;
}

// ---------- goals ----------
// Цели бывают трёх типов: weight | fatPercent | musclePercent (приложение никогда не писало muscleMass/recomposition,
// но CHECK в старой схеме это допускал — поэтому миграция fix_migrate_goals.sql переносит такие значения как есть
// и расширяет CHECK). См. supabase/schema.sql.
const GOAL_TYPES = ['weight', 'fatPercent', 'musclePercent'];

export async function saveGoal(uid, goal, baseline = null) {
  // одна активная цель: предыдущие закрываем
  await supabase.from('goals').update({ status: 'completed' }).eq('user_id', uid).eq('status', 'active');
  // DECISION: в assessment лежат Date-объекты (realisticDate/originalDate) — Postgres jsonb их не принимает,
  // сериализуем в ISO-строки перед вставкой
  const serialize = (a) => JSON.parse(JSON.stringify(a ?? {}, (k, v) => (v instanceof Date ? v.toISOString() : v)));
  const { data, error } = await supabase.from('goals').insert({
    user_id: uid,
    goal_type: goal.targetType,
    target_weight_kg: goal.targetType === 'weight' ? goal.targetValue : null,
    target_fat_pct: goal.targetType === 'fatPercent' ? goal.targetValue : null,
    target_muscle_pct: goal.targetType === 'musclePercent' ? goal.targetValue : null,
    target_date: goal.targetDate.slice(0, 10),
    assessment: serialize(goal.assessment), status: 'active',
  }).select().single();
  if (error) throw error;
  // DECISION (исправление «undefined.toFixed» после нажатия «Рассчитать»):
  // раньше сюда не передавался baseline и repairAssessment не мог восстановить currentValue
  // для старых мигрированных строк без jsonb-колонки assessment → GoalTab падал в ErrorBoundary.
  return normalizeGoalRow(data, baseline);
}

// DECISION: нормализация строки goals (мигрированные колонки) → формат цели приложения.
// Обратное маппирование старых значений (muscleMass/recomposition → % мышц).
// + ремонт assessment: старые/битые строки в jsonb могли не содержать currentValue / targetUnit /
// dailyCalorieAdjustment и т.п. — рендер GoalTab падал на «undefined.toFixed» (ErrorBoundary).
// Все недостающие поля восстанавливаем из baseline, который всегда есть на экране «Цель».
function repairAssessment(a, goalRow, baseline, gRow = {}) {
  const src = a && typeof a === 'object' ? a : {};
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : undefined);
  const out = { ...src };
  const targetType = src.targetType || goalRow;
  const unit = targetType === 'weight' ? 'кг' : '%';
  const tv = num(src.targetValue);
  const rowTarget = Number(gRow.targetValue);
  out.targetType = GOAL_TYPES.includes(targetType) ? targetType : 'weight';
  out.targetUnit = typeof src.targetUnit === 'string' && src.targetUnit ? src.targetUnit : unit;
  if (num(src.currentValue) === undefined && baseline) {
    out.currentValue = num(out.targetType === 'weight' ? baseline.weight
      : out.targetType === 'fatPercent' ? baseline.fatPercent : baseline.musclePercent);
  }
  // финальная гарантия: currentValue ВСЕГДА конечное число (иначе GoalTab падает на undefined.toFixed)
  if (num(out.currentValue) === undefined) out.currentValue = 0;
  if (tv !== undefined) out.targetValue = tv;
  else if (isFinite(rowTarget)) out.targetValue = rowTarget;
  else out.targetValue = 0;
  if (num(src.targetDelta) === undefined) out.targetDelta = out.targetValue - out.currentValue;
  if (typeof src.direction !== 'string') {
    out.direction = src.targetDelta < 0 ? 'loss' : src.targetDelta > 0 ? 'gain' : 'maintain';
  }
  if (num(src.dailyCalorieAdjustment) === undefined) out.dailyCalorieAdjustment = 0;
  if (num(src.daysAvailable) === undefined) out.daysAvailable = 1;
  if (num(src.targetCalories) === undefined) out.targetCalories = num(baseline?.bmr) ?? 0;
  if (num(src.targetProtein) === undefined) out.targetProtein = 0;
  if (num(src.targetFat) === undefined) out.targetFat = 0;
  if (num(src.targetCarbs) === undefined) out.targetCarbs = 0;
  if (typeof src.isFeasible !== 'boolean') out.isFeasible = true;
  if (typeof src.verdict !== 'string') out.verdict = '';
  if (typeof src.limitDescription !== 'string') out.limitDescription = '';
  return out;
}

function normalizeGoalRow(g, baseline = null) {
  let targetType = g.goal_type;
  let targetValue = g.target_weight_kg ?? g.target_fat_pct ?? g.target_muscle_pct;
  if (!GOAL_TYPES.includes(targetType)) {
    targetType = 'musclePercent';
    targetValue = g.target_muscle_pct ?? g.target_fat_pct ?? g.target_weight_kg ?? targetValue;
  }
  return { id: g.id, targetType, targetValue,
    targetDate: g.target_date,
    assessment: repairAssessment(g.assessment, targetType, baseline, { targetValue }),
    createdAt: toMs(g.created_at) };
}

export async function fetchActiveGoal(uid, baseline = null) {
  const { data, error } = await supabase.from('goals')
    .select('*').eq('user_id', uid).eq('status', 'active').order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  const g = data?.[0];
  if (!g) return null;
  return normalizeGoalRow(g, baseline);
}

// ---------- history (материализуемая таблица из ТЗ §5; считается на клиенте при загрузке) ----------
export async function fetchHistory(uid) {
  const { data, error } = await supabase.from('history').select('*').eq('user_id', uid).order('day', { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function upsertHistoryDay(uid, point) {
  const { error } = await supabase.from('history').upsert(
    { user_id: uid, day: point.date.slice(0, 10), payload: point },
    { onConflict: 'user_id,day' }
  );
  if (error) throw error;
}
