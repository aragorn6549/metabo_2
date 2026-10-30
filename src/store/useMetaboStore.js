// DECISION: исправлен прод-овер «TypeError: r is not a function» (падает useSyncExternalStoreWithSelector).
// Причина №1: App.jsx вызывал хук как useMetaboStore(user) — zustand трактует первый аргумент как СЕЛЕКТОР,
//   и внутри шима выполнялся селектор (объект user) над состоянием → "is not a function".
// Причина №2: стор не возвращал производные поля baseline/foodLogs/.../plan, которые читает App.jsx.
// Теперь это обычный React-хук: подписка через useStore(vanilla api) + useMemo с той же математикой,
// что и в демо-режиме (src/demo/demoData.js), CRUD — напрямую в Supabase (схема supabase/schema.sql).
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useStore } from 'zustand';
import {
  calculateBMR, calculateTDEE, calcBMI, simulateDay, computePlan, genId,
} from '@/lib/shared';
import { supabase } from '@/lib/supabase';

const dayMs = 86400e3;

const toNum = (v, d = null) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const isUuid = (id) => typeof id === 'string' && /^[0-9a-fA-F-]{36}$/.test(id);

// ---------- строки БД → формат приложения ----------
const mapEntryRow = (r) => ({
  id: r.id,
  type: r.type,
  subtype: r.subtype || undefined,
  name: r.name || '',
  timestamp: new Date(r.occurred_at).getTime(),
  calories: toNum(r.calories, 0),
  protein: toNum(r.protein, 0),
  fat: toNum(r.fat, 0),
  carbs: toNum(r.carbs, 0),
  duration: toNum(r.duration_min, undefined),
  hours: toNum(r.sleep_hours, undefined),
  quality: toNum(r.sleep_quality, undefined),
});

const entryPayload = (e) => ({
  type: e.type,
  subtype: e.subtype ?? null,
  name: e.name ?? null,
  occurred_at: new Date(e.timestamp ?? Date.now()).toISOString(),
  calories: toNum(e.calories),
  protein: toNum(e.protein),
  fat: toNum(e.fat),
  carbs: toNum(e.carbs),
  duration_min: toNum(e.duration ?? e.duration_min),
  sleep_hours: toNum(e.hours ?? e.sleep_hours),
  sleep_quality: toNum(e.quality ?? e.sleep_quality),
});

const mapInbodyRow = (r) => ({
  id: r.id,
  date: r.measured_at,
  weight: toNum(r.weight_kg, 0),
  fatPercent: toNum(r.fat_percent, 0),
  musclePercent: toNum(r.muscle_percent, 0),
  bmr: toNum(r.bmr, 0),
  bmi: toNum(r.bmi, 0),
});

const inbodyPayload = (l) => ({
  measured_at: new Date(l.date ?? Date.now()).toISOString(),
  weight_kg: toNum(l.weight, 0),
  fat_percent: toNum(l.fatPercent, 0),
  muscle_percent: toNum(l.musclePercent, 0),
  bmr: toNum(l.bmr, 0),
  bmi: toNum(l.bmi, calcBMI(toNum(l.weight, 0), toNum(l.height, 175))),
});

const mapGoalRow = (r) => ({
  id: r.id,
  targetType: r.goal_type,
  targetValue: toNum(
    r.goal_type === 'weight' ? r.target_weight_kg
    : r.goal_type === 'fatPercent' ? r.target_fat_pct
    : r.target_muscle_pct, 0),
  targetDate: r.target_date,
  assessment: r.assessment || null,
  createdAt: r.created_at,
});

const goalPayload = (userId, g) => {
  const t = g.targetType || 'weight';
  return {
    user_id: userId,
    goal_type: t,
    target_weight_kg: t === 'weight' ? g.targetValue : null,
    target_fat_pct: t === 'fatPercent' ? g.targetValue : null,
    target_muscle_pct: t === 'musclePercent' ? g.targetValue : null,
    target_date: g.targetDate,
    assessment: g.assessment || {},
    status: 'active',
  };
};

