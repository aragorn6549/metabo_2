import { useState, useMemo, useEffect, useRef } from 'react';

import { MET_COEFFICIENTS, calcMETCalories, toLocalIso, parseLocalIso, normalizeSleepWindow } from '@/lib/shared';
import { WORKOUT_NAMES, OTHER_NAMES } from '@/features/journal/entryMeta';
import NumberInput from '@/components/NumberInput';

const DAY_MS = 86400e3;

// ---------- Сон: форма с фактическими границами «заснул / проснулся» ----------
// Значения храним как datetime-local-строки в ЛОКАЛЬНОМ времени ('YYYY-MM-DDTHH:MM').
// Если wake <= fallAsleep — пробуждение на следующий день (переход суток), поэтому
// длительность считается корректно даже для ночи «15.11 23:09 → 16.11 08:23»,
// внесённой утром 16-го задним числом.
const defaultSleepForm = () => {
  const now = new Date();
  let wakeTs, sleepTs;
  if (now.getHours() >= 12) { wakeTs = now.getTime(); sleepTs = wakeTs - 8 * 3600e3; }
  else {
    const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0);
    wakeTs = Math.min(now.getTime(), todayMidnight.getTime() + 8 * 3600e3);
    sleepTs = wakeTs - 8 * 3600e3;
  }
  return {
    hours: 8, quality: 4,
    startStr: toLocalIso(sleepTs).slice(0, 16),
    endStr: toLocalIso(wakeTs).slice(0, 16),
    manualHours: false,
  };
};
const sleepWindowFromForm = (s) => {
  const w = normalizeSleepWindow(parseLocalIso(s.startStr), parseLocalIso(s.endStr));
  return w && w.hours > 0 && w.hours <= 24 ? w : null;
};
const editSleepForm = (e) => {
  // Границы выводим из записи: timestamp = пробуждение, hours = длительность.
  const ts = e.timestamp ?? Date.now();
  const hours = e.hours ?? 8;
  return {
    hours, quality: e.quality ?? 4,
    startStr: toLocalIso(ts - hours * 3600e3).slice(0, 16),
    endStr: toLocalIso(ts).slice(0, 16),
    manualHours: false,
  };
};

