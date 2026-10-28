// DECISION: единая точка импорта математики/утилит для компонентов (1:1 с областью видимости прототипа).
export { calculateBMR } from '@/math/bmr';
export { calculateTEF, ACTIVITY_COEFFICIENTS, calculateTDEE } from '@/math/tdee';
export { MET_COEFFICIENTS, calcMETCalories } from '@/math/met';
export { calcBMI } from '@/math/bmi';
export { computeHourlyRate, simulateDay } from '@/math/simulation';
export { computePlan, deriveGoalTargets, computePlanSeries, getContextText, assessGoal } from '@/math/goalAssessment';
export { formatSigned, genId, formatTimer, plural, formatDayLabel } from '@/lib/utils';
