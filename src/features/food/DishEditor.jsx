import { useState } from 'react';

import NumberInput from '@/components/NumberInput';

function DishEditor({ dish, onSave, onClose }) {
  const isEdit = !!dish?.id;
  const [form, setForm] = useState(dish || { name: '', calories: 0, protein: 0, fat: 0, carbs: 0 });
  const [err, setErr] = useState('');
  const update = (f, v) => setForm(prev => ({ ...prev, [f]: v }));
  const handleSubmit = () => {
    if (!form.name || !form.name.trim()) { setErr('Укажите название блюда'); return; }
    setErr('');
    const cleaned = {
      ...form,
      name: form.name.trim(),
      calories: +form.calories || 0,
      protein: +form.protein || 0,
      fat: +form.fat || 0,
      carbs: +form.carbs || 0
    };
    onSave(cleaned);
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Редактировать блюдо' : 'Новое блюдо'}</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field full">
              <label>Название</label>
              <input value={form.name} onChange={e => update('name', e.target.value)}
                placeholder="Овсянка с бананом" autoFocus />
            </div>
            <div className="field"><label>Калории</label>
              <NumberInput value={form.calories} onChange={v => update('calories', v)} /></div>
            <div className="field"><label>Белки (г)</label>
              <NumberInput value={form.protein} onChange={v => update('protein', v)} /></div>
            <div className="field"><label>Жиры (г)</label>
              <NumberInput value={form.fat} onChange={v => update('fat', v)} /></div>
            <div className="field"><label>Углеводы (г)</label>
              <NumberInput value={form.carbs} onChange={v => update('carbs', v)} /></div>
          </div>
          {err && <div className="auth-error" style={{ marginBottom: 16 }}>⚠ {err}</div>}
          <button className="btn" style={{ marginTop: 8 }} onClick={handleSubmit}>
            {isEdit ? 'Сохранить изменения' : 'Добавить блюдо'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ИСТОРИЯ ПО ДНЯМ

export default DishEditor;
