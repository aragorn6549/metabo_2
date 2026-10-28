
function MacroRow({ label, current, planned, color, unit='г' }) {
  const pct = planned > 0 ? Math.min(100, (current / planned) * 100) : 0;
  return (
    <div className="macro-row">
      <div className="macro-row-header">
        <span className="macro-row-label">{label}</span>
        <span className="macro-row-value">
          <strong>{Math.round(current || 0)}</strong>
          {planned > 0 && <span className="macro-row-plan"> / {planned}{unit}</span>}
          {planned > 0 && <span className="macro-row-plan"> ({Math.round(pct)}%)</span>}
        </span>
      </div>
      {planned > 0 && (
        <div className="bar-track" style={{ height: 5 }}>
          <div className="bar-fill good" style={{ width: `${pct}%`, height: '100%' }} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// HELP CONTENT (экспортируется для MetabolismMap)
// ============================================================
export const FAT_HELP = (
  <>
    <h4 className="good">🔥 Жир сжигается больше (значение −)</h4>
    <ul>
      <li>3+ часа с последнего приёма пищи</li>
      <li>Энергетический дефицит</li>
      <li>После тренировки (пик 1–2 ч)</li>
      <li>Ночью (голодание + гормон роста)</li>
    </ul>
    <h4 className="bad">🔴 Откладывается больше (значение +)</h4>
    <ul>
      <li>1–3 часа после еды, особенно углеводов</li>
      <li>Профицит калорий</li>
      <li>Фруктоза или алкоголь (DNL)</li>
    </ul>
  </>
);

export const MUSCLE_HELP = (
  <>
    <h4 className="synth">💪 Синтез больше (значение +)</h4>
    <ul>
      <li>Была силовая тренировка (окно 24–36 ч)</li>
      <li>Приём белка ≥ 15 г (импульс 2–3 ч)</li>
      <li>Энергии достаточно (не в глубоком дефиците)</li>
      <li>Сон 7+ ч</li>
    </ul>
    <h4 className="catab">🔨 Распад больше (значение −)</h4>
    <ul>
      <li>Ночью (MPS подавлен до 15%)</li>
      <li>Голод 5+ часов</li>
      <li>Дефицит калорий</li>
      <li>Без силовых тренировок</li>
    </ul>
  </>
);

// ============================================================

export default MacroRow;
