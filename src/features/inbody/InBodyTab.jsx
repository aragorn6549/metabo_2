import { formatDayLabel, plural } from '@/lib/shared';
import InBodyValue from './InBodyValue';

function InBodyTab({ inbodyLogs, baseline, onEdit, onDelete, onAdd }) {
  const sortedAsc = [...inbodyLogs].sort((a,b) => new Date(a.date) - new Date(b.date));
  const withDeltas = sortedAsc.map((log, i) => ({
    ...log,
    prev: i > 0 ? sortedAsc[i-1] : null
  }));
  const display = [...withDeltas].reverse();

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        gap: 12, flexWrap:'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Замеры InBody</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            {inbodyLogs.length} {plural(inbodyLogs.length, ['измерение','измерения','измерений'])} · дельты относительно предыдущего
          </div>
        </div>
        <button className="btn" style={{ width:'auto', padding: '10px 20px' }} onClick={onAdd}>+ Замер</button>
      </div>
      {display.length === 0 ? (
        <div className="empty-state">
          <h3>Пока нет замеров</h3>
          <p>Добавьте первый замер кнопкой «+ Замер»</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection: 'column', gap: 12 }}>
          {display.map((log, idx) => {
            const isCurrent = idx === 0;
            return (
              <div key={log.id} className="inbody-card">
                <div className="inbody-header">
                  <div>
                    <div className="inbody-date">
                      {formatDayLabel(new Date(log.date))}
                      {isCurrent && <span className="inbody-current-badge">текущий</span>}
                    </div>
                    <div className="inbody-date-full">
                      {new Date(log.date).toLocaleDateString('ru-RU', {day:'numeric', month:'long', year:'numeric'})}
                    </div>
                  </div>
                  <div className="entry-actions">
                    <button onClick={() => onEdit(log)} title="Редактировать">✎</button>
                    <button className="danger" onClick={() => onDelete(log)} title="Удалить">×</button>
                  </div>
                </div>
                <div className="inbody-values">
                  <InBodyValue label="Вес" value={`${(log.weight || 0).toFixed(1)} кг`}
                    delta={log.prev ? log.weight - log.prev.weight : null}
                    unit=" кг" color="neutral" decimals={1} />
                  <InBodyValue label="% жира" value={`${(log.fatPercent || 0).toFixed(1)}%`}
                    delta={log.prev ? log.fatPercent - log.prev.fatPercent : null}
                    unit="%" color="inverse" decimals={1} />
                  <InBodyValue label="% мышц" value={`${(log.musclePercent || 0).toFixed(1)}%`}
                    delta={log.prev ? log.musclePercent - log.prev.musclePercent : null}
                    unit="%" color="normal" decimals={1} />
                  <InBodyValue label="BMR" value={`${Math.round(log.bmr || 0)} ккал`}
                    delta={log.prev ? log.bmr - log.prev.bmr : null}
                    unit=" ккал" color="normal" decimals={0} />
                  <InBodyValue label="ИМТ" value={log.bmi != null ? log.bmi.toFixed(1) : '—'}
                    delta={log.prev && log.prev.bmi && log.bmi ? log.bmi - log.prev.bmi : null}
                    unit="" color="neutral" decimals={1} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default InBodyTab;
