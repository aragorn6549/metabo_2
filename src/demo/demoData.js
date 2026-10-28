// DECISION: Демонстрационный режим (кнопка «Демонстрация» на экране входа).
// Полностью синтетические данные, сгенерированные детерминированно от текущей даты.
// НЕ использует Supabase/БД — все вычисления идут через ту же математику приложения
// (calculateBMR / calculateTDEE / simulateDay / assessGoal), что и в боевом режиме.
import { calculateBMR, calculateTDEE, calcBMI, simulateDay, assessGoal, computePlan } from '@/lib/shared';

const dayMs = 86400e3;

// ---------- детерминированный ГПСЧ ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- блюда справочника ----------
const DISHES = [
  { id: 'd1', name: 'Овсянка с бананом и мёдом', calories: 380, protein: 12, fat: 9, carbs: 62 },
  { id: 'd2', name: 'Омлет из 3 яиц с овощами', calories: 310, protein: 22, fat: 21, carbs: 5 },
  { id: 'd3', name: 'Куриная грудка гриль с гречкой', calories: 520, protein: 48, fat: 12, carbs: 52 },
  { id: 'd4', name: 'Творог 5% с ягодами', calories: 220, protein: 27, fat: 7, carbs: 12 },
  { id: 'd5', name: 'Сёмка запечённая с картофелем', calories: 560, protein: 38, fat: 24, carbs: 40 },
  { id: 'd6', name: 'Говяжий стейк с салатом', calories: 610, protein: 46, fat: 34, carbs: 10 },
  { id: 'd7', name: 'Протеиновый коктейль', calories: 180, protein: 30, fat: 3, carbs: 8 },
  { id: 'd8', name: 'Бурито с курицей и рисом', calories: 640, protein: 35, fat: 22, carbs: 72 },
];

const WORKOUTS = [
  { name: 'Силовая: грудь + трицепс', subtype: 'strength', duration_min: 65, calPerMin: 6.2 },
  { name: 'Силовая: спина + бицепс', subtype: 'strength', duration_min: 70, calPerMin: 6.4 },
  { name: 'Силовая: ноги', subtype: 'strength', duration_min: 75, calPerMin: 7.2 },
  { name: 'Бег 8 км', subtype: 'cardio', duration_min: 48, calPerMin: 10.5 },
  { name: 'Велотренажёр', subtype: 'cardio', duration_min: 40, calPerMin: 8.5 },
  { name: 'Волейбол', subtype: 'volleyball', duration_min: 80, calPerMin: 7.0 },
];

// варианты расписания приёмов пищи: [час, индекс блюда]
const DAY_MEALS = [
  [[8, 0], [12, 1], [16, 2], [21, 3]],
  [[7, 1], [13, 7], [19, 5], [22, 3]],
  [[9, 0], [14, 4], [18, 6], [21, 2]],
  [[8, 0], [11, 6], [15, 3], [19, 4], [22, 2]],
];

