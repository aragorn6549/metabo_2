
function InBodyValue({ label, value, delta, unit, color, decimals = 1 }) {
  let deltaEl = null;
  if (delta != null && Math.abs(delta) > 0.001) {
    const sign = delta > 0 ? '+' : '−';
    const abs = Math.abs(delta).toFixed(decimals);
    let cls = 'delta-neutral';
    if (color === 'normal') cls = delta > 0 ? 'delta-good' : 'delta-bad';
    else if (color === 'inverse') cls = delta < 0 ? 'delta-good' : 'delta-bad';
    deltaEl = <span className={`delta-badge ${cls}`}>{sign}{abs}{unit}</span>;
  }
  return (
    <div className="inbody-value-box">
      <div className="inbody-value-label">{label}</div>
      <div className="inbody-value-main">
        <span className="inbody-value-number">{value}</span>
        {deltaEl}
      </div>
    </div>
  );
}

export default InBodyValue;
