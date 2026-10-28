import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as db from '@/lib/db';
import { calculateBMR, calculateTDEE, simulateDay, computePlan, genId, calcBMI } from '@/lib/shared';

// DECISION: вместо Zustand + localStorage (прототип) — React Query кэш с мутациями в Supabase.
// Публичный API хука совпадает с состоянием прототипа (App), поэтому компоненты не изменены.
export function useMetaboStore(user) {
  const uid = user?.id;
  const qc = useQueryClient();

  const [profile, setProfile] = useState(null);
  const [inbodyLogs, setInbodyLogs] = useState([]);
  const [foodLogs, setFoodLogs] = useState([]);
  const [activities, setActivities] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [goal, setGoal] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const [p, logs, ents, dishList] = await Promise.all([
          db.fetchProfile(uid), db.fetchInBodyLogs(uid), db.fetchEntries(uid),
          db.fetchDishes(uid),
        ]);
        if (!alive) return;
        setProfile(p);
        setInbodyLogs(logs);
        setFoodLogs(ents.foodLogs);
        setActivities(ents.activities);
        setDishes(dishList);
        // DECISION: history строим из inbody_logs (ТЗ §5: таблица history материализуется на клиенте)
        const hist = logs.map(l => ({
          date: l.date, weight: l.weight, fatPercent: l.fatPercent, musclePercent: l.musclePercent,
        }));
        setHistory(hist);
        // цель нормализуем/чиним по baseline (последний замер), чтобы GoalTab не падал
        // на undefined.toFixed в assessment из старых строк БД
        const bl = p && logs.length ? db.buildBaseline(p, logs[logs.length - 1]) : null;
        const g = await db.fetchActiveGoal(uid, bl);
        if (!alive) return;
        setGoal(g);
      } catch (e) {
        console.error('Load:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [uid]);

  const baseline = useMemo(() => {
    if (!profile || !inbodyLogs.length) return null;
    return db.buildBaseline(profile, inbodyLogs[inbodyLogs.length - 1]);
  }, [profile, inbodyLogs]);

  const invalidate = () => qc.invalidateQueries();

  // ---------- actions (оптимистичные + запись в Supabase) ----------
  const saveEntry = async (entry) => {
    // DECISION: id генерируем только для НОВЫХ локальных записей. Для записи, уже сохранённой в Supabase
    // (uuid из БД), переиспользуем entry.id — иначе PATCH .eq('id', сгенерированного-id) не находит строку.
    const e = { ...entry, id: entry.id || genId() };
    const isFood = e.type === 'food';
    const setter = isFood ? setFoodLogs : setActivities;
    setter(prev => [...prev.filter(x => x.id !== e.id), e]);
    try {
      if (entry.id) await db.updateEntry(uid, entry.id, e);
      else {
        const saved = await db.insertEntry(uid, e);
        // синхронизируем локальный rand/uuid-id с реальным uuid строки из БД
        setter(prev => prev.map(x => (x.id === e.id ? saved : x)));
      }
    } catch (err) { console.error(err); invalidate(); }
    // синхронизация новых блюд в справочник (как в прототипе)
    if (isFood && !entry.id && e.name && e.name.trim()) {
      const trimmed = e.name.trim();
      if (!dishes.some(d => d.name.toLowerCase() === trimmed.toLowerCase())) {
        try {
          const row = await db.insertDish(uid, { name: trimmed, calories: +e.calories || 0, protein: +e.protein || 0, fat: +e.fat || 0, carbs: +e.carbs || 0 });
          setDishes(prev => [...prev, row]);
        } catch (err) { console.error(err); }
      }
    }
  };

  const deleteEntry = async (entry) => {
    const isFood = entry.type === 'food';
    const setter = isFood ? setFoodLogs : setActivities;
    setter(prev => prev.filter(x => x.id !== entry.id));
    try { await db.deleteEntry(entry.id); } catch (err) { console.error(err); invalidate(); }
  };

  const saveDish = async (dish) => {
    if (dish.id) {
      setDishes(prev => prev.map(d => d.id === dish.id ? dish : d));
      try { await db.updateDish(dish.id, dish); } catch (err) { console.error(err); invalidate(); }
    } else {
      try {
        const row = await db.insertDish(uid, dish);
        setDishes(prev => [...prev, row]);
      } catch (err) { console.error(err); }
    }
  };

  const deleteDish = async (dish) => {
    setDishes(prev => prev.filter(d => d.id !== dish.id));
    try { await db.deleteDish(dish.id); } catch (err) { console.error(err); invalidate(); }
  };

  const applyInbody = (logs) => {
    setInbodyLogs(logs);
    setHistory(logs.map(l => ({ date: l.date, weight: l.weight, fatPercent: l.fatPercent, musclePercent: l.musclePercent })));
  };

  const saveInbody = async (entry) => {
    // DECISION: бросаем ошибку наверх — UI покажет честный toast вместо ложного «✓ добавлен»
    const saved = await db.upsertInBodyLog(uid, entry);
    // локальный id из редактора заменяем на реальный uuid строки из БД;
    // если запись с entry.id в списке нет (например, удалена в другой сессии) — добавляем saved
    const logs = inbodyLogs.some(l => l.id === entry.id)
      ? inbodyLogs.map(l => l.id === entry.id ? saved : l)
      : [...inbodyLogs.filter(l => l.id !== entry.id), saved];
    applyInbody(logs.sort((a, b) => new Date(a.date) - new Date(b.date)));
    return saved;
  };

  const deleteInbody = async (entry) => {
    try {
      await db.deleteInBodyLog(entry.id);
      applyInbody(inbodyLogs.filter(l => l.id !== entry.id));
    } catch (err) { console.error(err); }
  };

  const setGoalAndSave = async (g) => {
    // DECISION: до записи в БД ставим локальную копию с гарантированно числовым assessment.currentValue,
    // чтобы GoalTab не падал на undefined.toFixed, если строка БД вернётся без этого поля.
    const safeAssessment = {
      ...g.assessment,
      currentValue: Number.isFinite(+g.assessment?.currentValue) ? +g.assessment.currentValue
        : Number(baseline?.weight ?? baseline?.fatPercent ?? baseline?.musclePercent ?? 0),
    };
    setGoal({ ...g, assessment: safeAssessment });
    try {
      const saved = await db.saveGoal(uid, { ...g, assessment: safeAssessment }, baseline);
      if (saved) setGoal(saved);
    } catch (err) { console.error('saveGoal:', err); throw err; }
  };

  const updateBaseline = async (data) => {
    // онбординг/редактирование профиля: profiles + upsert сегодняшнего inbody_log
    try {
      await db.updateProfile(uid, {
        name: data.name || null, age: +data.age, gender: data.gender,
        height_cm: +data.height, activity_level: data.activityLevel,
      });
      const existingToday = inbodyLogs.find(l => String(l.date).slice(0, 10) === new Date().toISOString().slice(0, 10));
      const log = {
        id: existingToday?.id, date: new Date().toISOString(),
        weight: +data.weight, fatPercent: +data.fatPercent, musclePercent: +data.musclePercent,
        bmr: data.bmr || calculateBMR(+data.weight, +data.height, +data.age, data.gender),
        bmi: calcBMI(+data.weight, +data.height),
      };
      const saved = await db.upsertInBodyLog(uid, log);
      setProfile(await db.fetchProfile(uid));
      applyInbody(existingToday
        ? inbodyLogs.map(l => l.id === saved.id ? saved : l).sort((a, b) => new Date(a.date) - new Date(b.date))
        : [...inbodyLogs, saved]);
    } catch (err) { console.error(err); }
  };

  // ---------- производные значения (1:1 как в App прототипа) ----------
  const todayData = useMemo(() => {
    if (!baseline) return null;
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const dayStartTs = dayStart.getTime();
    const dayEndTs = dayStartTs + 24 * 3600e3;

    const todayFoods = foodLogs.filter(f => f.timestamp >= dayStartTs && f.timestamp < dayEndTs);
    const todayActs = activities.filter(a => a.timestamp >= dayStartTs && a.timestamp < dayEndTs);

    const macros = todayFoods.reduce((acc, f) => ({
      protein: acc.protein + (+f.protein || 0),
      fat: acc.fat + (+f.fat || 0),
      carbs: acc.carbs + (+f.carbs || 0)
    }), { protein: 0, fat: 0, carbs: 0 });
    const calC = todayFoods.reduce((s, f) => s + (+f.calories || 0), 0);
    const wCal = todayActs.filter(a => a.type === 'workout').reduce((s, a) => s + (+a.calories || 0), 0);

    const sleepH = activities.filter(a => {
      if (a.type !== 'sleep') return false;
      const start = a.timestamp;
      const end = start + (+a.hours || 0) * 3600e3;
      return end > dayStartTs && start < dayEndTs;
    }).reduce((s, a) => s + (+a.hours || 0), 0) || 8;

    const hasStr = todayActs.some(a => a.type === 'workout' && a.subtype === 'strength');
    const bmr = baseline.bmr || calculateBMR(baseline.weight, baseline.height, baseline.age, baseline.gender);
    const tdee = calculateTDEE(bmr, baseline.activityLevel, wCal, macros);
    const balance = calC - tdee;
    return { tdee, caloriesConsumed: calC, balance, macros, sleepHours: sleepH, hasStrength: hasStr };
  }, [baseline, foodLogs, activities]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const sim = useMemo(() => {
    if (!todayData) return null;
    return simulateDay(foodLogs, activities, todayData.balance);
  }, [foodLogs, activities, todayData?.balance, tick]);

  // DECISION: plan считается по симуляции за последние 7 дней (стабильный прогноз синтеза мышц),
  // а не по «50% от привеса» — иначе блок рядом с фигурой пустовал при похудении.
  const plan = useMemo(() => {
    const recentFoods = foodLogs.filter(f => f.timestamp >= Date.now() - 7*86400e3);
    const recentActs = activities.filter(a => a.timestamp >= Date.now() - 7*86400e3);
    return computePlan(goal, baseline, recentFoods, recentActs);
  }, [goal, baseline, foodLogs, activities]);

  return {
    loading, baseline, foodLogs, activities, dishes, goal, history, inbodyLogs,
    todayData, sim, plan,
    saveEntry, deleteEntry, saveDish, deleteDish, saveInbody, deleteInbody,
    setGoal: setGoalAndSave, updateBaseline,
  };
}