export function buildDemoData() {
  const rnd = mulberry32(Math.floor(Date.now() / dayMs)); // набор меняется раз в сутки, внутри дня стабилен
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const curHour = now.getHours() + now.getMinutes() / 60;

  // ---------- baseline ----------
  const profile = { name: 'Алексей Демо', age: 32, gender: 'male', height_cm: 182, activity_level: 'high' };
  const startWeight = 84.5, startFat = 22.5, startMuscle = 40.5;

  // ---------- замеры InBody: 8 точек за ~7 недель ----------
  const inbodyLogs = [];
  const logDaysAgo = [49, 42, 35, 28, 21, 14, 7, 1];
  logDaysAgo.forEach((ago, i) => {
    const p = i / (logDaysAgo.length - 1);
    const w = startWeight - p * 4.2 + (rnd() - 0.5) * 0.4;
    const f = startFat - p * 3.4 + (rnd() - 0.5) * 0.5;
    const m = startMuscle + p * 1.1 + (rnd() - 0.5) * 0.3;
    const d = new Date(todayStart.getTime() - ago * dayMs); d.setHours(9, 0, 0, 0);
    inbodyLogs.push({
      id: `ib-${i}`, date: d.toISOString(),
      weight: +w.toFixed(1), fatPercent: +f.toFixed(1), musclePercent: +m.toFixed(1),
      bmr: Math.round(calculateBMR(w, profile.height_cm, profile.age, profile.gender)),
      bmi: calcBMI(w, profile.height_cm),
    });
  });

  const baseline = {
    name: profile.name, age: profile.age, gender: profile.gender, height: profile.height_cm,
    activityLevel: profile.activity_level,
    weight: inbodyLogs.at(-1).weight, fatPercent: inbodyLogs.at(-1).fatPercent,
    musclePercent: inbodyLogs.at(-1).musclePercent, bmr: inbodyLogs.at(-1).bmr, bmi: inbodyLogs.at(-1).bmi,
  };

  // ---------- журнал еды/активностей за 21 день ----------
  const foodLogs = [], activities = [];
  let fid = 0, aid = 0;
  for (let ago = 20; ago >= 0; ago--) {
    const dayBase = todayStart.getTime() - ago * dayMs;
    const isToday = ago === 0;
    const meals = DAY_MEALS[Math.floor(rnd() * DAY_MEALS.length)];
    for (const [h, di] of meals) {
      if (isToday && h > curHour) continue; // сегодня — только то, что уже «случилось»
      const dish = DISHES[di];
      const scale = 0.85 + rnd() * 0.35;
      foodLogs.push({
        id: `f-${fid++}`, type: 'food', name: dish.name,
        timestamp: dayBase + h * 3600e3 + Math.floor(rnd() * 20) * 60e3,
        calories: Math.round(dish.calories * scale), protein: +(dish.protein * scale).toFixed(1),
        fat: +(dish.fat * scale).toFixed(1), carbs: +(dish.carbs * scale).toFixed(1),
      });
    }
    // сон
    const sleepH = 6.2 + rnd() * 2.2;
    activities.push({
      id: `a-${aid++}`, type: 'sleep', name: 'Сон', hours: +sleepH.toFixed(1),
      quality: sleepH >= 7 ? 4 : 3,
      timestamp: dayBase - (sleepH > 7 ? 1 : 0.5) * 3600e3,
    });
    // тренировки
    const dow = new Date(dayBase).getDay();
    const trainToday = ago % 2 === 0 || dow === 0 || dow === 6;
    if (trainToday && !(isToday && curHour < 18)) {
      const w = WORKOUTS[Math.floor(rnd() * WORKOUTS.length)];
      const startH = isToday ? Math.max(8, Math.min(curHour - 0.5, 18.5)) : 17 + rnd() * 2;
      activities.push({
        id: `a-${aid++}`, type: 'workout', subtype: w.subtype, name: w.name,
        duration_min: w.duration_min,
        calories: Math.round(w.duration_min * w.calPerMin * (0.9 + rnd() * 0.25)),
        timestamp: dayBase + startH * 3600e3,
      });
    }
  }

  // ---------- цель (реалистичное похудение) ----------
  const targetDate = new Date(todayStart.getTime() + 70 * dayMs).toISOString().slice(0, 10);
  const assessment = assessGoal({
    targetType: 'weight', targetValue: 78, targetDate, baseline,
    tdee: calculateTDEE(baseline.bmr, baseline.activityLevel, 400, { protein: 150, fat: 60, carbs: 250 }),
  });
  const goal = {
    id: 'goal-demo', targetType: 'weight', targetValue: 78, targetDate,
    assessment, createdAt: todayStart.getTime() - 21 * dayMs,
  };

  // ---------- history: дневные точки из замеров + симуляция по журналу ----------
  const history = inbodyLogs.map(log => {
    const dayStartTs = new Date(log.date); dayStartTs.setHours(0, 0, 0, 0);
    const dayEndTs = dayStartTs.getTime() + dayMs;
    const foods = foodLogs.filter(f => f.timestamp >= dayStartTs.getTime() && f.timestamp < dayEndTs);
    const acts = activities.filter(a => a.timestamp >= dayStartTs.getTime() - dayMs && a.timestamp < dayEndTs);
    const calC = foods.reduce((s, f) => s + (+f.calories || 0), 0);
    const macros = foods.reduce((acc, f) => ({
      protein: acc.protein + (+f.protein || 0), fat: acc.fat + (+f.fat || 0), carbs: acc.carbs + (+f.carbs || 0),
    }), { protein: 0, fat: 0, carbs: 0 });
    const wCal = acts.filter(a => a.type === 'workout').reduce((s, a) => s + (+a.calories || 0), 0);
    const tdee = calculateTDEE(log.bmr, baseline.activityLevel, wCal, macros);
    const balance = calC - tdee;
    const sim = simulateDay(foods, acts.filter(a => a.timestamp >= dayStartTs.getTime()), balance);
    return {
      date: log.date, weight: log.weight, fatPercent: log.fatPercent, musclePercent: log.musclePercent,
      caloriesConsumed: calC, balance,
      fatOxidized: sim.fatOxidized, fatStored: sim.fatStored, muscleNet: sim.muscleToday,
    };
  });

  // ---------- сегодняшние производные значения ----------
  const todayStartTs = todayStart.getTime();
  const todayFoods = foodLogs.filter(f => f.timestamp >= todayStartTs);
  const todayActs = activities.filter(a => a.timestamp >= todayStartTs);
  const macros = todayFoods.reduce((acc, f) => ({
    protein: acc.protein + (+f.protein || 0), fat: acc.fat + (+f.fat || 0), carbs: acc.carbs + (+f.carbs || 0),
  }), { protein: 0, fat: 0, carbs: 0 });
  const caloriesConsumed = todayFoods.reduce((s, f) => s + (+f.calories || 0), 0);
  const wCal = todayActs.filter(a => a.type === 'workout').reduce((s, a) => s + (+a.calories || 0), 0);
  const tdee = calculateTDEE(baseline.bmr, baseline.activityLevel, wCal, macros);
  const balance = caloriesConsumed - tdee;
  const sleepEntry = todayActs.find(a => a.type === 'sleep');
  const todayData = {
    tdee, caloriesConsumed, balance, macros,
    sleepHours: sleepEntry?.hours || 8,
    hasStrength: todayActs.some(a => a.type === 'workout' && a.subtype === 'strength'),
  };
  const sim = simulateDay(todayFoods, todayActs, balance);

  // DECISION: план цели через ту же функцию, что и боевой режим (в демо id не-pg-uuid — это нормально, БД не трогаем)
  const recentFoods = foodLogs.filter(f => f.timestamp >= Date.now() - 7 * dayMs);
  const recentActs = activities.filter(a => a.timestamp >= Date.now() - 7 * dayMs);
  const plan = computePlan(goal, baseline, recentFoods, recentActs);

  return {
    loading: false, demoNote: true,
    baseline, foodLogs, activities, dishes: DISHES, goal, history, inbodyLogs,
    todayData, sim, plan,
  };
}
