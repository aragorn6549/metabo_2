const MET_COEFFICIENTS = { volleyball:4.0, padel:6.0, tennis:7.0, football:7.0, basketball:6.5 };
function calcMETCalories(met, w, min) { return Math.round(met * w * (min/60)); }

export { MET_COEFFICIENTS, calcMETCalories };
