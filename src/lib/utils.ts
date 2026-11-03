function formatSigned(n, d=0) { return (n>=0?'+':'−') + Math.abs(n).toFixed(d); }
// DECISION: id записей = uuid (колонки в Supabase — uuid; прошлый rand-генератор ломал PATCH/DELETE с ошибкой 22P02)
const genId = () =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
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
// СОН: границы «заснул / проснулся» с корректной обработкой перехода суток
// (уснул 15-го в 23:09, проснулся 16-го в 08:23).
// Храним sleep_start/sleep_end как локальные ISO-строки ('YYYY-MM-DDTHH:MM').
// Днём сна считается день пробуждения — все суточные агрегаты (сегодняшний блок,
// history, симуляция) пересчитываются именно от него.

const DAY_MS = 86400e3;

const pad2 = (n) => String(n).padStart(2, '0');
const toLocalIso = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
// Парсим локально (Date.parse('...T23:09') без смещения и так читает локальное время),
// возвращаем NaN при мусоре/пустоте.
const parseLocalIso = (s) => {
  if (!s || typeof s !== 'string') return NaN;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return NaN;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  return Number.isNaN(d.getTime()) ? NaN : d.getTime();
};

// Нормализация границ сна: вход — локальная ISO-строка или ms; end < start →
// считаем пробуждение на следующий день (классический ночной сон через полночь).
function normalizeSleepWindow(startVal, endVal) {
  let start = typeof startVal === 'number' ? startVal : parseLocalIso(startVal);
  let end = typeof endVal === 'number' ? endVal : parseLocalIso(endVal);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (end <= start) end += DAY_MS; // переход суток: уснул вечером, проснулся утром
  const hours = Math.round(((end - start) / 3600e3) * 10) / 10;
  return { start, end, hours };
}

// Границы сна из записи журнала (или null, если заданы некорректно)
function sleepWindow(e) {
  if (!e || e.type !== 'sleep') return null;
  return normalizeSleepWindow(e.sleep_start ?? e.sleepStart, e.sleep_end ?? e.sleepEnd);
}

// День (полночь локального времени), к которому относится запись сна — по пробуждению.
// Без явных границ fallback: timestamp записи (старые записи сохранятся как есть).
function sleepAttributionDayTs(e) {
  const w = sleepWindow(e);
  const ts = w ? w.end : e?.timestamp;
  if (!Number.isFinite(ts)) return NaN;
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Факт «спим ли сейчас» по фактическим границам сна (учитывает переход суток).
// Если границ нет — прежняя эвристика 23:00–07:00.
function isAsleepAt(activities, ts) {
  for (const a of activities) {
    if (a.type !== 'sleep') continue;
    const w = sleepWindow(a);
    if (w && ts >= w.start && ts <= w.end) return true;
  }
  const anyWindowed = activities.some(a => a.type === 'sleep' && sleepWindow(a));
  if (anyWindowed) return false;
  const h = new Date(ts).getHours();
  return h >= 23 || h < 7;
}

function formatClock(ts) {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
function formatDayShort(ts) {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
// 'Заснул 15 нояб., 23:09 · Встал 16 нояб., 08:23' (дата показывается, когда это не сегодня)
function formatSleepRange(e, refTs) {
  const w = sleepWindow(e);
  if (!w) return '';
  const refDay = new Date(refTs ?? Date.now()); refDay.setHours(0, 0, 0, 0);
  const label = (ts) => {
    const d = new Date(ts); d.setHours(0, 0, 0, 0);
    return d.getTime() === refDay.getTime() ? formatClock(ts) : `${formatClock(ts)} · ${formatDayShort(ts)}`;
  };
  return `Заснул ${label(w.start)} · Встал ${label(w.end)}`;
}

// ============================================================
// NUMBER INPUT

export {
  formatSigned, genId, formatTimer, plural, formatDayLabel,
  DAY_MS, toLocalIso, parseLocalIso, normalizeSleepWindow, sleepWindow,
  sleepAttributionDayTs, isAsleepAt, formatClock, formatDayShort, formatSleepRange,
};
