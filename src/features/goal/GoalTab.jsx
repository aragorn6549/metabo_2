import { useState, useMemo } from 'react';

import { assessGoal } from '@/lib/shared';
import NumberInput from '@/components/NumberInput';

// DECISION: страховка от «Cannot read properties of undefined (reading 'toFixed')» —
// любое поле assessment (в т.ч. из старой/битой строки БД) приводится к числу; при NaN — fallback.
const numOr = (v, d = 0) => { const n = +v; return Number.isFinite(n) ? n : d; };
const fmt = (v, d = 0, fb = '—') => { const n = +v; return Number.isFinite(n) ? n.toFixed(d) : fb; };

// DECISION: вкладка «Цель» приведена строго 1:1 к прототипу (Презентация.html, GoalTab).
// Отличия сборки были: лишние guard-условия в useMemo (скрывали нижний блок оценки, когда пример его показывает),
// и двойная проверка instanceof Date для realisticDate. Guard оставлен только на самый ранний stage (!baseline/!tdee),
// как в примере; числовые проверки убраны.
function GoalTab({ baseline, tdee, goal, plan, onSetGoal }) {
  const [targetType, setTargetType] = useState(goal?.targetType || 'weight');
  const [targetValue, setTargetValue] = useState(goal?.targetValue || 72);
  const [targetDate, setTargetDate] = useState(() => {
    if (goal?.targetDate) return goal.targetDate.slice(0, 10);
    const d = new Date(); d.setMonth(d.getMonth()+3); return d.toISOString().slice(0, 10);
  });
  const assessment = useMemo(() => {
    if (targetValue === '' || !targetDate) return null;
    // DECISION: если данные ещё не прогрузились или baseline/tdee неполные (null fat_percent и т.п.),
    // показываем сохранённую цель из БД (с числовыми fallback'ами), а не роняем экран.
    if (!baseline || !tdee) {
      return goal?.assessment ? { ...goal.assessment } : null;
    }
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
      return a;
    } catch (e) {
      console.error('assessGoal:', e);
      return goal?.assessment ? { ...goal.assessment } : null;
    }
  }, [targetType, targetValue, targetDate, baseline, tdee]);
  const handleSave = () => {
    if (!assessment) return;
    onSetGoal({ targetType, targetValue: +targetValue, targetDate, assessment, createdAt: new Date().toISOString() });
  };
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
          <div className="field"><label>Значение ({targetType==='weight'?'кг':'%'})</label>
            <NumberInput value={targetValue} onChange={v => setTargetValue(v)} /></div>
          <div className="field"><label>К дате</label>
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} /></div>
          <button className="btn goal" onClick={handleSave} style={{ width:'auto', padding:'14px 24px' }}>Рассчитать</button>
        </div>
        {assessment && (
          <div className={`goal-result ${assessment.isFeasible?'feasible':'infeasible'}`}>
            <div className="goal-verdict">
              <div className={`verdict-icon ${assessment.isFeasible?'ok':'warn'}`}>{assessment.isFeasible?'✓':'!'}</div>
              <span style={{ color: assessment.isFeasible?'var(--muscle-2)':'var(--fat)' }}>
                {assessment.isFeasible?'Реалистично':'Слишком агрессивно'}
              </span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--muted)' }}>{assessment.verdict}</div>
            <div className="goal-details">
              <div className="goal-detail"><div className="goal-detail-label">Сейчас</div>
                <div className="goal-detail-value">{fmt(assessment.currentValue, 1)}{assessment.targetUnit}</div></div>
              <div className="goal-detail"><div className="goal-detail-label">Цель</div>
                <div className="goal-detail-value goal-color">{fmt(assessment.targetValue, 1)}{assessment.targetUnit}</div></div>
              <div className="goal-detail"><div className="goal-detail-label">Дневной {assessment.direction==='loss'?'дефицит':'профицит'}</div>
                <div className={`goal-detail-value ${assessment.isFeasible?'ok':'warn'}`}>
                  {numOr(assessment.dailyCalorieAdjustment)>0?'+':''}{fmt(assessment.dailyCalorieAdjustment)} ккал</div></div>
              <div className="goal-detail"><div className="goal-detail-label">Реалистичная дата</div>
                <div className="goal-detail-value">
                  {(assessment.realisticDate ? new Date(assessment.realisticDate) : new Date())
                    .toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'})}</div></div>
            </div>
            {!assessment.isFeasible && (
              <div className="goal-warning">
                ⚠ {assessment.limitDescription}. Сдвиньте дату на{' '}
                <strong>{(assessment.realisticDate ? new Date(assessment.realisticDate) : new Date())
                  .toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</strong>{' '}
                или менее амбициозную цель.
              </div>
            )}
            <div style={{ borderTop:'1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
              <div className="stat-label" style={{ marginBottom: 10 }}>Дневные цели по КБЖУ</div>
              <div className="goal-details">
                <div className="goal-detail"><div className="goal-detail-label">Калории</div>
                  <div className="goal-detail-value goal-color">{fmt(assessment.targetCalories)} ккал</div></div>
                <div className="goal-detail"><div className="goal-detail-label">Белки</div>
                  <div className="goal-detail-value">{fmt(assessment.targetProtein)} г</div></div>
                <div className="goal-detail"><div className="goal-detail-label">Жиры</div>
                  <div className="goal-detail-value">{fmt(assessment.targetFat)} г</div></div>
                <div className="goal-detail"><div className="goal-detail-label">Углеводы</div>
                  <div className="goal-detail-value">{fmt(assessment.targetCarbs)} г</div></div>
              </div>
            </div>
            {plan && (Number.isFinite(+plan.fatPerDay) && +plan.fatPerDay > 0 || Number.isFinite(+plan.musclePerDay) && +plan.musclePerDay > 0) && (
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
                    <div className="goal-detail-value">{assessment.daysAvailable}</div></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================

export default GoalTab;
