function calculateBMR(w, h, a, g) {
  if (!w || !h || !a) return 0;
  const b = 10*w + 6.25*h - 5*a;
  return g==='male' ? b+5 : b-161;
}

export { calculateBMR };
