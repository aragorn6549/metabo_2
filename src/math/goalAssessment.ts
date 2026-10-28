// DECISION: формулы скопированы из прототипа без изменений (ТЗ §6.4–6.5)
function computePlan(goal, baseline) {
  if (!goal || !goal.assessment) return null;
  if (!baseline) return null; // цель могла прийти из БД раньше, чем прогрузится baseline
  const days = Math.max(1, goal.assessment.daysAvailable);
  let fatPerDay = 0, musclePerDay = 0;
  if (goal.targetType === 'weight') {
    const dW = goal.targetValue - baseline.weight;
    if (dW < 0) fatPerDay = -dW * 1000 * 0.85 / days;
    else musclePerDay = dW * 1000 * 0.5 / days;
  } else if (goal.targetType === 'fatPercent') {
    const leanKg = baseline.weight * (1 - baseline.fatPercent / 100);
    const currFat = baseline.weight * baseline.fatPercent / 100;
    const targetFat = (goal.targetValue / 100) * leanKg / (1 - goal.targetValue / 100);
    fatPerDay = Math.max(0, (currFat - targetFat) * 1000 / days);
  } else if (goal.targetType === 'musclePercent') {
    const fatKg = baseline.weight * baseline.fatPercent / 100;
    const currMuscle = baseline.weight * baseline.musclePercent / 100;
    const targetMuscle = (goal.targetValue / 100) * fatKg / (1 - goal.targetValue / 100);
    musclePerDay = Math.max(0, (targetMuscle - currMuscle) * 1000 / days);
  }
  return { fatPerDay, musclePerDay, days };
}

function deriveGoalTargets(goal, baseline) {
  const cw = baseline.weight, cf = baseline.fatPercent, cm = baseline.musclePercent;
  const fatMassNow = cw * cf / 100;
  const muscleMassNow = cw * cm / 100;
  const leanMassNow = cw - fatMassNow;
  let targetWeight = cw, targetFatPct = cf, targetMusclePct = cm;
  if (goal.targetType === 'weight') {
    targetWeight = goal.targetValue;
    const dw = targetWeight - cw;
    const fatRatio = dw < 0 ? 0.75 : 0.5;
    const fatMassTarget = Math.max(0, fatMassNow + dw * fatRatio);
    const muscleMassTarget = Math.max(0, muscleMassNow + dw * (1 - fatRatio));
    targetFatPct = (fatMassTarget / targetWeight) * 100;
    targetMusclePct = (muscleMassTarget / targetWeight) * 100;
  } else if (goal.targetType === 'fatPercent') {
    targetFatPct = goal.targetValue;
    const fatMassTarget = (targetFatPct / 100) * leanMassNow / (1 - targetFatPct / 100);
    targetWeight = leanMassNow + fatMassTarget;
    targetMusclePct = (muscleMassNow / targetWeight) * 100;
  } else if (goal.targetType === 'musclePercent') {
    targetMusclePct = goal.targetValue;
    const muscleMassTarget = (targetMusclePct / 100) * cw;
    const deltaMuscle = muscleMassTarget - muscleMassNow;
    const fatMassTarget = Math.max(0, fatMassNow - deltaMuscle);
    targetWeight = cw;
    targetFatPct = (fatMassTarget / cw) * 100;
  }
  return { weight: targetWeight, fatPercent: targetFatPct, musclePercent: targetMusclePct };
}

function computePlanSeries(history, goal, baseline, field) {
  if (!goal || !goal.assessment) return null;
  const targets = deriveGoalTargets(goal, baseline);
  const startValue = baseline[field];
  const endValue = targets[field];
  if (startValue == null || endValue == null) return null;
  const startTime = goal.createdAt ? new Date(goal.createdAt).getTime() : Date.now();
  const endTime = new Date(goal.targetDate).getTime();
  const totalDuration = endTime - startTime;
  if (totalDuration <= 0) return null;
  return history.map(d => {
    const t = new Date(d.date).getTime();
    if (t < startTime) return null;
    const progress = Math.min(1, (t - startTime) / totalDuration);
    return startValue + (endValue - startValue) * progress;
  });
}

function getContextText(foodLogs, activities, now) {
  const ts = now.getTime();
  const hour = now.getHours() + now.getMinutes()/60;
  const isSleeping = hour >= 23 || hour < 7;
  const lastMeal = foodLogs.filter(m => m.timestamp <= ts).sort((a,b) => b.timestamp - a.timestamp)[0];
  const lastWorkout = activities.filter(a => a.type === 'workout' && a.timestamp <= ts)
    .sort((a,b) => b.timestamp - a.timestamp)[0];
  const parts = [];
  if (isSleeping) parts.push('🌙 Сон (голодание)');
  if (lastWorkout) {
    const hrs = (ts - lastWorkout.timestamp) / 3600e3;
    if (hrs < 3) parts.push(`🏋️ Тренировка ${hrs.toFixed(1)}ч назад`);
  }
  if (lastMeal) {
    const hrs = (ts - lastMeal.timestamp) / 3600e3;
    if (hrs < 2.5) parts.push(`🍽 Приём пищи ${hrs.toFixed(1)}ч назад`);
    else if (hrs > 6 && !isSleeping) parts.push(`⏱ Голод ${hrs.toFixed(0)}ч`);
  }
  return parts.join(' · ') || '⚪ В покое';
}

