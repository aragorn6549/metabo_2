const WORKOUT_NAMES = { strength:'Силовая', cardio:'Кардио', volleyball:'Волейбол',
  padel:'Падел', tennis:'Теннис', football:'Футбол', basketball:'Баскетбол' };
const OTHER_NAMES = { walk:'Прогулка', work_sit:'Работа сидячая', work_stand:'Работа стоячая', chill:'Спокойствие' };
function entryEmoji(e) { return e.type==='food'?'🍽':e.type==='workout'?'🏋️':e.type==='sleep'?'😴':'🚶'; }
function entryLabel(e) {
  if (e.type==='food') return e.name || 'Приём пищи';
  if (e.type==='workout') return WORKOUT_NAMES[e.subtype] || 'Тренировка';
  if (e.type==='sleep') return 'Сон';
  return OTHER_NAMES[e.subtype] || 'Активность';
}
function entryMeta(e) {
  if (e.type==='food') return <><strong>{e.calories||0}</strong> ккал · Б <strong>{e.protein||0}</strong> · Ж <strong>{e.fat||0}</strong> · У <strong>{e.carbs||0}</strong></>;
  if (e.type==='workout') return <>{e.duration||0} мин · <strong>{e.calories||0}</strong> ккал</>;
  if (e.type==='sleep') return <>{e.hours||0} ч {e.quality?`· качество ${e.quality}/5`:''}</>;
  return <>{e.duration||0} мин</>;
}
function formatTime(ts) { return new Date(ts).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }); }

export { WORKOUT_NAMES, OTHER_NAMES, entryEmoji, entryLabel, entryMeta, formatTime };