// Repair: цель могла быть сохранена с другим baseline; Postgres numeric в jsonb приходит строками.
const repairAssessment = (a, baseline) => {
  if (!a) return a;
  const out = { ...a };
  ['currentValue', 'targetValue', 'dailyCalorieAdjustment', 'targetCalories', 'energyExpenditure',
   'targetProtein', 'targetFat', 'targetCarbs', 'daysAvailable'].forEach(f => {
    const n = Number(out[f]); out[f] = Number.isFinite(n) ? n : 0;
  });
  if (typeof out.isFeasible !== 'boolean') out.isFeasible = true;
  if (typeof out.verdict !== 'string' || !out.verdict) out.verdict = out.isFeasible ? 'Реалистично' : 'Слишком агрессивно';
  if (typeof out.limitDescription !== 'string') out.limitDescription = '';
  if (!out.targetUnit) out.targetUnit = out.targetType === 'weight' ? 'кг' : '%';
  if (baseline && Number.isFinite(Number(baseline.weight)) && out.targetType === 'weight') {
    out.currentValue = Number(baseline.weight);
    out.targetDelta = out.targetValue - out.currentValue;
  }
  return out;
};

// ---------- vanilla store (без persist: источник правды — Supabase) ----------
const storeApi = create((set, get) => ({
  userId: null,
  profile: null,
  entries: [],
  dishes: [],
  goals: [],
  inbodyLogs: [],
  loading: false,
  error: null,

  setUserId: (userId) => {
    if (get().userId === userId) return;
    set({ userId, profile: null, entries: [], dishes: [], goals: [], inbodyLogs: [], loading: !!userId, error: null });
    if (userId) get().loadAll(userId);
  },

  loadAll: async (uid) => {
    try {
      const [p, e, d, g, ib] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
        supabase.from('entries').select('*').eq('user_id', uid).order('occurred_at', { ascending: false }).limit(2000),
        supabase.from('dishes').select('*').eq('user_id', uid).order('created_at'),
        supabase.from('goals').select('*').eq('user_id', uid).eq('status', 'active').order('created_at', { ascending: false }),
        supabase.from('inbody_logs').select('*').eq('user_id', uid).order('measured_at', { ascending: false }).limit(500),
      ]);
      const err = p.error || e.error || d.error || g.error || ib.error;
      if (err) throw err;
      set({
        profile: p.data,
        entries: (e.data || []).map(mapEntryRow),
        dishes: d.data || [],
        goals: (g.data || []).map(mapGoalRow),
        inbodyLogs: (ib.data || []).map(mapInbodyRow),
      });
    } catch (err) {
      console.error('loadAll:', err);
      set({ error: err?.message || String(err) });
    } finally {
      set({ loading: false });
    }
  },

  saveEntry: async (entry) => {
    const uid = get().userId;
    if (!uid) throw new Error('Не авторизован');
    const payload = { id: isUuid(entry.id) ? entry.id : genId(), user_id: uid, ...entryPayload(entry) };
    const { data, error } = await supabase.from('entries').upsert(payload, { onConflict: 'id' }).select().single();
    if (error) throw error;
    const row = mapEntryRow(data);
    set({ entries: [row, ...get().entries.filter(x => x.id !== row.id)].sort((a, b) => b.timestamp - a.timestamp) });
  },

  deleteEntry: async (entry) => {
    const uid = get().userId;
    if (!uid || !isUuid(entry?.id)) return;
    const { error } = await supabase.from('entries').delete().eq('id', entry.id).eq('user_id', uid);
    if (error) throw error;
    set({ entries: get().entries.filter(x => x.id !== entry.id) });
  },

  saveDish: async (dish) => {
    const uid = get().userId;
    if (!uid) throw new Error('Не авторизован');
    const payload = {
      id: isUuid(dish.id) ? dish.id : genId(), user_id: uid, name: dish.name,
      calories: toNum(dish.calories, 0), protein: toNum(dish.protein, 0),
      fat: toNum(dish.fat, 0), carbs: toNum(dish.carbs, 0),
    };
    const { data, error } = await supabase.from('dishes').upsert(payload, { onConflict: 'id' }).select().single();
    if (error) throw error;
    const cur = get().dishes;
    set({ dishes: cur.some(x => x.id === data.id) ? cur.map(x => x.id === data.id ? data : x) : [...cur, data] });
  },

  deleteDish: async (dish) => {
    const uid = get().userId;
    if (!uid || !isUuid(dish?.id)) return;
    const { error } = await supabase.from('dishes').delete().eq('id', dish.id).eq('user_id', uid);
    if (error) throw error;
    set({ dishes: get().dishes.filter(x => x.id !== dish.id) });
  },

  saveInbody: async (log) => {
    const uid = get().userId;
    if (!uid) throw new Error('Не авторизован');
    const payload = { id: isUuid(log.id) ? log.id : genId(), user_id: uid, ...inbodyPayload(log) };
    const { data, error } = await supabase.from('inbody_logs').upsert(payload, { onConflict: 'id' }).select().single();
    if (error) throw error;
    const row = mapInbodyRow(data);
    set({ inbodyLogs: [row, ...get().inbodyLogs.filter(x => x.id !== row.id)].sort((a, b) => new Date(b.date) - new Date(a.date)) });
  },

  deleteInbody: async (log) => {
    const uid = get().userId;
    if (!uid || !isUuid(log?.id)) return;
    const { error } = await supabase.from('inbody_logs').delete().eq('id', log.id).eq('user_id', uid);
    if (error) throw error;
    set({ inbodyLogs: get().inbodyLogs.filter(x => x.id !== log.id) });
  },

  updateBaseline: async (data) => {
    const uid = get().userId;
    if (!uid) throw new Error('Не авторизован');
    const profPayload = {
      id: uid, name: data.name || null, age: toNum(data.age, 30), gender: data.gender || 'male',
      height_cm: toNum(data.height, 178), activity_level: data.activityLevel || 'moderate',
    };
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const existingToday = get().inbodyLogs.find(l => new Date(l.date).getTime() >= todayStart.getTime());
    const measure = {
      id: existingToday?.id,
      date: existingToday?.date || new Date().toISOString(),
      weight: toNum(data.weight, 0), fatPercent: toNum(data.fatPercent, 0), musclePercent: toNum(data.musclePercent, 0),
      bmr: toNum(data.bmr, 0), height: toNum(data.height, 178),
    };
    const profRes = await supabase.from('profiles').upsert(profPayload, { onConflict: 'id' }).select().single();
    if (profRes.error) throw profRes.error;
    const savedLog = await get().saveInbody(measure);
    set({ profile: profRes.data });
    return savedLog;
  },

  setGoal: async (g) => {
    const uid = get().userId;
    if (!uid) throw new Error('Не авторизован');
    // одна активная цель: предыдущие — в cancelled
    if (get().goals.length) {
      const { error: ce } = await supabase.from('goals').update({ status: 'cancelled' }).eq('user_id', uid).eq('status', 'active');
      if (ce) throw ce;
    }
    const { data, error } = await supabase.from('goals').insert(goalPayload(uid, g)).select().single();
    if (error) throw error;
    set({ goals: [mapGoalRow(data)] });
  },

  deleteGoal: async () => {
    const uid = get().userId;
    const active = get().goals[0];
    if (!uid || !isUuid(active?.id)) return;
    const { error } = await supabase.from('goals').delete().eq('id', active.id).eq('user_id', uid);
    if (error) throw error;
    set({ goals: [] });
  },
}));