// ============================================================
// ОЦЕНКА ЦЕЛИ
function assessGoal({ targetType, targetValue, targetDate, baseline, tdee }) {
  const now = new Date(), end = new Date(targetDate);
  const days = Math.max(1, Math.ceil((end-now)/86400000));
  const weeks = days/7, months = days/30.4, cw = baseline.weight;
  let cur, delta, unit;
  if (targetType==='weight') { cur=cw; delta=targetValue-cw; unit='кг'; }
  else if (targetType==='fatPercent') { cur=baseline.fatPercent; delta=targetValue-baseline.fatPercent; unit='%'; }
  else { cur=baseline.musclePercent; delta=targetValue-baseline.musclePercent; unit='%'; }
  const dir = delta<0?'loss':delta>0?'gain':'maintain';
  let weekly, monthly, feasible, verdict, limitDesc;
  if (targetType==='weight'||targetType==='fatPercent') {
    const fatKg = Math.abs(targetType==='fatPercent' ? (targetValue-baseline.fatPercent)/100*cw : delta);
    weekly = fatKg/weeks; monthly = fatKg/months;
    const maxPct = cw*0.01, maxAbs = 1.0, maxF = Math.min(maxPct, maxAbs);
    feasible = weekly <= maxF + 0.05;
    limitDesc = `Максимум ~${maxF.toFixed(2)} кг жира/нед (${(maxPct/cw*100).toFixed(1)}% массы тела)`;
    verdict = feasible
      ? `Реалистично: ${weekly.toFixed(2)} кг/нед — в безопасном диапазоне (0.5–1% массы тела)`
      : `Слишком агрессивно: ${weekly.toFixed(2)} кг/нед против предела ~${maxF.toFixed(2)} кг/нед`;
  } else {
    const mKg = Math.abs((targetValue-baseline.musclePercent)/100*cw);
    monthly = mKg/months; weekly = mKg/weeks;
    const maxM = cw*0.015;
    feasible = monthly <= maxM*1.05;
    limitDesc = `Максимум ~${maxM.toFixed(2)} кг мышц/мес (1.5% массы тела)`;
    verdict = feasible
      ? `Реалистично: ${monthly.toFixed(2)} кг/мес — в пределах возможного`
      : `Слишком агрессивно: ${monthly.toFixed(2)} кг/мес, новички редко превышают ${maxM.toFixed(2)} кг/мес`;
  }
  let dAdj = 0;
  if (dir==='loss') {
    dAdj = -(weekly*7700)/7;
    dAdj = Math.max(-tdee*0.25, Math.min(-tdee*0.15, dAdj));
    if (!feasible) dAdj = -tdee*0.25;
  } else if (dir==='gain' && targetType==='musclePercent') dAdj = feasible ? 200 : 300;
  let realDate = end;
  if (!feasible) {
    const ratePerDay = (targetType==='weight'||targetType==='fatPercent')
      ? Math.min(cw*0.01, 1.0)/7 : (cw*0.015)/30.4;
    const deltaKg = Math.abs(targetType==='fatPercent' ? (targetValue-baseline.fatPercent)/100*cw
      : targetType==='musclePercent' ? (targetValue-baseline.musclePercent)/100*cw : delta);
    realDate = new Date(now.getTime() + Math.ceil(deltaKg/ratePerDay)*86400000);
  }
  const tCal = Math.round(tdee + dAdj);
  const ppk = dir==='loss' ? 2.0 : 1.8;
  const tProt = Math.round(cw*ppk);
  const tFat = Math.round((tCal*0.25)/9);
  const tCarb = Math.max(0, Math.round((tCal - tProt*4 - tFat*9)/4));
  return { isFeasible: feasible, verdict, direction: dir, targetType, targetValue, targetUnit: unit,
    currentValue: cur, targetDelta: delta, dailyCalorieAdjustment: Math.round(dAdj),
    targetCalories: tCal, targetProtein: tProt, targetFat: tFat, targetCarbs: tCarb,
    weeklyRateNeeded: weekly, monthlyRateNeeded: monthly, limitDescription: limitDesc,
    realisticDate: !feasible ? realDate : end, daysAvailable: days, originalDate: end };
}

// ============================================================
// AUTH

export { computePlan, deriveGoalTargets, computePlanSeries, getContextText, assessGoal };
