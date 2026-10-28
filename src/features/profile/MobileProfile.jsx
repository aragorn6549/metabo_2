
function MobileProfile({ user, baseline, goal, onLogout, onUpdateBaseline, onOpenHelp }) {
  return (
    <div>
      <div className="mobile-page-title">Профиль</div>
      <div className="profile-card">
        <div style={{ display:'flex', alignItems:'center', gap: 14, marginBottom: 20 }}>
          <div className="mobile-avatar" style={{ width: 48, height: 48, fontSize: 18 }}>
            {(user||'?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{baseline.name || 'Пользователь'}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{user}</div>
          </div>
        </div>
        <div className="profile-row"><span className="profile-row-label">Возраст</span>
          <span className="profile-row-value">{baseline.age} лет</span></div>
        <div className="profile-row"><span className="profile-row-label">Рост</span>
          <span className="profile-row-value">{baseline.height} см</span></div>
        <div className="profile-row"><span className="profile-row-label">Вес</span>
          <span className="profile-row-value">{baseline.weight} кг</span></div>
        <div className="profile-row"><span className="profile-row-label">% жира</span>
          <span className="profile-row-value" style={{ color:'var(--fat)' }}>{baseline.fatPercent}%</span></div>
        <div className="profile-row"><span className="profile-row-label">% мышц</span>
          <span className="profile-row-value" style={{ color:'var(--muscle)' }}>{baseline.musclePercent}%</span></div>
        <div className="profile-row"><span className="profile-row-label">BMR</span>
          <span className="profile-row-value">{Math.round(baseline.bmr)} ккал</span></div>
      </div>
      {goal && (
        <div className="profile-card">
          <div className="stat-label" style={{ marginBottom: 12 }}>🎯 Активная цель</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--goal)', marginBottom: 6 }}>
            {goal.targetValue}{goal.assessment?.targetUnit} · {goal.targetType==='weight'?'вес':goal.targetType==='fatPercent'?'жир':'мышцы'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            к {new Date(goal.targetDate).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}
          </div>
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap: 12, marginTop: 16 }}>
        <button className="btn secondary" onClick={onOpenHelp}>📖 Справка по методам</button>
        <button className="btn secondary" onClick={onUpdateBaseline}>+ Новый замер InBody</button>
        <button className="btn danger" onClick={onLogout}>Выйти из аккаунта</button>
      </div>
    </div>
  );
}

export default MobileProfile;
