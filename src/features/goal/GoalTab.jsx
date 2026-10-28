import { useState, useEffect } from 'react';

import { assessGoal } from '@/lib/shared';
import NumberInput from '@/components/NumberInput';

const numOr = (v, d = 0) => { const n = +v; return Number.isFinite(n) ? n : d; };
const fmt = (v, d = 0, fb = '—') => { const n = +v; return Number.isFinite(n) ? n.toFixed(d) : fb; };

function GoalTab({ baseline, tdee, goal, plan, onSetGoal }) {
  // Helper to get value from baseline based on target type
  const getBaselineValue = (type) => {
    if (!baseline) return null;
    const v = type === 'weight' ? baseline.weight
      : type === 'fatPercent' ? baseline.fatPercent
      : type === 'musclePercent' ? baseline.musclePercent
      : null;
    return Number.isFinite(+v) ? +v : null;
  };

  const [targetType, setTargetType] = useState(goal?.targetType || 'weight');
  
  // Initialize with goal value or baseline value
  const [targetValue, setTargetValue] = useState(() => {
    if (goal?.targetValue != null && Number.isFinite(+goal.targetValue)) {
      return String(goal.targetValue);
    }
    const bv = getBaselineValue(goal?.targetType || 'weight');
    return bv != null ? String(bv) : '';
  });
  
  const [targetDate, setTargetDate] = useState(() => {
    if (goal?.targetDate) return goal.targetDate.slice(0, 10);
    const d = new Date(); d.setMonth(d.getMonth()+3); return d.toISOString().slice(0, 10);
  });

  // Sync targetValue with baseline when targetType changes and no active goal exists
  useEffect(() => {
    if (!goal?.assessment) {
      const bv = getBaselineValue(targetType);
      if (bv != null) {
        setTargetValue(String(bv));
      } else {
        setTargetValue('');
      }
    }
  }, [targetType, goal]);

  const [localAssessment, setLocalAssessment] = useState(null);
  const effectiveAssessment = localAssessment ?? goal?.assessment ?? null;
  const showDetails = !!effectiveAssessment;

  const handleSave = () => {
    setLocalAssessment(null);
    if (targetValue === '' || !targetDate || !baseline || !tdee) return;
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

  // Display "Now" value: use assessment if available, otherwise fallback to baseline directly
  const nowValue = (() => {
    if (effectiveAssessment && Number.isFinite(+effectiveAssessment.currentValue)) {
      return +effectiveAssessment.currentValue;
    }
    return getBaselineValue(targetType);
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
            <NumberInput 
              value={targetValue} 
              onChange={v => setTargetValue(v)} 
              placeholder={nowValue != null ? String(nowValue) : '—'} 
            />
          </div>
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
