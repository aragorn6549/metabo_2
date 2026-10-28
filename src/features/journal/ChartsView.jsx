import { useState, useMemo } from 'react';

import { computePlanSeries, formatSigned } from '@/lib/shared';
import ChartCard from './ChartCard';
import LineChart from './LineChart';

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

  // DECISION: «сегодня» добавляем только если ещё нет замера InBody на сегодня —
  // иначе вчерашний замер ложно помечается как текущий и точка дублируется
  const hasTodayInHistory = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return history.some(h => String(h.date).slice(0, 10) === todayKey);
  }, [history]);

  const currentDayEntry = sim && todayData && baseline && !hasTodayInHistory ? {
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
                <td>{fmt(d)}</td><td>{(+d.weight || 0).toFixed(1)}</td>
                <td style={{ color:'#f97316' }}>{(+d.fatPercent || 0).toFixed(1)}%</td>
                <td style={{ color:'#3b82f6' }}>{(+d.musclePercent || 0).toFixed(1)}%</td>
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

      {/* DECISION: нижняя графа «Рекомендации» (ТЗ §7.4) — раньше отсутствовала entirely */}
      <Recommendations history={history} goal={goal} baseline={baseline} sim={sim} todayData={todayData} />
    </div>
  );
}

function Recommendations({ history, goal, baseline, sim, todayData }) {
  const items = useMemo(() => {
    const out = [];
    if (!todayData || !baseline) return out;
    const { balance, macros, sleepHours, caloriesConsumed } = todayData;
    const target = goal?.assessment || null;

    // Белок
    const proteinPerKg = baseline.weight > 0 ? macros.protein / baseline.weight : 0;
    if (caloriesConsumed > 0) {
      if (proteinPerKg < 1.2) {
        out.push({ icon: '🥩', text: `Белка мало: ${macros.protein.toFixed(0)} г (${proteinPerKg.toFixed(1)} г/кг). Цель — не менее 1.6 г/кг (~${Math.round(baseline.weight*1.6)} г), это защищает мышцы в дефиците.` });
      } else if (proteinPerKg >= 1.6) {
        out.push({ icon: '✅', text: `Белка достаточно: ${proteinPerKg.toFixed(1)} г/кг — отлично для сохранения мышц.` });
      }
    }

    // Баланс относительно плана цели
    if (target) {
      const planBal = target.dailyCalorieAdjustment;
      if (balance < planBal - 300) {
        out.push({ icon: '⚠️', text: `Дефицит слишком большой (${Math.round(balance)} ккал против плана ${planBal} ккал). Сильный дефицит гасит синтез мышц и сжигает мышечную ткань — добавь приём пищи.` });
      } else if (planBal < 0 && balance > 200) {
        out.push({ icon: '🍽', text: `Цель — дефицит ${planBal} ккал/день, но сегодня баланс +${Math.round(balance)}. Урежь порции или добавь активность.` });
      } else if (Math.abs(balance - planBal) <= 300) {
        out.push({ icon: '🎯', text: `Энергобаланс сегодня (${Math.round(balance)} ккал) соответствует плану цели (${planBal} ккал). Так держать!` });
      }
    }

    // Сон
    if (sleepHours < 7) {
      out.push({ icon: '😴', text: `Сон ${sleepHours.toFixed(1)} ч — меньше 7 ч. Недосып повышает кортизол и MPB (распад мышц) и тормозит восстановление.` });
    } else {
      out.push({ icon: '😴', text: `Сон ${sleepHours.toFixed(1)} ч — достаточно для восстановления и синтеза мышц.` });
    }

    // Тренировки / MPS
    if (sim) {
      if (!todayData.hasStrength && balance > 0) {
        out.push({ icon: '🏋️', text: 'Профицит без силовой тренировки: излишки скорее уйдут в жир. Силовая перенаправляет энергию в синтез мышц.' });
      }
      if (sim.muscleToday < -5) {
        out.push({ icon: '📉', text: `Чистый баланс мышц за день ${sim.muscleToday.toFixed(1)} г (катаболизм). Ешь белок каждые 3–4 часа и не допускай голодания >9 ч.` });
      } else if (sim.muscleToday > 5) {
        out.push({ icon: '💪', text: `Синтез мышц опережает распад: net +${sim.muscleToday.toFixed(1)} г за день. Условия для роста созданы.` });
      }
    }

    // Динамика веса vs цель
    if (history.length >= 2 && goal) {
      const first = history[0], last = history[history.length-1];
      const days = Math.max(1, Math.round((new Date(last.date) - new Date(first.date)) / 86400e3));
      const dW = last.weight - first.weight;
      if (goal.targetType === 'weight' && dW !== 0) {
        const dirGoal = goal.targetValue - baseline.weight;
        if (dirGoal < 0 && dW > 0.1) out.push({ icon: '⚖️', text: `За ${days} дн. вес вырос на ${dW.toFixed(1)} кг при цели «вниз». Пересмотри план питания.` });
        if (dirGoal > 0 && dW < -0.1) out.push({ icon: '⚖️', text: `За ${days} дн. вес упал на ${Math.abs(dW).toFixed(1)} кг при цели «набор». Нужен больший профицит.` });
        if (dirGoal < 0 && dW < -0.1) out.push({ icon: '📉', text: `Динамика совпадает с целью: −${Math.abs(dW).toFixed(1)} кг за ${days} дн.` });
        if (dirGoal > 0 && dW > 0.1) out.push({ icon: '📈', text: `Динамика совпадает с целью: +${dW.toFixed(1)} кг за ${days} дн.` });
      }
    }
    return out;
  }, [history, goal, baseline, sim, todayData]);

  if (items.length === 0) {
    return (
      <div className="chart-card">
        <div className="chart-title"><span>💡 Рекомендации <span>· на основе данных</span></span></div>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
          Пока мало данных для выводов. Добавь приёмы пищи, сон и хотя бы два замера InBody — здесь появятся персональные рекомендации.
        </p>
      </div>
    );
  }
  return (
    <div className="chart-card">
      <div className="chart-title"><span>💡 Рекомендации <span>· на основе журнала и цели</span></span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.5 }}>
            <span style={{ flexShrink: 0 }}>{it.icon}</span>
            <span style={{ color: 'var(--text)' }}>{it.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChartsView;
