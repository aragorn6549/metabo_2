import { useState, useMemo } from 'react';
import NumberInput from '@/components/NumberInput';
import { calculateBMR } from '@/lib/shared';

// DECISION: форма 1:1 из прототипа (Onboarding); демо-кнопка удалена (ТЗ §5.1).
// onComplete отдаёт форму + bmr — сохранение в profiles + первый inbody_log делает store.updateBaseline (ТЗ §5.2).
export default function OnboardingScreen({ initial, onComplete, onCancel }) {
  const [form, setForm] = useState(initial || {
    name: '', age: 30, gender: 'male', height: 178, weight: 78,
    fatPercent: 18, musclePercent: 42, activityLevel: 'moderate',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const bmr = useMemo(() => calculateBMR(+form.weight, +form.height, +form.age, form.gender), [form]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.age || !form.height || !form.weight) { setErr('Заполните возраст, рост и вес'); return; }
    setErr(''); setBusy(true);
    try { await onComplete({ ...form, bmr }); } finally { setBusy(false); }
  };

  return (
    <div className="onboarding">
      <h1>{initial ? 'Обновить данные' : 'Metabo'}</h1>
      <p>{initial ? 'Внеси свежие данные InBody.' : 'Введи данные последнего замера InBody.'}</p>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field full"><label>Имя</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Александр" /></div>
          <div className="field"><label>Возраст</label>
            <NumberInput value={form.age} onChange={v => set('age', v)} /></div>
          <div className="field"><label>Пол</label>
            <select value={form.gender} onChange={e => set('gender', e.target.value)}>
              <option value="male">Мужской</option><option value="female">Женский</option>
            </select></div>
          <div className="field"><label>Рост (см)</label>
            <NumberInput value={form.height} onChange={v => set('height', v)} /></div>
          <div className="field"><label>Вес (кг)</label>
            <NumberInput value={form.weight} onChange={v => set('weight', v)} /></div>
          <div className="field"><label>% жира</label>
            <NumberInput value={form.fatPercent} onChange={v => set('fatPercent', v)} /></div>
          <div className="field"><label>% мышц</label>
            <NumberInput value={form.musclePercent} onChange={v => set('musclePercent', v)} /></div>
          <div className="field full"><label>Уровень активности</label>
            <select value={form.activityLevel} onChange={e => set('activityLevel', e.target.value)}>
              <option value="sedentary">Сидячий</option>
              <option value="light">Лёгкая (1-3 дня/нед)</option>
              <option value="moderate">Умеренная (3-5)</option>
              <option value="high">Высокая (6-7)</option>
              <option value="extreme">Экстремальная</option>
            </select></div>
        </div>
        {err && <div className="auth-error" style={{ marginBottom: 16 }}>⚠ {err}</div>}
        <div className="stat-card" style={{ marginBottom: 20 }}>
          <div className="stat-label">BMR · Миффлин-Сан Жеор</div>
          <div className="stat-value">{Math.round(bmr)}<span className="stat-unit">ккал/день</span></div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {onCancel && <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={onCancel}>Отмена</button>}
          <button type="submit" className="btn" style={{ flex: 2 }} disabled={busy}>
            {busy ? 'Сохранение…' : initial ? 'Сохранить' : 'Начать'}
          </button>
        </div>
      </form>
    </div>
  );
}
