import { useState, useRef } from 'react';

import { assessGoal } from '@/lib/shared';
import NumberInput from '@/components/NumberInput';

const numOr = (v, d = 0) => { const n = +v; return Number.isFinite(n) ? n : d; };
const fmt = (v, d = 0, fb = '—') => { const n = +v; return Number.isFinite(n) ? n.toFixed(d) : fb; };

// DECISION: empty state вкладки «Цель». Если цель ещё не поставлена (первый запуск или
// удаление предыдущих целей), нижний блок НЕ рассчитывает оценку и НЕ показывает вердикты
// («Реалистично» / «Слишком агрессивно») — пользователь ещё не задал цель.
// Графа «Сейчас» берётся напрямую из замера InBody (baseline); «Цель», «Дневной профицит»,
// «Реалистичная дата», КБЖУ — прочерк. Расчёт и вердикт появляются только после «Рассчитать».
function GoalTab({ baseline, tdee, goal, plan, onSetGoal }) {
  // DECISION: без сохранённой цели поле «Значение» (goal-detail-value) подставляется
  // из последнего (или единственного) замера InBody по выбранному параметру.
  const baselineValueFor = (t) => {
    if (!baseline) return '';
    const v = t === 'weight' ? baseline.weight
      : t === 'fatPercent' ? baseline.fatPercent
      : baseline.musclePercent;
    const n = +v;
    return Number.isFinite(n) ? String(+n.toFixed(1)) : '';
  };
  // DECISION: если цель не задана — поле «Значение» ВСЕГДА отражает последний замер InBody.
  // Реализация — «управляемое значение с фолбэком»: localValue === null означает
  // «использовать последний замер». Как только baseline догрузился (или появился новый
  // замер / сменился параметр) — в поле автоматически подставляется его значение; ручной
  // ввод пользователя сохраняется в localValue и не перетирается, пока не изменится
  // параметр или сам замер. Предыдущие версии через useEffect были ненадёжны: NumberInput
  // отдаёт число, сравнение со строкой давало вечную «ложь», и эффект не вызывал setState.
  const hasGoalAssessment = !!goal?.assessment;
  const [targetType, setTargetType] = useState(goal?.targetType || 'weight');
  const [localValue, setLocalValue] = useState(null);

  const [targetDate, setTargetDate] = useState(() => {
    if (goal?.targetDate) return goal.targetDate.slice(0, 10);
    const d = new Date(); d.setMonth(d.getMonth()+3); return d.toISOString().slice(0, 10);
  });

  // DECISION: сброс ручного ввода — только при смене ПАРАМЕТРА или появлении НОВОГО замера
  // (baseline.id изменился). Раньше ключ включал baseline.date, а у каждого замера он новый —
  // любое касание стора (сохранение цели/замера → пересоздание объекта baseline) сбрасывало
  // поле обратно на значение из InBody, и «подстановка не работала» с точки зрения пользователя.
  const prevTypeRef = useRef(targetType);
  const prevLogIdRef = useRef(baseline?.id ?? null);
  if (prevTypeRef.current !== targetType || prevLogIdRef.current !== (baseline?.id ?? null)) {
    prevTypeRef.current = targetType;
    prevLogIdRef.current = baseline?.id ?? null;
    setLocalValue(null); // сброс ручного ввода → фолбэк на актуальный замер/цель
  }
  const targetValue = (() => {
    // localValue != null — ручной ввод пользователя (в т.ч. «0»); пустая строка = поле очищено.
    if (localValue != null && localValue !== '') return String(localValue);
    if (hasGoalAssessment && goal?.targetValue != null) return String(+goal.targetValue);
    return baselineValueFor(targetType); // цель не задана — значение из последнего замера
  })();
  // Локальная оценка считается ТОЛЬКО по кнопке «Рассчитать» (не на каждый ввод).
  const [localAssessment, setLocalAssessment] = useState(null);
  const effectiveAssessment = localAssessment ?? goal?.assessment ?? null;
  const showDetails = !!effectiveAssessment; // до расчёта нет ни вердиктов, ни КБЖУ — только прочерки

  const handleSave = () => {
    setLocalAssessment(null);
    if (targetValue === '' || !targetDate || !baseline || !tdee) return;
    // фиксируем введённое значение как ручное — после «Рассчитать» поле не должно
    // перетираться фолбэком на замер, даже если goal ещё не вернулся из БД
    if (localValue == null) setLocalValue(targetValue);
    try {
      const a = assessGoal({ targetType, targetValue: +targetValue, targetDate, baseline, tdee });
      ['currentValue', 'dailyCalorieAdjustment', 'targetCalories', 'targetProtein',
       'targetFat', 'targetCarbs', 'daysAvailable'].forEach(k => {
        if (!Number.isFinite(+a[k])) a[k] = 0;
      });
      if (typeof a.verdict !== 'string' || !a.verdict) {
        a.verdict = a.isFeasible ? 'Реалистично' : 'Слишком агрессивно';
      }
      if (typeof a.limitDescription !== 'string') a.limitDescription = '';
      if (!a.targetUnit) a.targetUnit = targetType === 'weight' ? 'кг' : '%';
      setLocalAssessment(a);
      onSetGoal({ targetType, targetValue: +targetValue, targetDate, assessment: a, createdAt: new Date().toISOString() });
    } catch (e) {
      console.error('assessGoal:', e);
    }
  };

  // Значение «Сейчас»: из сохранённой оценки (после расчёта), иначе напрямую из замера InBody.
  const nowValue = (() => {
    if (effectiveAssessment && Number.isFinite(+effectiveAssessment.currentValue)) return +effectiveAssessment.currentValue;
    if (!baseline) return null;
    const v = targetType === 'weight' ? baseline.weight
      : targetType === 'fatPercent' ? baseline.fatPercent
      : baseline.musclePercent;
    return Number.isFinite(+v) ? +v : null;
  })();

  const unit = targetType === 'weight' ? 'кг' : '%';

  return (
    <div>
      <div className="goal-section">
        <div className="goal-header">
          <div className="goal-title">🎯 <span>Цель</span></div>
          {goal && <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {goal.targetValue}{goal.assessment?.targetUnit} к {new Date(goal.targetDate).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'})}
          </div>}
        </div>
        <div className="goal-grid">
          <div className="field"><label>Параметр</label>
            <select value={targetType} onChange={e => setTargetType(e.target.value)}>
              <option value="weight">Вес (кг)</option>
              <option value="fatPercent">% жира</option>
              <option value="musclePercent">% мышц</option>
            </select></div>
          <div className="field"><label>Значение ({unit})</label>
            <NumberInput value={targetValue} onChange={(v) => setLocalValue(v === "" ? null : v)} placeholder="—" /></div>
          <div className="field"><label>К дате</label>
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} /></div>
          <button className="btn goal" onClick={handleSave} style={{ width:'auto', padding:'14px 24px' }}>Рассчитать</button>
        </div>
        <div className={`goal-result ${showDetails ? (effectiveAssessment.isFeasible?'feasible':'infeasible') : ''}`}>
          {showDetails && (
            <>
              <div className="goal-verdict">
                <div className={`verdict-icon ${effectiveAssessment.isFeasible?'ok':'warn'}`}>{effectiveAssessment.isFeasible?'✓':'!'}</div>
                <span style={{ color: effectiveAssessment.isFeasible?'var(--muscle-2)':'var(--fat)' }}>
                  {effectiveAssessment.isFeasible?'Реалистично':'Слишком агрессивно'}
                </span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--muted)' }}>{effectiveAssessment.verdict}</div>
            </>
          )}
          <div className="goal-details">
            <div className="goal-detail"><div className="goal-detail-label">Сейчас</div>
              <div className="goal-detail-value">{nowValue != null ? `${nowValue.toFixed(1)}${unit}` : '—'}</div></div>
            <div className="goal-detail"><div className="goal-detail-label">Цель</div>
              <div className="goal-detail-value goal-color">
                {showDetails ? `${fmt(effectiveAssessment.targetValue, 1)}${effectiveAssessment.targetUnit ?? unit}` : '—'}</div></div>
            <div className="goal-detail"><div className="goal-detail-label">Дневной {effectiveAssessment?.direction==='loss'?'дефицит':'профицит'}</div>
              <div className={`goal-detail-value ${showDetails ? (effectiveAssessment.isFeasible?'ok':'warn') : ''}`}>
                {showDetails
                  ? `${numOr(effectiveAssessment.dailyCalorieAdjustment)>0?'+':''}${fmt(effectiveAssessment.dailyCalorieAdjustment)} ккал`
                  : '—'}</div></div>
            <div className="goal-detail"><div className="goal-detail-label">Реалистичная дата</div>
              <div className="goal-detail-value">
                {showDetails
                  ? (effectiveAssessment.realisticDate ? new Date(effectiveAssessment.realisticDate) : new Date())
                      .toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'})
                  : '—'}</div></div>
          </div>
          {showDetails && !effectiveAssessment.isFeasible && (
            <div className="goal-warning">
              ⚠ {effectiveAssessment.limitDescription}. Сдвиньте дату на{' '}
              <strong>{(effectiveAssessment.realisticDate ? new Date(effectiveAssessment.realisticDate) : new Date())
                .toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</strong>{' '}
              или менее амбициозную цель.
            </div>
          )}
          <div style={{ borderTop:'1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
            <div className="stat-label" style={{ marginBottom: 10 }}>Дневные цели по КБЖУ</div>
            <div className="goal-details">
              <div className="goal-detail"><div className="goal-detail-label">Калории</div>
                <div className="goal-detail-value goal-color">{showDetails ? `${fmt(effectiveAssessment.targetCalories)} ккал` : '—'}</div></div>
              <div className="goal-detail"><div className="goal-detail-label">Белки</div>
                <div className="goal-detail-value">{showDetails ? `${fmt(effectiveAssessment.targetProtein)} г` : '—'}</div></div>
              <div className="goal-detail"><div className="goal-detail-label">Жиры</div>
                <div className="goal-detail-value">{showDetails ? `${fmt(effectiveAssessment.targetFat)} г` : '—'}</div></div>
              <div className="goal-detail"><div className="goal-detail-label">Углеводы</div>
                <div className="goal-detail-value">{showDetails ? `${fmt(effectiveAssessment.targetCarbs)} г` : '—'}</div></div>
            </div>
          </div>
          {showDetails && plan && (Number.isFinite(+plan.fatPerDay) && +plan.fatPerDay > 0 || Number.isFinite(+plan.musclePerDay) && +plan.musclePerDay > 0) && (
            <div style={{ borderTop:'1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
              <div className="stat-label" style={{ marginBottom: 10 }}>Дневные планы по составу тела</div>
              <div className="goal-details">
                {Number.isFinite(+plan.fatPerDay) && plan.fatPerDay > 0 && (
                  <div className="goal-detail"><div className="goal-detail-label">Сжигание жира</div>
                    <div className="goal-detail-value" style={{ color: 'var(--muscle-2)' }}>−{(+plan.fatPerDay).toFixed(0)} г/день</div></div>
                )}
                {Number.isFinite(+plan.musclePerDay) && plan.musclePerDay > 0 && (
                  <div className="goal-detail"><div className="goal-detail-label">Синтез мышц</div>
                    <div className="goal-detail-value" style={{ color: 'var(--muscle)' }}>+{(+plan.musclePerDay).toFixed(1)} г/день</div></div>
                )}
                <div className="goal-detail"><div className="goal-detail-label">Дней до цели</div>
                  <div className="goal-detail-value">{effectiveAssessment.daysAvailable}</div></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GoalTab;
