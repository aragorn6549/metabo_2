function calculateTEF(p, c, f) { return p*4*0.3 + c*4*0.1 + f*9*0.03; }
const ACTIVITY_COEFFICIENTS = { sedentary:1.2, light:1.375, moderate:1.55, high:1.725, extreme:1.9 };
function calculateTDEE(bmr, level, workoutCal, m) {
  const c = ACTIVITY_COEFFICIENTS[level] || 1.375;
  return bmr * c + calculateTEF(m.protein||0, m.carbs||0, m.fat||0) + workoutCal;
}
const MET_COEFFICIENTS = { volleyball:4.0, padel:6.0, tennis:7.0, football:7.0, basketball:6.5 };

export { calculateTEF, ACTIVITY_COEFFICIENTS, calculateTDEE };
