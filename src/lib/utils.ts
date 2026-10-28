function formatSigned(n, d=0) { return (n>=0?'+':'−') + Math.abs(n).toFixed(d); }
const genId = () => Math.random().toString(36).slice(2, 10);
function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function plural(n, forms) {
  if (n % 10 === 1 && n % 100 !== 11) return forms[0];
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return forms[1];
  return forms[2];
}

function formatDayLabel(date) {
  const now = new Date();
  const today = new Date(now); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const d = new Date(date); d.setHours(0,0,0,0);
  if (d.getTime() === today.getTime()) return 'Сегодня';
  if (d.getTime() === yesterday.getTime()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

// ============================================================
// NUMBER INPUT

export { formatSigned, genId, formatTimer, plural, formatDayLabel };