function ActivityLogger({ onClose, onSave, baseline, editingEntry, dishes }) {
  const [tab, setTab] = useState(editingEntry ? editingEntry.type : 'food');
  const [foodStep, setFoodStep] = useState(editingEntry?.type === 'food' ? 'edit' : 'pick');
  const [form, setForm] = useState(() => {
    const base = {
      food: { name:'', calories:0, protein:0, fat:0, carbs:0 },
      workout: { subtype:'strength', duration:60, calories:400 },
      sleep: defaultSleepForm(),
      other: { subtype:'walk', duration:30 }
    };
    if (!editingEntry) return base;
    if (editingEntry.type==='food') base.food = { name:editingEntry.name||'', calories:editingEntry.calories ?? 0, protein:editingEntry.protein ?? 0, fat:editingEntry.fat ?? 0, carbs:editingEntry.carbs ?? 0 };
    else if (editingEntry.type==='workout') base.workout = { subtype:editingEntry.subtype||'strength', duration:editingEntry.duration ?? 60, calories:editingEntry.calories ?? 0 };
    else if (editingEntry.type==='sleep') base.sleep = editSleepForm(editingEntry);
    else if (editingEntry.type==='other') base.other = { subtype:editingEntry.subtype||'walk', duration:editingEntry.duration ?? 30 };
    return base;
  });
  const tabs = [{id:'food',label:'🍽 Еда'},{id:'workout',label:'🏋️ Тренировка'},{id:'sleep',label:'😴 Сон'},{id:'other',label:'🚶 Прочее'}];
  const isSport = ['volleyball','padel','tennis','football','basketball'].includes(form.workout.subtype);

  const updateWorkout = (field, value) => {
    setForm(prev => {
      const w = { ...prev.workout, [field]: value };
      if (field==='subtype'||field==='duration') {
        if (['volleyball','padel','tennis','football','basketball'].includes(w.subtype) && w.duration) {
          w.calories = calcMETCalories(MET_COEFFICIENTS[w.subtype], baseline.weight, +w.duration);
        }
      }
      return { ...prev, workout: w };
    });
  };
  const update = (s, f, v) => setForm(prev => ({ ...prev, [s]: { ...prev[s], [f]: v } }));

  // Сон: любое изменение границ пересчитывает длительность (пока не включён ручной режим),
  // а любое изменение длительности сдвигает время пробуждения от засыпания.
  const updateSleep = (field, value) => {
    setForm(prev => {
      const s = { ...prev.sleep, [field]: value };
      if (field === 'startStr' || field === 'endStr') {
        const w = sleepWindowFromForm(s);
        if (w && !s.manualHours) s.hours = w.hours;
      } else if (field === 'hours') {
        s.manualHours = true;
        const startTs = parseLocalIso(s.startStr);
        if (Number.isFinite(startTs)) {
          const h = Math.max(0, Math.min(24, +value || 0));
          s.endStr = toLocalIso(startTs + h * 3600e3).slice(0, 16);
        }
      }
      return { ...prev, sleep: s };
    });
  };
  const useAutoHours = () => setForm(prev => {
    const s = { ...prev.sleep, manualHours: false };
    const w = sleepWindowFromForm(s);
    if (w) s.hours = w.hours;
    return { ...prev, sleep: s };
  });

  const selectDish = (d) => {
    // DECISION: помечаем dish_id — это блюдо из рациона; при сохранении в каталог
    // ничего не записываем (редактирование блюд — только во вкладке «Рацион»).
    setForm(prev => ({ ...prev, food: {
      dish_id: d.id,
      name: d.name,
      calories: d.calories,
      protein: d.protein,
      fat: d.fat,
      carbs: d.carbs
    }}));
    setFoodStep('edit');
  };

  const startNewDish = () => {
    // Временная еда «для себя»: НЕ попадёт в каталог рациона при сохранении.
    setForm(prev => ({ ...prev, food: { dish_id: null, name:'', calories:0, protein:0, fat:0, carbs:0 } }));
    setFoodStep('edit');
  };

  const NUMERIC_FIELDS = ['calories', 'protein', 'fat', 'carbs', 'duration', 'hours', 'quality'];

  // Ошибка валидации формы сна (показывается под полями границ)
  const [sleepError, setSleepError] = useState(null);

  const handleSubmit = () => {
    if (tab === 'sleep') {
      const s = form.sleep;
      const w = sleepWindowFromForm(s);
      if (!w) { setSleepError('Укажи корректные дата/время засыпания и пробуждения'); return; }
      setSleepError(null);
      const hours = Math.max(0, Math.min(24, +s.hours || 0));
      onSave({
        type: 'sleep', name: 'Сон',
        hours, quality: +s.quality || 0,
        // DECISION: в БД идут только длительность/качество; границы сна НЕ сохраняются
        // отдельными колонками (их нет в entries → был 400 PGRST204). Момент ПРОБУЖДЕНИЯ
        // = timestamp записи, засыпание выводится из длительности (см. sleepWindow).
        // Днём сна считается день пробуждения; timestamp = момент пробуждения.
        timestamp: w.end,
        // При редактировании сохраняем id — запись обновится (upsert), а не добавится новая.
        ...(editingEntry?.id ? { id: editingEntry.id } : {}),
      });
      return;
    }
    const raw = form[tab];
    const normalized = { ...raw };
    // BUGFIX: раньше сюда попадали и строковые поля (name). parseFloat('Куриная грудка') → NaN → 0,
    // из-за чего название приёма пищи терялось и в журнал/на главной странице писалось «0».
    // Теперь числовая нормализация применяется только к числовым полям, текст остаётся текстом.
    Object.keys(normalized).forEach(k => {
      if (!NUMERIC_FIELDS.includes(k)) return;
      const v = normalized[k];
      if (typeof v === 'number') return;
      if (typeof v === 'string' && v !== '') {
        const n = parseFloat(v.replace(',', '.'));
        normalized[k] = Number.isNaN(n) ? 0 : n;
      } else if (v === '' || v == null) {
        normalized[k] = 0;
      }
    });
    if (typeof normalized.name === 'string') normalized.name = normalized.name.trim();
    onSave({ ...normalized, type: tab, timestamp: editingEntry ? editingEntry.timestamp : Date.now() });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            {editingEntry?'Редактирование':'Добавить активность'}
            {editingEntry && <span className="badge">edit</span>}
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="logger-tabs">
          {tabs.map(t => (
            <button key={t.id} className={`logger-tab ${tab===t.id?'active':''}`}
              onClick={()=>setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="modal-body">
          {/* FOOD — pick step */}
          {tab==='food' && foodStep==='pick' && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                {(dishes && dishes.length > 0) ? 'Выбери блюдо из каталога' : 'Каталог пуст — добавь первое блюдо'}
              </div>
              {dishes && dishes.length > 0 && (
                <div className="dish-picker-list">
                  {dishes.map(d => (
                    <button key={d.id} className="dish-pick-item" onClick={() => selectDish(d)}>
                      <div className="dish-pick-name">{d.name}</div>
                      <div className="dish-pick-macros">
                        {Math.round(d.calories || 0)} ккал · Б {(+d.protein||0).toFixed(0)} · Ж {(+d.fat||0).toFixed(0)} · У {(+d.carbs||0).toFixed(0)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <button className="btn secondary" onClick={startNewDish}>+ Новое блюдо</button>
            </div>
          )}

          {/* FOOD — edit step */}
          {tab==='food' && foodStep==='edit' && (
            <div>
              {form.food.name && (
                <button className="btn secondary"
                  onClick={() => setFoodStep('pick')}
                  style={{ marginBottom: 12, padding: '8px 14px', width: 'auto', fontSize: 13 }}>
                  ← Изменить блюдо
                </button>
              )}
              <div className="form-grid">
                <div className="field full"><label>Название</label>
                  <input value={form.food.name} onChange={e=>update('food','name',e.target.value)} placeholder="Куриная грудка с рисом" autoFocus /></div>
                <div className="field"><label>Калории</label>
                  <NumberInput value={form.food.calories} onChange={v=>update('food','calories',v)} /></div>
                <div className="field"><label>Белки (г)</label>
                  <NumberInput value={form.food.protein} onChange={v=>update('food','protein',v)} /></div>
                <div className="field"><label>Жиры (г)</label>
                  <NumberInput value={form.food.fat} onChange={v=>update('food','fat',v)} /></div>
                <div className="field"><label>Углеводы (г)</label>
                  <NumberInput value={form.food.carbs} onChange={v=>update('food','carbs',v)} /></div>
              </div>
              {form.food.name && !(dishes || []).find(d => d.name.toLowerCase() === form.food.name.trim().toLowerCase()) && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, fontStyle: 'italic' }}>
                  💡 Новое блюдо будет добавлено в каталог
                </div>
              )}
            </div>
          )}

          {tab==='workout' && (
            <div className="form-grid">
              <div className="field full"><label>Тип тренировки</label>
                <select value={form.workout.subtype} onChange={e=>updateWorkout('subtype',e.target.value)}>
                  <option value="strength">Силовая</option><option value="cardio">Кардио</option>
                  <option value="volleyball">Волейбол (MET 4.0)</option>
                  <option value="padel">Падел (MET 6.0)</option>
                  <option value="tennis">Теннис (MET 7.0)</option>
                  <option value="football">Футбол (MET 7.0)</option>
                  <option value="basketball">Баскетбол (MET 6.5)</option>
                </select></div>
              <div className="field full"><label>Длительность (мин)</label>
                <NumberInput value={form.workout.duration} onChange={v=>updateWorkout('duration',v)} /></div>
              <div className="field full"><label>Калории {isSport?'· авто по МЕТ':'· из трекера'}</label>
                <NumberInput value={form.workout.calories} onChange={v=>update('workout','calories',v)} /></div>
            </div>
          )}
          {tab==='sleep' && (() => {
            const w = sleepWindowFromForm(form.sleep);
            return (
            <div>
              <div className="form-grid">
                <div className="field full"><label>Заснул (дата и время)</label>
                  <input type="datetime-local" value={form.sleep.startStr}
                    onChange={e=>updateSleep('startStr', e.target.value)} /></div>
                <div className="field full"><label>Проснулся (дата и время)</label>
                  <input type="datetime-local" value={form.sleep.endStr}
                    onChange={e=>updateSleep('endStr', e.target.value)} /></div>
                <div className="field full"><label>Длительность (часы) {w && !form.sleep.manualHours ? '· по границам сна' : ''}</label>
                  <NumberInput value={form.sleep.hours} onChange={v=>updateSleep('hours',v)} /></div>
                <div className="field full"><label>Качество (1-5)</label>
                  <NumberInput value={form.sleep.quality} onChange={v=>update('sleep','quality',v)} /></div>
              </div>
              {w ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                  😴 {w.hours.toFixed(2).replace(/\.?0+$/,'')} ч сна
                  {' · '}уснул {new Date(w.start).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                  {' → '}встал {new Date(w.end).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                  {w.end - w.start > DAY_MS - 3600e3 ? ' · ⚠ окно больше суток — проверь даты' : ''}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                  Заполни оба поля — длительность посчитается автоматически, даже если сон перешёл на следующий день.
                </div>
              )}
              {form.sleep.manualHours && w && Math.abs((+form.sleep.hours||0) - w.hours) > 0.05 && (
                <button className="btn secondary" onClick={useAutoHours}
                  style={{ marginTop: 8, padding: '8px 14px', width: 'auto', fontSize: 13 }}>
                  ⟳ Взять длительность из границ ({w.hours} ч)
                </button>
              )}
              {sleepError && <div style={{ fontSize: 12, color: '#f87171', marginTop: 8 }}>⚠ {sleepError}</div>}
            </div>
            );
          })()}
          {tab==='other' && (
            <div className="form-grid">
              <div className="field full"><label>Тип</label>
                <select value={form.other.subtype} onChange={e=>update('other','subtype',e.target.value)}>
                  <option value="walk">Прогулка</option>
                  <option value="work_sit">Работа сидячая</option>
                  <option value="work_stand">Работа стоячая</option>
                  <option value="chill">Спокойствие</option>
                </select></div>
              <div className="field full"><label>Длительность (мин)</label>
                <NumberInput value={form.other.duration} onChange={v=>update('other','duration',v)} /></div>
            </div>
          )}
          {!(tab==='food' && foodStep==='pick') && (
            <button className="btn" style={{ marginTop: 24 }} onClick={handleSubmit}>
              {editingEntry?'Сохранить изменения':'Сохранить'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


export default ActivityLogger;
