import { useState, useMemo } from 'react';

import { calculateBMR, genId } from '@/lib/shared';
import NumberInput from '@/components/NumberInput';

function InBodyEditor({ entry, baseline, onSave, onClose }) {
  const isEdit = !!entry?.id;
  const autoBmi = (w, h) => w > 0 && h > 0 ? +(w / Math.pow(h/100, 2)).toFixed(1) : 0;
  const [form, setForm] = useState(() => {
    if (entry) {
      const d = new Date(entry.date);
      const local = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return { ...entry, date: local };
    }
    return {
      date: new Date().toISOString().slice(0, 10),
      weight: baseline?.weight || 0,
      fatPercent: baseline?.fatPercent || 0,
      musclePercent: baseline?.musclePercent || 0,
      bmr: baseline?.bmr || calculateBMR(baseline?.weight, baseline?.height, baseline?.age, baseline?.gender),
      bmi: baseline?.bmi || autoBmi(baseline?.weight, baseline?.height)
    };
  });
  const [err, setErr] = useState('');
  const update = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

  const setWeight = (v) => {
    setForm(prev => ({
      ...prev,
      weight: v,
      bmi: (v > 0 && baseline?.height) ? autoBmi(+v, baseline.height) : prev.bmi
    }));
  };

  const handleSubmit = () => {
    if (!form.weight || !form.fatPercent) { setErr('Заполните вес и % жира'); return; }
    setErr('');
    const d = new Date(form.date + 'T12:00:00');
    onSave({
      id: entry?.id || genId(),
      date: d.toISOString(),
      weight: +form.weight,
      fatPercent: +form.fatPercent,
      musclePercent: +form.musclePercent,
      bmr: +form.bmr,
      bmi: +form.bmi
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Редактировать замер' : 'Новый замер InBody'}</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field full">
              <label>Дата</label>
              <input type="date" value={form.date} onChange={e => update('date', e.target.value)} />
            </div>
            <div className="field"><label>Вес (кг)</label>
              <NumberInput value={form.weight} onChange={setWeight} /></div>
            <div className="field"><label>% жира</label>
              <NumberInput value={form.fatPercent} onChange={v => update('fatPercent', v)} /></div>
            <div className="field"><label>% мышц</label>
              <NumberInput value={form.musclePercent} onChange={v => update('musclePercent', v)} /></div>
            <div className="field"><label>BMR (ккал)</label>
              <NumberInput value={form.bmr} onChange={v => update('bmr', v)} /></div>
            <div className="field full"><label>ИМТ</label>
              <NumberInput value={form.bmi} onChange={v => update('bmi', v)} /></div>
          </div>
          {err && <div className="auth-error" style={{ marginBottom: 16 }}>⚠ {err}</div>}
          <button className="btn" style={{ marginTop: 8 }} onClick={handleSubmit}>
            {isEdit ? 'Сохранить' : 'Добавить замер'}
          </button>
        </div>
      </div>
    </div>
  );
}


export default InBodyEditor;
