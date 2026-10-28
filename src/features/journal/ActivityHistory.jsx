import { useState, useMemo } from 'react';

import { formatDayLabel, plural } from '@/lib/shared';
import { entryEmoji, entryLabel, entryMeta, formatTime } from './entryMeta';

const TYPE_TITLES = { food: '🍽 Питание', workout: '🏋️ Тренировки', sleep: '😴 Сон', other: '🚶 Прочая активность' };

function ActivityHistory({ foodLogs, activities, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState({});

  const grouped = useMemo(() => {
    const map = {};
    [...foodLogs, ...activities].forEach(item => {
      const d = new Date(item.timestamp);
      d.setHours(0, 0, 0, 0);
      const key = d.toDateString();
      if (!map[key]) map[key] = { dateKey: key, dateObj: d, items: [] };
      map[key].items.push(item);
    });
    const arr = Object.values(map);
    arr.forEach(g => g.items.sort((a, b) => b.timestamp - a.timestamp));
    return arr.sort((a, b) => b.dateObj - a.dateObj);
  }, [foodLogs, activities]);

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !(prev[key] ?? (key === new Date().toDateString())) }));
  const todayKey = new Date().toDateString();

  if (grouped.length === 0) return null;
  const totalRecords = grouped.reduce((s, g) => s + g.items.length, 0);

  return (
    <div className="history-list">
      <div className="history-list-header">
        <div className="history-list-title">
          История активностей <span>· {grouped.length} {plural(grouped.length, ['день','дня','дней'])}</span>
        </div>
        <div className="history-list-count">{totalRecords} {plural(totalRecords, ['запись','записи','записей'])}</div>
      </div>
      {grouped.map(g => {
        const isToday = g.dateKey === todayKey;
        const isOpen = expanded[g.dateKey] ?? isToday;
        const byType = {
          food: g.items.filter(e => e.type === 'food'),
          workout: g.items.filter(e => e.type === 'workout'),
          sleep: g.items.filter(e => e.type === 'sleep'),
          other: g.items.filter(e => e.type === 'other')
        };
        const totalCals = byType.food.reduce((s, f) => s + (+f.calories || 0), 0);
        return (
          <div key={g.dateKey} className="history-day">
            <button className="history-day-header" onClick={() => toggle(g.dateKey)}>
              <div style={{ display:'flex', alignItems:'center', flex: 1, minWidth: 0 }}>
                <span className={`history-day-chevron ${isOpen ? 'open' : ''}`}>›</span>
                <span className="history-day-title">{isToday ? 'Сегодня' : formatDayLabel(g.dateObj)}</span>
                <span className="history-day-count">{g.items.length} {plural(g.items.length, ['запись','записи','записей'])}</span>
              </div>
              {totalCals > 0 && (
                <span className="history-day-summary">{Math.round(totalCals)} ккал</span>
              )}
            </button>
            {isOpen && (
              <div className="history-day-body">
                {['food','workout','sleep','other'].map(k => {
                  const items = byType[k];
                  if (items.length === 0) return null;
                  return (
                    <div key={k} className="entry-group">
                      <div className="entry-group-label">{TYPE_TITLES[k]}</div>
                      {items.map(entry => (
                        <div key={entry.id} className="entry-row">
                          <div className="entry-info">
                            <div className="entry-label">
                              {entryEmoji(entry)} {entryLabel(entry)}
                              <span style={{ color:'var(--muted)', fontSize: 12, fontWeight: 500, marginLeft: 8 }}>
                                {formatTime(entry.timestamp)}
                              </span>
                            </div>
                            <div className="entry-meta">{entryMeta(entry)}</div>
                          </div>
                          <div className="entry-actions">
                            <button onClick={() => onEdit(entry)} title="Редактировать">✎</button>
                            <button className="danger" onClick={() => onDelete(entry)} title="Удалить">×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ActivityHistory;
