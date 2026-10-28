function calcBMI(weight, heightCm) {
  if (!weight || !heightCm) return 0;
  return +(weight / Math.pow(heightCm / 100, 2)).toFixed(1);
}

export { calcBMI };