// ---------- публичный React-хук ----------
export function useMetaboStore(user) {
  const state = useStore(storeApi);

  useEffect(() => {
    storeApi.getState().setUserId(user?.id ?? null);
  }, [user?.id]);

  const derived = useMemo(() => {
    const { profile, entries, dishes, goals, inbodyLogs } = state;
    const sortedLogs = [...inbodyLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = sortedLogs[0] || null;
    const baseline = (!profile || !latest) ? null : {
      name: profile.name || '', age: toNum(profile.age, 30), gender: profile.gender,
      height: toNum(profile.height_cm, 175), activityLevel: profile.activity_level || 'moderate',
      weight: latest.weight, fatPercent: latest.fatPercent, musclePercent: latest.musclePercent,
      bmr: latest.bmr || calculateBMR(latest.weight, toNum(profile.height_cm, 175), toNum(profile.age, 30), profile.gender),
      bmi: latest.bmi || calcBMI(latest.weight, toNum(profile.height_cm, 175)),
    };

    const asc = [...entries].sort((a, b) => a.timestamp - b.timestamp);
    const foodLogs = asc.filter(e => e.type === 'food');
    const activities = asc.filter(e => e.type !== 'food');

    const rawGoal = goals[0] || null;
    const goal = rawGoal && rawGoal.assessment
      ? { ...rawGoal, assessment: repairAssessment(rawGoal.assessment, baseline) }
      : rawGoal;

    const sumMacros = (arr) => arr.reduce((acc, f) => ({
      protein: acc.protein + (+f.protein || 0), fat: acc.fat + (+f.fat || 0), carbs: acc.carbs + (+f.carbs || 0),
    }), { protein: 0, fat: 0, carbs: 0 });

    let history = [];
    if (baseline) {
      history = sortedLogs.map(log => {
        const dayStartTs = new Date(log.date); dayStartTs.setHours(0, 0, 0, 0);
        const dayEndTs = dayStartTs.getTime() + dayMs;
        const foods = foodLogs.filter(f => f.timestamp >= dayStartTs.getTime() && f.timestamp < dayEndTs);
        const acts = activities.filter(a => a.timestamp >= dayStartTs.getTime() - dayMs && a.timestamp < dayEndTs);
        const calC = foods.reduce((s, f) => s + (+f.calories || 0), 0);
        const macros = sumMacros(foods);
        const wCal = acts.filter(a => a.type === 'workout').reduce((s, a) => s + (+a.calories || 0), 0);
        const tdee = calculateTDEE(log.bmr || baseline.bmr, baseline.activityLevel, wCal, macros);
        const balance = calC - tdee;
        const simDay = simulateDay(foods, acts.filter(a => a.timestamp >= dayStartTs.getTime()), balance);
        return {
          date: log.date, weight: log.weight, fatPercent: log.fatPercent, musclePercent: log.musclePercent,
          caloriesConsumed: calC, balance,
          fatOxidized: simDay.fatOxidized, fatStored: simDay.fatStored, muscleNet: simDay.muscleToday,
        };
      }).reverse();
    }

    let todayData = null, sim = null;
    if (baseline) {
      const todayStartTs = new Date(); todayStartTs.setHours(0, 0, 0, 0);
      const todayFoods = foodLogs.filter(f => f.timestamp >= todayStartTs.getTime());
      const todayActs = activities.filter(a => a.timestamp >= todayStartTs.getTime());
      const macros = sumMacros(todayFoods);
      const caloriesConsumed = todayFoods.reduce((s, f) => s + (+f.calories || 0), 0);
      const wCal = todayActs.filter(a => a.type === 'workout').reduce((s, a) => s + (+a.calories || 0), 0);
      const tdee = calculateTDEE(baseline.bmr, baseline.activityLevel, wCal, macros);
      const balance = caloriesConsumed - tdee;
      const sleepEntry = todayActs.find(a => a.type === 'sleep');
      todayData = {
        tdee, caloriesConsumed, balance, macros,
        sleepHours: sleepEntry?.hours ?? 8,
        hasStrength: todayActs.some(a => a.type === 'workout' && a.subtype === 'strength'),
      };
      sim = simulateDay(todayFoods, todayActs, balance);
    }

    let plan = null;
    if (goal && baseline) {
      try {
        const sevenDaysAgo = Date.now() - 7 * dayMs;
        plan = computePlan(goal, baseline,
          foodLogs.filter(f => f.timestamp >= sevenDaysAgo),
          activities.filter(a => a.timestamp >= sevenDaysAgo));
      } catch (err) { console.error('computePlan:', err); }
    }

    return { baseline, foodLogs, activities, dishes, goal, history, inbodyLogs: sortedLogs, todayData, sim, plan };
  }, [state]);

  const a = storeApi.getState();
  return {
    ...derived,
    loading: state.loading,
    error: state.error,
    saveEntry: a.saveEntry,
    deleteEntry: a.deleteEntry,
    saveDish: a.saveDish,
    deleteDish: a.deleteDish,
    saveInbody: a.saveInbody,
    deleteInbody: a.deleteInbody,
    updateBaseline: a.updateBaseline,
    setGoal: a.setGoal,
    deleteGoal: a.deleteGoal,
    reload: () => state.userId && storeApi.getState().loadAll(state.userId),
  };
}

export default useMetaboStore;
