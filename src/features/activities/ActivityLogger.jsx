import { useState, useMemo, useEffect, useRef } from 'react';

import { MET_COEFFICIENTS, calcMETCalories } from '@/lib/shared';
import { WORKOUT_NAMES, OTHER_NAMES } from '@/features/journal/entryMeta';
import NumberInput from '@/components/NumberInput';

function ActivityLogger({ onClose, onSave, baseline, editingEntry, dishes }) {
  const [tab, setTab] = useState(editingEntry ? editingEntry.type : 'food');
  const [foodStep, setFoodStep] = useState(editingEntry?.type === 'food' ? 'edit' : 'pick');
  const [form, setForm] = useState(() => {
    const base = {
      food: { name:'', calories:0, protein:0, fat:0, carbs:0 },
      workout: { subtype:'strength', duration:60, calories:400 },
      sleep: { hours:8, quality:4 },
      other: { subtype:'walk', duration:30 }
    };
    if (!editingEntry) return base;
    if (editingEntry.type==='food') base.food = { name:editingEntry.name||'', calories:editingEntry.calories ?? 0, protein:editingEntry.protein ?? 0, fat:editingEntry.fat ?? 0, carbs:editingEntry.carbs ?? 0 };
    else if (editingEntry.type==='workout') base.workout = { subtype:editingEntry.subtype||'strength', duration:editingEntry.duration ?? 60, calories:editingEntry.calories ?? 0 };
    else if (editingEntry.type==='sleep') base.sleep = { hours:editingEntry.hours ?? 8, quality:editingEntry.quality ?? 4 };
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

  const selectDish = (d) => {
    setForm(prev => ({ ...prev, food: {
      name: d.name,
      calories: d.calories,
      protein: d.protein,
      fat: d.fat,
      carbs: d.carbs
    }}));
    setFoodStep('edit');
  };

  const startNewDish = () => {
    setForm(prev => ({ ...prev, food: { name:'', calories:0, protein:0, fat:0, carbs:0 } }));
    setFoodStep('edit');
  };

  const handleSubmit = () => {
    const raw = form[tab];
    const normalized = { ...raw };
    Object.keys(normalized).forEach(k => {
      if (typeof normalized[k] === 'string' && normalized[k] !== '') {
        const n = parseFloat(normalized[k].replace(',', '.'));
        normalized[k] = Number.isNaN(n) ? 0 : n;
      } else if (normalized[k] === '') {
        normalized[k] = 0;
      }
    });
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
          {tab==='sleep' && (
            <div className="form-grid">
              <div className="field full"><label>Длительность (часы)</label>
                <NumberInput value={form.sleep.hours} onChange={v=>update('sleep','hours',v)} /></div>
              <div className="field full"><label>Качество (1-5)</label>
                <NumberInput value={form.sleep.quality} onChange={v=>update('sleep','quality',v)} /></div>
            </div>
          )}
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
