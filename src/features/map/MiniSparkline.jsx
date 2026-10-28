
function MiniSparkline({ data, color = 'var(--fat)', width = 100, height = 28 }) {
  if (!data || data.length < 2) return null;
  const values = data.map(d => d.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((d.value - min) / range) * height
  }));
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
  const zeroY = height - ((0 - min) / range) * height;
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      {min < 0 && max > 0 && (
        <line x1="0" y1={zeroY} x2={width} y2={zeroY}
          stroke="var(--border)" strokeWidth="1" strokeDasharray="2 2" />
      )}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2" fill={color} />
    </svg>
  );
}

// ============================================================

export default MiniSparkline;
