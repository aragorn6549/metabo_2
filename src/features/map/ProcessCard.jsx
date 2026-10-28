import { useState, useEffect } from 'react';

import MiniSparkline from './MiniSparkline';

function ProcessCard({ 
  title, icon, color, 
  currentDisplayRate, todayDisplayValue, planDisplayValue, 
  currentHour, context, sparklineData, helpContent,
  lipolysisRate, esterificationRate, fatDetail 
}) {
  const [showHelp, setShowHelp] = useState(false);
  const [secondsToNextHour, setSecondsToNextHour] = useState(() => {
    const now = new Date();
    return 3600 - ((now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds()) % 3600);
  });

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setSecondsToNextHour(3600 - ((now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds()) % 3600));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const isFat = color === 'fat';
  const hasPlan = planDisplayValue !== 0;
  
  let isGood, isBad;
  if (isFat) {
    isGood = currentDisplayRate < -0.05;
    isBad = currentDisplayRate > 0.05;
  } else {
    isGood = currentDisplayRate > 0.05;
    isBad = currentDisplayRate < -0.05;
  }

  let rateBadge, rateColor, barClass;
  if (isFat) {
    if (currentDisplayRate < -1.0) { 
      rateColor = 'var(--muscle-2)'; 
      rateBadge = { label: '▼▼ сжигание', color: 'var(--muscle-2)' }; 
    } else if (currentDisplayRate < -0.05) { 
      rateColor = 'var(--muscle-2)'; 
      rateBadge = { label: '▼ сжигание', color: 'var(--muscle-2)' }; 
    } else if (currentDisplayRate <= 0.05) { 
      rateColor = 'var(--muted)'; 
      rateBadge = { label: '● баланс', color: 'var(--muted)' }; 
    } else if (currentDisplayRate < 1.0) { 
      rateColor = 'var(--lipo)'; 
      rateBadge = { label: '▲ накопление', color: 'var(--lipo)' }; 
    } else { 
      rateColor = 'var(--lipo-2)'; 
      rateBadge = { label: '▲▲ хранение', color: 'var(--lipo-2)' }; 
    }
    barClass = isGood ? 'good' : isBad ? 'bad' : 'neutral';
  } else {
    if (currentDisplayRate > 0.2) { 
      rateColor = 'var(--muscle-2)'; 
      rateBadge = { label: '▲ синтез', color: 'var(--muscle-2)' }; 
    } else if (currentDisplayRate > 0) { 
      rateColor = 'var(--muscle)'; 
      rateBadge = { label: '● баланс', color: 'var(--muscle)' }; 
    } else { 
      rateColor = 'var(--fat)'; 
      rateBadge = { label: '▼ катаболизм', color: 'var(--fat)' }; 
    }
    barClass = isGood ? 'good' : isBad ? 'bad' : 'neutral';
  }

  let status = null;
  let progressPct = 0;
  let expectedDisplay = 0;
  if (hasPlan) {
    const planProgress = Math.abs(todayDisplayValue) / Math.abs(planDisplayValue);
    const timeProgress = currentHour / 24;
    const diff = planProgress - timeProgress;
    if (todayDisplayValue * planDisplayValue < 0) {
      status = { label: '⏱ отставание', color: 'var(--fat)' };
    } else if (diff > 0.05) {
      status = { label: '✓ опережение', color: 'var(--muscle-2)' };
    } else if (diff < -0.05) {
      status = { label: '⏱ отставание', color: 'var(--fat)' };
    } else {
      status = { label: '● в графике', color: 'var(--goal)' };
    }
    progressPct = Math.min(120, planProgress * 100);
    expectedDisplay = planDisplayValue * timeProgress;
  }

  const displayRate = (currentDisplayRate >= 0 ? '+' : '−') + Math.abs(currentDisplayRate).toFixed(2);
  const todayAbs = Math.abs(todayDisplayValue);
  let todayLabel;
  if (isFat) {
    todayLabel = todayDisplayValue < 0 ? 'сожжено' : todayDisplayValue > 0 ? 'накоплено' : 'баланс';
  } else {
    todayLabel = todayDisplayValue > 0 ? 'синтез' : todayDisplayValue < 0 ? 'распад' : 'баланс';
  }
  const planDisplayStr = hasPlan 
    ? `${planDisplayValue > 0 ? '+' : '−'}${Math.abs(planDisplayValue).toFixed(0)} г/день`
    : null;

  return (
    <div className="process-card">
      <div className="process-card-header">
        <div className="process-card-title">
          <span className="process-card-icon">{icon}</span>
          <span style={{ color: rateColor }}>{title}</span>
          {helpContent && (
            <button className="process-help-btn" onClick={() => setShowHelp(s => !s)}
              title="Что влияет на баланс?" aria-label="Справка">
              {showHelp ? '×' : '?'}
            </button>
          )}
        </div>
        <span className="process-rate-badge" style={{ color: rateBadge.color }}>{rateBadge.label}</span>
      </div>

      {showHelp && helpContent && (
        <div className="process-help-popup">{helpContent}</div>
      )}

      <div className="process-card-rate">
        <span className="rate-value" style={{ color: rateColor }}>{displayRate}</span>
        <span className="rate-unit">г/ч</span>
        {status && <span className="process-status" style={{ color: status.color }}>{status.label}</span>}
      </div>

      {isFat && lipolysisRate != null && esterificationRate != null && (
        <div className="process-breakdown">
          <div className="breakdown-row">
            <span>🟢 сжигается</span>
            <strong style={{ color: 'var(--muscle-2)' }}>−{lipolysisRate.toFixed(2)} г/ч</strong>
          </div>
          <div className="breakdown-row">
            <span>🔴 откладывается</span>
            <strong style={{ color: 'var(--lipo)' }}>+{esterificationRate.toFixed(2)} г/ч</strong>
          </div>
          <div className="breakdown-row total">
            <span>= чистый поток</span>
            <strong style={{ color: rateColor }}>{displayRate} г/ч</strong>
          </div>
        </div>
      )}

      <div className="process-timer">
        <span className="process-timer-icon">⟳</span>
        <span>след. обновление через {formatTimer(secondsToNextHour)}</span>
      </div>

      <div className="process-card-today">
        <span>{todayLabel}: <strong>{todayAbs.toFixed(1)}</strong> г</span>
        {hasPlan && <span className="process-card-plan">План: {planDisplayStr}</span>}
      </div>

      {hasPlan && (
        <>
          <div className="bar-track">
            <div className={`bar-fill ${barClass}`} style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }} />
          </div>
          <div className="process-card-expected">
            Ожидалось: {expectedDisplay.toFixed(1)} г · {((currentHour/24)*100).toFixed(0)}% дня
          </div>
        </>
      )}

      {fatDetail && <div className="process-detail">{fatDetail}</div>}

      {sparklineData && sparklineData.length > 1 && (
        <div className="sparkline-wrapper">
          <MiniSparkline data={sparklineData} color={rateColor} width={100} height={28} />
          <span className="sparkline-label">6 часов</span>
        </div>
      )}

      <div className="process-context">
        <span className="process-context-icon">📍</span>
        <span>{context}</span>
      </div>
    </div>
  );

export default ProcessCard;
