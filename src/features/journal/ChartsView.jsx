import { useState, useMemo } from 'react';

import { computePlanSeries, formatSigned } from '@/lib/shared';
import ChartCard from './ChartCard';

function ChartsView({ history, goal, baseline, sim, todayData }) {
  const [filter, setFilter] = useState('week');
  const data = useMemo(() => {
    const days = filter==='week'?7:filter==='month'?30:1;
    return history.slice(-days);
  }, [history, filter]);
  if (history.length < 2) {
    return (
      <div className="journal">
        <div className="journal-filters">
          {['day','week','month'].map(f => (
            <button key={f} className={`filter-btn ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>
              {f==='day'?'День':f==='week'?'Неделя':'Месяц'}
            </button>
          ))}
        </div>
        <div className="empty-state"><h3>Мало данных</h3><p>Добавь активности для аналитики</p></div>
      </div>
    );
  }
  const fmt = d => new Date(d.date).toLocaleDateString('ru-RU', { day:'numeric', month:'short' });

  const currentDayEntry = sim && todayData && baseline ? {
    date: new Date().toISOString(),
    weight: baseline.weight, fatPercent: baseline.fatPercent, musclePercent: baseline.musclePercent,
    caloriesConsumed: todayData.caloriesConsumed, balance: todayData.balance,
    fatOxidized: sim.fatOxidized, fatStored: sim.fatStored, muscleNet: Math.max(0, sim.muscleToday)
  } : null;

  const allData = currentDayEntry ? [...data, currentDayEntry] : data;

  const gw = goal && goal.targetType==='weight' ? goal.targetValue : null;
  const gf = goal && goal.targetType==='fatPercent' ? goal.targetValue : null;
  const gm = goal && goal.targetType==='musclePercent' ? goal.targetValue : null;
  const planW = goal ? computePlanSeries(allData, goal, baseline, 'weight') : null;
  const planF = goal ? computePlanSeries(allData, goal, baseline, 'fatPercent') : null;
  const planM = goal ? computePlanSeries(allData, goal, baseline, 'musclePercent') : null;

  const hasLipidData = allData.some(d => d.fatOxidized != null);
  const hasMuscleNetData = allData.some(d => d.muscleNet != null);

  return (
    <div className="journal">
      <div className="journal-filters">
        {['day','week','month'].map(f => (
          <button key={f} className={`filter-btn ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>
            {f==='day'?'День':f==='week'?'Неделя':'Месяц'}
          </button>
        ))}
      </div>
      <ChartCard title="Вес" subtitle="· кг" id="w"
        data={allData.map(d=>({ label:fmt(d), value:d.weight }))}
        color="#8b5cf6" goalLine={gw} planData={planW} />
      <ChartCard title="% жира" subtitle="· динамика" id="f"
        data={allData.map(d=>({ label:fmt(d), value:d.fatPercent }))}
        color="#f97316" goalLine={gf} planData={planF} />
      <ChartCard title="% мышц" subtitle="· динамика" id="m"
        data={allData.map(d=>({ label:fmt(d), value:d.musclePercent }))}
        color="#3b82f6" goalLine={gm} planData={planM} />

      {hasLipidData && (
        <>
          <ChartCard title="🔥 Липолиз" subtitle="· окисление жира, г/день" id="fo"
            data={allData.map(d=>({ label:fmt(d), value: d.fatOxidized || 0 }))}
            color="#f97316" />
          <ChartCard title="🔴 Липогенез" subtitle="· отложение жира, г/день" id="fs"
            data={allData.map(d=>({ label:fmt(d), value: d.fatStored || 0 }))}
            color="#dc2626" />
        </>
      )}

      {hasMuscleNetData && (
        <ChartCard title="💪 Синтез мышц (net)" subtitle="· г/день" id="mn"
          data={allData.map(d=>({ label:fmt(d), value: d.muscleNet || 0 }))}
          color="#3b82f6" />
      )}

      <div className="chart-card">
        <div className="chart-title"><span>Энергобаланс <span>· ккал/день</span></span></div>
        <LineChart id="b" data={allData.map(d=>({ label:fmt(d), value:d.balance }))} color="#22c55e" />
      </div>
      <div className="chart-card" style={{ overflowX:'auto' }}>
        <table className="log-table">
          <thead><tr>
            <th>Дата</th><th>Вес</th><th>% жира</th><th>% мышц</th>
            <th>Ккал</th><th>Баланс</th>
            {hasLipidData && <><th>Липолиз</th><th>Липогенез</th></>}
          </tr></thead>
          <tbody>
            {allData.slice().reverse().map((d,i) => (
              <tr key={i}>
                <td>{fmt(d)}</td><td>{d.weight.toFixed(1)}</td>
                <td style={{ color:'#f97316' }}>{d.fatPercent.toFixed(1)}%</td>
                <td style={{ color:'#3b82f6' }}>{d.musclePercent.toFixed(1)}%</td>
                <td>{Math.round(d.caloriesConsumed)}</td>
                <td style={{ color:d.balance<0?'#f97316':'#22c55e' }}>{formatSigned(d.balance)}</td>
                {hasLipidData && <>
                  <td style={{ color: '#f97316' }}>{(d.fatOxidized || 0).toFixed(0)} г</td>
                  <td style={{ color: '#dc2626' }}>{(d.fatStored || 0).toFixed(0)} г</td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ChartsView;
