
function LineChart({ data, color='#8b5cf6', height=200, id, goalLine, planData }) {
  const width = 600, pad = { top:15, right:20, bottom:30, left:45 };
  const innerW = width-pad.left-pad.right, innerH = height-pad.top-pad.bottom;
  if (data.length < 2) return <div className="empty-state" style={{ padding:30 }}>Недостаточно данных</div>;
  const planValues = planData ? planData.filter(v => v != null && !isNaN(v)) : [];
  const all = [...data.map(d=>d.value), ...(goalLine!=null?[goalLine]:[]), ...planValues];
  const minV = Math.min(...all), maxV = Math.max(...all);
  const range = (maxV-minV)||1, minY = minV-range*0.15, maxY = maxV+range*0.15;
  const points = data.map((d,i) => ({
    x: pad.left + (i/(data.length-1))*innerW,
    y: pad.top + (1-(d.value-minY)/(maxY-minY))*innerH, ...d
  }));
  const pathD = points.map((p,i)=>(i===0?'M':'L')+` ${p.x} ${p.y}`).join(' ');
  const areaD = pathD + ` L ${points[points.length-1].x} ${pad.top+innerH} L ${pad.left} ${pad.top+innerH} Z`;
  const goalY = goalLine!=null ? pad.top+(1-(goalLine-minY)/(maxY-minY))*innerH : null;
  let planPathD = null;
  if (planData && planValues.length >= 2) {
    const pts = [];
    planData.forEach((val, i) => {
      if (val == null || isNaN(val)) return;
      pts.push({
        x: pad.left + (i / (data.length - 1)) * innerW,
        y: pad.top + (1 - (val - minY) / (maxY - minY)) * innerH
      });
    });
    if (pts.length >= 2) {
      planPathD = pts.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x} ${p.y}`).join(' ');
    }
  }
  const zeroY = minY < 0 && maxY > 0 ? pad.top + (1 - (0 - minY) / (maxY - minY)) * innerH : null;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="line-chart">
      <defs><linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.3" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      {[0,0.25,0.5,0.75,1].map(t => {
        const y = pad.top+t*innerH, val = maxY-t*(maxY-minY);
        return (<g key={t}>
          <line className="chart-grid" x1={pad.left} y1={y} x2={width-pad.right} y2={y} />
          <text className="chart-axis-label" x={pad.left-8} y={y+3} textAnchor="end">{val.toFixed(1)}</text>
        </g>);
      })}
      {zeroY != null && (
        <line x1={pad.left} y1={zeroY} x2={width-pad.right} y2={zeroY}
          stroke="var(--border)" strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />
      )}
      {goalY!=null && goalY>=pad.top && goalY<=pad.top+innerH && (
        <g>
          <line x1={pad.left} y1={goalY} x2={width-pad.right} y2={goalY}
            stroke="#eab308" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.5" />
          <text x={width-pad.right-4} y={goalY-6} textAnchor="end" fill="#eab308"
            fontSize="10" fontWeight="700" fontFamily="inherit">ЦЕЛЬ {goalLine}</text>
        </g>
      )}
      {planPathD && (
        <path d={planPathD} fill="none" stroke="#eab308" strokeWidth="2"
          strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
      )}
      <path d={areaD} fill={`url(#grad-${id})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p,i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill={color} />
          {i % Math.ceil(points.length/7) === 0 && (
            <text className="chart-axis-label" x={p.x} y={height-8} textAnchor="middle">{p.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default LineChart;
