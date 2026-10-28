import LineChart from './LineChart';

function ChartCard({ title, subtitle, data, color, id, goalLine, planData }) {
  const hasGoalLine = goalLine != null;
  const hasPlan = planData && planData.some(v => v != null && !isNaN(v));
  return (
    <div className="chart-card">
      <div className="chart-title">
        <span>{title} <span>{subtitle}</span></span>
        <div className="chart-legend">
          <div className="legend-item"><div className="legend-line" style={{ borderTopColor: color }} /><span style={{ color: 'var(--muted)' }}>факт</span></div>
          {hasPlan && <div className="legend-item"><div className="legend-line dashed" style={{ borderTopColor: '#eab308' }} /><span style={{ color: 'var(--muted)' }}>план</span></div>}
          {hasGoalLine && <div className="legend-item"><div className="legend-line dashed" style={{ borderTopColor: '#eab308', opacity: 0.5 }} /><span style={{ color: 'var(--muted)' }}>цель</span></div>}
        </div>
      </div>
      <LineChart id={id} data={data} color={color} goalLine={goalLine} planData={planData} />
    </div>
  );
}

export default ChartCard;
