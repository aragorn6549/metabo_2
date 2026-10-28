// DECISION: формулы скопированы из прототипа без изменений (ТЗ §6)
function computeHourlyRate(hour, dayStartTs, foodLogs, activities, calorieBalance) {
  const isSleepingHour = hour >= 23 || hour < 7;
  const baseFat = 0.22;
  let insulinSuppression = 1.0;
  let insulinSignal = 0;

  for (const meal of foodLogs) {
    const hoursSince = hour - (meal.timestamp - dayStartTs) / 3600e3;
    if (hoursSince < 0 || hoursSince > 5) continue;
    const suppStrength = Math.min(0.9, 0.3 + (meal.carbs || 0) * 0.012 + (meal.calories || 0) / 2500);
    const decay = 1 - hoursSince / 5;
    insulinSuppression *= (1 - suppStrength * decay);
    const peak = hoursSince < 1 ? hoursSince : Math.max(0, 1 - (hoursSince - 1) / 4);
    const mealLoad = ((meal.carbs || 0) * 0.02 + (meal.fat || 0) * 0.03
                    + (meal.protein || 0) * 0.015 + (meal.calories || 0) / 1000);
    insulinSignal += mealLoad * peak;
  }

  const circadian = 0.6 + 0.55 * Math.cos((hour - 4) / 24 * 2 * Math.PI);
  let sleepBoost = isSleepingHour ? 1.4 : 1.0;
  for (const s of activities.filter(a => a.type === 'sleep')) {
    const startHour = (s.timestamp - dayStartTs) / 3600e3;
    const endHour = startHour + (s.hours || 8);
    if (hour >= startHour && hour <= endHour) sleepBoost = Math.max(sleepBoost, 1.45);
  }
  let exerciseBoost = 0;
  for (const w of activities.filter(a => a.type === 'workout')) {
    const hoursSince = hour - (w.timestamp - dayStartTs) / 3600e3;
    if (hoursSince < 0) continue;
    const cardioFactor = w.subtype === 'cardio' ? 1.0 : 0.35;
    const intensity = Math.min(1, (w.calories || 300) / 500);
    exerciseBoost += cardioFactor * intensity * Math.exp(-hoursSince / 2) * 0.9;
  }
  let deficitFactor;
  if (calorieBalance < 0) deficitFactor = 1 + Math.min(1.0, Math.abs(calorieBalance) / 600);
  else deficitFactor = Math.max(0.35, 1 - calorieBalance / 1200);
  const lipolysis = Math.max(0.01,
    (baseFat + exerciseBoost) * insulinSuppression * circadian * sleepBoost * deficitFactor);

  const baseEsterif = 0.10;
  const insulinDriven = insulinSignal * 3.5;
  const surplusFactor = calorieBalance > 0 ? Math.min(2.0, calorieBalance / 500) : 0;
  const dnl = surplusFactor * 0.4;
  const esterification = baseEsterif * (1 + insulinDriven) * (1 + surplusFactor) + dnl;
  const netFatFlux = lipolysis - esterification;

  const baseMps = 0.03;
  let mealMps = 0;
  for (const meal of foodLogs) {
    if ((meal.protein || 0) < 15) continue;
    const hoursSince = hour - (meal.timestamp - dayStartTs) / 3600e3;
    if (hoursSince < 0 || hoursSince > 3.5) continue;
    const intensity = Math.min(1, (meal.protein || 0) / 35);
    mealMps += intensity * 2.0 * (1 - hoursSince / 3.5);
  }
  let trainingBoost = 1.0;
  for (const w of activities.filter(a => a.type === 'workout' && a.subtype === 'strength')) {
    const hoursSince = hour - (w.timestamp - dayStartTs) / 3600e3;
    if (hoursSince < 0 || hoursSince > 36) continue;
    trainingBoost = Math.max(trainingBoost, 0.7 + 1.5 * Math.exp(-hoursSince / 10));
  }
  const sleepFactor = isSleepingHour ? 0.15 : 1.0;
  const energyFactor = calorieBalance < 0 ? 0.5 : 1.0;
  const mps = (baseMps + mealMps) * trainingBoost * sleepFactor * energyFactor;
  let mpb = 0.06;
  if (isSleepingHour) mpb = 0.13;
  let lastMealHour = -Infinity;
  for (const meal of foodLogs) {
    const mh = (meal.timestamp - dayStartTs) / 3600e3;
    if (mh <= hour && mh > lastMealHour) lastMealHour = mh;
  }
  const fastingHours = lastMealHour > -Infinity ? hour - lastMealHour : hour;
  if (fastingHours > 5) mpb *= 1.25;
  if (fastingHours > 9) mpb *= 1.15;
  const netMuscle = mps - mpb;

  return { lipolysis, esterification, netFatFlux, netMuscle };
}

function simulateDay(foodLogs, activities, calorieBalance) {
  const now = new Date();
  const dayStart = new Date(now); dayStart.setHours(0,0,0,0);
  const dayStartTs = dayStart.getTime();
  const currentHour = (now - dayStartTs) / 3600e3;
  const step = 0.25;
  let netFatToday = 0, fatOxidized = 0, fatStored = 0, muscleToday = 0;
  const snapshots = [];
  for (let h = 0; h <= currentHour + 1e-9; h += step) {
    const hh = Math.min(h, currentHour);
    const r = computeHourlyRate(hh, dayStartTs, foodLogs, activities, calorieBalance);
    snapshots.push({ hour: hh, ...r });
    if (snapshots.length > 1) {
      const prev = snapshots[snapshots.length - 2];
      const dh = hh - prev.hour;
      if (dh > 0) {
        netFatToday += (r.netFatFlux + prev.netFatFlux) / 2 * dh;
        fatOxidized += (r.lipolysis + prev.lipolysis) / 2 * dh;
        fatStored += (r.esterification + prev.esterification) / 2 * dh;
        muscleToday += (r.netMuscle + prev.netMuscle) / 2 * dh;
      }
    }
  }
  const current = snapshots[snapshots.length - 1] || {
    lipolysis: 0, esterification: 0, netFatFlux: 0, netMuscle: 0
  };
  return {
    currentLipolysis: current.lipolysis,
    currentEsterification: current.esterification,
    currentNetFatFlux: current.netFatFlux,
    currentMuscle: current.netMuscle,
    netFatToday, fatOxidized, fatStored, muscleToday,
    currentHour, snapshots
  };
}

export { computeHourlyRate, simulateDay };
