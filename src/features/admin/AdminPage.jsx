import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminListUsers, adminDeleteUser, adminSendPasswordReset } from '@/lib/admin';

// DECISION: Полноэкранная админка (по образцу admin-demo.html), подключена к реальному бэкенду:
//   • Пользователи  — RPC admin_list_users / admin_delete_user (supabase/admin.sql) + /api/admin-reset;
//   • Дашборд       — агрегаты из этих же данных + счётчики public.entries / inbody_logs / profiles;
//   • Справочник    — public.dishes (видимые по RLS блюда; справочник админа);
//   • Настройки     — статичная справка (сервисные ключи в клиенте недоступны намеренно).
// Роли: поле is_admin из RPC + второй канал — app_metadata.role === 'admin' (src/lib/admin.js).
// Выход — реальный supabase.auth.signOut(): App.jsx увидит SIGNED_OUT и вернёт экран входа.

const css = `
.adm-root{display:flex;min-height:100vh;background:#080b14;color:#e5e7eb;font-family:inherit}
.adm-sidebar{width:240px;flex-shrink:0;border-right:1px solid rgba(255,255,255,.07);padding:18px 14px;display:flex;flex-direction:column;gap:6px;position:sticky;top:0;height:100vh;box-sizing:border-box}
.adm-logo{font-size:17px;font-weight:900;padding:4px 10px 16px;display:flex;align-items:center;gap:9px}
.adm-logo .dot{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#8b5cf6,#6366f1);display:grid;place-items:center;font-size:15px}
.adm-nav-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;color:#9ca3af;font:inherit;font-size:14px;font-weight:600;padding:10px 12px;border-radius:10px;cursor:pointer;transition:.15s}
.adm-nav-item:hover{background:rgba(255,255,255,.05);color:#e5e7eb}
.adm-nav-item.active{background:rgba(139,92,246,.16);color:#c4b5fd}
.adm-nav-item .badge{margin-left:auto;background:rgba(139,92,246,.25);color:#c4b5fd;font-size:11px;font-weight:800;border-radius:99px;padding:2px 8px}
.adm-side-footer{margin-top:auto;padding:12px 6px 2px;font-size:11px;color:#6b7280;display:flex;flex-direction:column;gap:10px}
.adm-admin-chip{display:flex;gap:10px;align-items:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:9px 10px}
.adm-avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#d946ef);display:grid;place-items:center;font-size:12px;font-weight:800;color:#fff;flex-shrink:0}
.adm-main{flex:1;padding:26px 30px;min-width:0;box-sizing:border-box}
.adm-page{display:none}.adm-page.active{display:block}
.adm-topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:20px;flex-wrap:wrap}
.adm-topbar h2{font-size:22px;font-weight:900;margin:0}
.adm-sub{font-size:13px;color:#9ca3af;margin-top:4px}
.adm-grid{display:grid;gap:14px}.adm-grid-4{grid-template-columns:repeat(4,1fr)}.adm-grid-2{grid-template-columns:1fr 1fr;margin-top:14px}
@media(max-width:1100px){.adm-grid-4{grid-template-columns:repeat(2,1fr)}.adm-grid-2{grid-template-columns:1fr}}
.adm-card{background:#0f1422;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:18px}
.adm-stat-label{font-size:12px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
.adm-stat-value{font-size:28px;font-weight:900;margin-top:6px}
.adm-stat-delta{font-size:12px;margin-top:4px;color:#9ca3af}
.adm-stat-delta.up{color:#34d399}.adm-stat-delta.down{color:#f87171}
.adm-bars{display:flex;align-items:flex-end;gap:6px;height:150px;margin-top:14px}
.adm-bar{flex:1;background:linear-gradient(180deg,#8b5cf6,#4c1d95);border-radius:6px 6px 2px 2px;min-height:6px;position:relative}
.adm-bar span{position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:10px;color:#9ca3af}
.adm-feed-item{display:flex;gap:12px;padding:10px 2px;border-bottom:1px dashed rgba(255,255,255,.06);font-size:13px}
.adm-feed-item:last-child{border-bottom:none}
.adm-feed-icon{width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.05);display:grid;place-items:center;font-size:15px;flex-shrink:0}
.adm-feed-time{font-size:11px;color:#6b7280;margin-top:2px}
.adm-donut{width:120px;height:120px;border-radius:50%;background:conic-gradient(#8b5cf6 0 46%,#6366f1 46% 74%,#f59e0b 74% 90%,#374151 90% 100%);position:relative;flex-shrink:0}
.adm-donut::after{content:"";position:absolute;inset:26px;border-radius:50%;background:#0f1422}
.adm-legend{font-size:13px;display:flex;flex-direction:column;gap:8px}
.adm-legend i{width:11px;height:11px;border-radius:3px;display:inline-block;margin-right:8px}
.adm-toolbar{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
.adm-search{background:#0f1422;border:1px solid rgba(255,255,255,.09);border-radius:10px;color:#e5e7eb;font:inherit;font-size:13.5px;padding:9px 13px;min-width:250px;box-sizing:border-box}
.adm-search:focus{outline:none;border-color:#8b5cf6}
select.adm-search{min-width:140px}
.adm-count-note{font-size:12px;color:#6b7280;margin-left:auto}
.adm-table-wrap{overflow-x:auto}
table.adm-table{width:100%;border-collapse:collapse;font-size:13.5px}
.adm-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08)}
.adm-table td{padding:11px 12px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:middle}
.adm-table tr:hover td{background:rgba(255,255,255,.02)}
.adm-u-cell{display:flex;gap:10px;align-items:center}
.adm-u-name{font-weight:700}.adm-u-email{font-size:12px;color:#9ca3af}
.adm-tag{display:inline-block;font-size:10.5px;font-weight:800;border-radius:6px;padding:2px 8px;letter-spacing:.4px}
.adm-tag.admin{background:rgba(139,92,246,.2);color:#c4b5fd}
.adm-tag.user{background:rgba(255,255,255,.07);color:#9ca3af}
.adm-tag.demo{background:rgba(245,158,11,.16);color:#fbbf24}
.adm-tag.self{background:rgba(52,211,153,.14);color:#34d399}
.adm-row-actions{display:flex;gap:8px;justify-content:flex-end;white-space:nowrap}
.adm-btn{background:linear-gradient(135deg,#8b5cf6,#6366f1);color:#fff;border:none;border-radius:10px;font:inherit;font-size:13.5px;font-weight:700;padding:9px 15px;cursor:pointer;transition:.15s}
.adm-btn:hover{filter:brightness(1.12)}
.adm-btn.secondary{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#d1d5db}
.adm-btn.danger{background:rgba(239,68,68,.14);border:1px solid rgba(239,68,68,.4);color:#f87171}
.adm-btn.sm{padding:6px 11px;font-size:12.5px}
.adm-btn:disabled{opacity:.4;cursor:not-allowed}
.adm-btn.logout{width:100%;background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.35);border-radius:10px;padding:9px 14px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px}
.adm-empty{padding:34px;text-align:center;color:#6b7280;font-size:14px}
.adm-error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);color:#f87171;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:14px}
.adm-backdrop{position:fixed;inset:0;background:rgba(3,6,15,.7);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;z-index:100;padding:20px}
.adm-backdrop.open{display:flex}
.adm-modal{background:#111726;border:1px solid rgba(255,255,255,.1);border-radius:18px;max-width:460px;width:100%;padding:22px}
.adm-modal h3{margin:0 0 10px;font-size:17px;font-weight:900}
.adm-modal p{font-size:14px;color:#d1d5db;line-height:1.55;margin:0 0 12px}
.adm-warn-box{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.35);color:#fbbf24;border-radius:10px;padding:11px 13px;font-size:12.5px;line-height:1.5;margin-bottom:18px}
.adm-modal-actions{display:flex;gap:10px;justify-content:flex-end}
.adm-toast{position:fixed;bottom:24px;left:50%;transform:translate(-50%,80px);background:#1b2236;border:1px solid rgba(139,92,246,.5);color:#e5e7eb;font-size:13.5px;font-weight:600;padding:11px 18px;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.5);opacity:0;transition:.3s;z-index:200;max-width:90vw}
.adm-toast.show{transform:translate(-50%,0);opacity:1}
.adm-toast.danger{border-color:rgba(239,68,68,.6)}
.adm-mobile-topbar{display:none}
.adm-scrim{display:none}
.adm-menu-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#e5e7eb;border-radius:9px;font-size:18px;width:38px;height:38px;cursor:pointer}
.adm-field label{display:block;font-size:12px;color:#9ca3af;font-weight:700;margin-bottom:6px}
.adm-field input{width:100%;background:#0b0f1a;border:1px solid rgba(255,255,255,.1);border-radius:9px;color:#c4b5fd;font:inherit;font-size:13px;padding:9px 11px;box-sizing:border-box}
.adm-hint-ok{font-size:12px;color:#34d399;margin-top:6px}
.adm-muted-p{color:#9ca3af;font-size:13px;line-height:1.6;margin:0 0 16px}
.adm-code{color:#c4b5fd;background:rgba(139,92,246,.1);border-radius:5px;padding:1px 6px;font-size:12px}
@media(max-width:900px){
  .adm-sidebar{position:fixed;left:0;top:0;bottom:0;z-index:60;transform:translateX(-105%);transition:.25s;background:#0c1120;box-shadow:8px 0 30px rgba(0,0,0,.5)}
  .adm-sidebar.open{transform:none}
  .adm-mobile-topbar{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.07);position:sticky;top:0;background:#080b14;z-index:50}
  .adm-mobile-topbar .adm-logo{padding:0;font-size:15px}
  .adm-mobile-topbar .adm-btn.logout{width:auto;margin-left:auto;padding:8px 12px}
  .adm-scrim{display:block;position:fixed;inset:0;background:rgba(3,6,15,.6);z-index:55;opacity:0;pointer-events:none;transition:.25s}
  .adm-scrim.open{opacity:1;pointer-events:auto}
  .adm-main{padding:18px 14px}
}
`;

const fmtDate = (s) => s ? new Date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (s) => s ? new Date(s).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export default function AdminPage({ user, onExit, showToast }) {
  const [page, setPage] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [q, setQ] = useState('');
  const [fRole, setFRole] = useState('');
  const [stats, setStats] = useState({ entries: null, inbody: null, dishes: null, byType: {}, active7: null });
  const [dishes, setDishes] = useState([]);
  const [loadingDishes, setLoadingDishes] = useState(true);
  const [dishDraft, setDishDraft] = useState(null); // {id?, name, calories, protein, fat, carbs}
  const [history, setHistory] = useState([]); // лента действий этой сессии

  const uid = user?.id;

  const pushHistory = (icon, text) =>
    setHistory(h => [{ icon, text, time: new Date().toISOString() }, ...h].slice(0, 20));

  // ===== Данные =====
  const loadUsers = async () => {
    setLoadingUsers(true); setUsersError('');
    try {
      setUsers(await adminListUsers());
    } catch (err) {
      setUsersError(String(err.message || err));
    } finally { setLoadingUsers(false); }
  };

  // DECISION: агрегаты по всей БД доступны админу только через security-definer RPC
  // admin_dashboard_stats() (добавлена в supabase/admin.sql). Если миграция ещё не выполнена —
  // аккуратно деградируем: считаем свои строки (RLS) и суммы из admin_list_users.
  const loadStats = async () => {
    // Основной путь — security-definer RPC admin_dashboard_stats() (всего по БД, только для админа).
    // Фолбэк без миграции — count(*), видимые по RLS строки (свои данные).
    try {
      const { data, error } = await supabase.rpc('admin_dashboard_stats');
      if (!error && data) {
        setStats({
          entries: Number(data.entries_count) || 0,
          inbody: Number(data.inbody_count) || 0,
          dishes: Number(data.dishes_count) || 0,
          byType: data.by_type || {},
          active7: Number(data.active_7d) || 0,
          rpc: true,
        });
        return;
      }
      if (error && error.code !== 'PGRST202') console.warn('admin_dashboard_stats:', error);
      const [e, i, d] = await Promise.all([
        supabase.from('entries').select('type', { count: 'exact', head: true }),
        supabase.from('inbody_logs').select('id', { count: 'exact', head: true }),
        supabase.from('dishes').select('id', { count: 'exact', head: true }),
      ]);
      setStats({ entries: e.count ?? 0, inbody: i.count ?? 0, dishes: d.count ?? 0, byType: {}, rpc: false });
    } catch { /* счётчики не критичны */ }
  };

  const loadDishes = async () => {
    setLoadingDishes(true);
    try {
      // DECISION: справочник админки = блюда, видимые по RLS (свои + глобальные,
      // если применён патч dishes_select_public из supabase/admin.sql).
      const { data, error } = await supabase
        .from('dishes').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      setDishes(data || []);
    } catch (err) {
      showToast('⚠ Не удалось загрузить блюда: ' + String(err.message || err), 'danger');
    } finally { setLoadingDishes(false); }
  };

  useEffect(() => { loadUsers(); loadStats(); loadDishes(); void uid; }, []);

  // ===== Действия =====
  const doDelete = async (u) => {
    setBusyId(u.id);
    try {
      await adminDeleteUser(u.id);
      showToast(`Удалён: ${u.email} (вместе с историей)`, 'danger');
      pushHistory('🗑', `Удалён пользователь ${u.email} вместе с историей`);
      setConfirmDel(null);
      await loadUsers();
      loadStats();
    } catch (err) {
      showToast('⚠ ' + String(err.message || err), 'danger');
    } finally { setBusyId(null); }
  };

  const doReset = async (u) => {
    if (!u.email) { showToast('У пользователя нет email', 'danger'); return; }
    setBusyId(u.id);
    try {
      await adminSendPasswordReset(u.email);
      showToast(`📩 Письмо для сброса пароля отправлено на ${u.email}`);
      pushHistory('📩', `Сброс пароля отправлен на ${u.email}`);
    } catch (err) {
      showToast('⚠ ' + String(err.message || err), 'danger');
    } finally { setBusyId(null); }
  };

  const saveDish = async () => {
    const d = dishDraft;
    if (!d || !d.name.trim()) { showToast('Укажите название блюда', 'danger'); return; }
    const payload = {
      name: d.name.trim(),
      calories: Number(d.calories) || 0,
      protein: Number(d.protein) || 0,
      fat: Number(d.fat) || 0,
      carbs: Number(d.carbs) || 0,
    };
    try {
      if (d.id) {
        const { error } = await supabase.from('dishes').update(payload).eq('id', d.id);
        if (error) throw error;
        showToast(`✓ Обновлено: ${payload.name}`);
        pushHistory('✏️', `Блюдо обновлено: «${payload.name}»`);
      } else {
        const { error } = await supabase.from('dishes')
          .insert({ ...payload, user_id: uid });
        if (error) throw error;
        showToast(`✓ Добавлено: ${payload.name}`);
        pushHistory('➕', `Блюдо добавлено в справочник: «${payload.name}»`);
      }
      setDishDraft(null);
      loadDishes(); loadStats();
    } catch (err) {
      showToast('⚠ ' + String(err.message || err), 'danger');
    }
  };

  const deleteDish = async (dish) => {
    try {
      const { error } = await supabase.from('dishes').delete().eq('id', dish.id);
      if (error) throw error;
      showToast(`🗑 Удалено: ${dish.name}`, 'danger');
      pushHistory('🗑', `Блюдо удалено: «${dish.name}»`);
      loadDishes(); loadStats();
    } catch (err) {
      showToast('⚠ ' + String(err.message || err), 'danger');
    }
  };

  // DECISION: раньше «выход» в админке был полным signOut() — админ терял сессию и попадал
  // на экран входа. Теперь это возврат в приложение (onExit → App.setView('app'));
  // завершение сессии — только через профиль пользователя.
  const handleExit = () => onExit();

  // ===== Производные данные дашборда =====
  const totalUsers = users.length;
  const adminsCount = users.filter(isAdminRow).length;
  // Активные за 7 дней: из RPC (occurred_at по всей БД); фолбэк — по last_activity из admin_list_users
  const active7 = stats.active7 != null ? stats.active7 : users.filter(u => u.last_activity &&
    Date.now() - new Date(u.last_activity).getTime() < 7 * 864e5).length;
  const sumEntries = users.reduce((s, u) => s + (Number(u.entries_count) || 0), 0);
  const weekNew = users.filter(u => u.created_at &&
    Date.now() - new Date(u.created_at).getTime() < 7 * 864e5).length;

  const regByDay = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i));
      return { date: d, count: 0 };
    });
    for (const u of users) {
      if (!u.created_at) continue;
      const t = new Date(u.created_at); t.setHours(0, 0, 0, 0);
      const slot = days.find(x => x.date.getTime() === t.getTime());
      if (slot) slot.count++;
    }
    return days;
  }, [users]);
  const maxReg = Math.max(1, ...regByDay.map(d => d.count));

  // Кольцевая диаграмма: доли типов записей из RPC (food/workout/sleep/other); фолбэк — нейтральная.
  const donut = useMemo(() => {
    const defs = [
      { key: 'food', label: 'Еда', color: '#8b5cf6' },
      { key: 'workout', label: 'Тренировки', color: '#6366f1' },
      { key: 'sleep', label: 'Сон', color: '#f59e0b' },
      { key: 'other', label: 'Прочее', color: '#374151' },
    ];
    const bt = stats.byType || {};
    let vals = defs.map(d => Number(bt[d.key]) || 0);
    const sum = vals.reduce((a, b) => a + b, 0);
    if (!sum) { vals = [46, 28, 16, 10]; } // декоративное распределение, пока данных нет
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    let acc = 0; const stops = [];
    defs.forEach((d, i) => {
      const from = (acc / total) * 100; acc += vals[i];
      const to = (acc / total) * 100;
      stops.push(`${d.color} ${from.toFixed(1)}% ${to.toFixed(1)}%`);
    });
    return {
      style: { background: `conic-gradient(${stops.join(',')})` },
      legend: defs.map((d, i) => ({ label: sum ? d.label : `${d.label} (демо)`, color: d.color, value: vals[i] })),
    };
  }, [stats.byType]);

  const roleOf = (u) => isAdminRow(u) ? 'admin' : 'user';
  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return users.filter(u =>
      (!ql || (u.email || '').toLowerCase().includes(ql) || (u.name || '').toLowerCase().includes(ql)) &&
      (!fRole || roleOf(u) === fRole)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, q, fRole]);

  const nav = [
    { id: 'dashboard', label: '📊 Дашборд' },
    { id: 'users', label: '👥 Пользователи', badge: totalUsers },
    { id: 'dishes', label: '🍽 Справочник блюд', badge: dishes.length },
    { id: 'settings', label: '⚙️ Настройки' },
  ];

  return (
    <div className="adm-root">
      <style>{css}</style>

      {/* Мобильная шапка: бургер открывает ТО ЖЕ боковое меню, что на десктопе + кнопка выхода */}
      <div className="adm-mobile-topbar">
        <button className="adm-menu-btn" aria-label="Открыть меню" onClick={() => setMenuOpen(true)}>☰</button>
        <div className="adm-logo"><div className="dot">🔥</div> MetaBo Admin</div>
        <button className="adm-btn logout" style={{ width: 'auto', margin: '0 0 0 auto', padding: '8px 12px' }}
          onClick={handleExit}>← В приложение</button>
      </div>
      <div className={`adm-scrim${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />

      <aside className={`adm-sidebar${menuOpen ? ' open' : ''}`}>
        <div className="adm-logo"><div className="dot">🔥</div> MetaBo Admin</div>
        {nav.map(n => (
          <button key={n.id} className={`adm-nav-item${page === n.id ? ' active' : ''}`}
            onClick={() => { setPage(n.id); setMenuOpen(false); }}>
            {n.label}
            {n.badge != null && <span className="badge">{n.badge}</span>}
          </button>
        ))}
        <div className="adm-side-footer">
          <div className="adm-admin-chip">
            <div className="adm-avatar">{initialsOf(user)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
              <div style={{ fontSize: 11 }}>роль: admin</div>
            </div>
          </div>
          <button className="adm-btn logout" onClick={handleExit}>← В приложение</button>
          <div>MetaBo · Supabase live</div>
        </div>
      </aside>

      <main className="adm-main">
        {/* ================= ДАШБОРД ================= */}
        {page === 'dashboard' && (
          <section className="adm-page active">
            <div className="adm-topbar">
              <div>
                <h2>📊 Дашборд</h2>
                <div className="adm-sub">Обзор активности проекта MetaBo · живые данные Supabase</div>
              </div>
              <button className="adm-btn secondary" onClick={() => { loadUsers(); loadStats(); showToast('⟳ Данные обновлены'); }}>⟳ Обновить</button>
            </div>

            <div className="adm-grid adm-grid-4">
              <Stat label="Пользователей" value={totalUsers} delta={weekNew > 0 ? `▲ +${weekNew} за неделю` : 'без новых за неделю'} up />
              <Stat label="Админов" value={adminsCount} delta="роль admin (admin_roles)" />
              <Stat label="Активных (7 дней)" value={active7} delta="по последней записи журнала" up={active7 > 0} />
              <Stat label="Записей журнала" value={stats.entries ?? sumEntries} delta={stats.entries == null ? 'сумма по пользователям' : 'всего в public.entries'} danger={false} />
            </div>

            <div className="adm-grid adm-grid-2">
              <div className="adm-card">
                <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 22px' }}>Новые пользователи · 14 дней</h3>
                <div className="adm-bars">
                  {regByDay.map((d, i) => (
                    <div key={i} className="adm-bar"
                      style={{ height: `${Math.max(4, (d.count / maxReg) * 100)}%`, opacity: d.count ? 1 : 0.25 }}>
                      {d.count > 0 && <span>{d.count}</span>}
                    </div>
                  ))}
                </div>
                <div style={{ height: 22 }} />
              </div>

              <div className="adm-card">
                <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 8px' }}>Действия (эта сессия)</h3>
                {history.length === 0 ? (
                  <div className="adm-empty" style={{ padding: 20 }}>Пока пусто — выполните действие в разделе «Пользователи» или «Справочник»</div>
                ) : history.map((h, i) => (
                  <div className="adm-feed-item" key={i}>
                    <div className="adm-feed-icon">{h.icon}</div>
                    <div>{h.text}<div className="adm-feed-time">{fmtDateTime(h.time)}</div></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="adm-card" style={{ marginTop: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 14px' }}>Крупные таблицы БД</h3>
              <div style={{ display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="adm-donut" style={donut.style} />
                <div className="adm-legend">
                  {donut.legend.map((l, i) => (
                    <div key={i}><i style={{ background: l.color }} />{l.label} — {l.value.toLocaleString('ru-RU')}</div>
                  ))}
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    Всего записей: {stats.entries == null ? '…' : stats.entries.toLocaleString('ru-RU')}
                    {stats.rpc ? '' : ' · свои данные (для общих цифр выполните supabase/admin.sql)'}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ================= ПОЛЬЗОВАТЕЛИ ================= */}
        {page === 'users' && (
          <section className="adm-page active">
            <div className="adm-topbar">
              <div>
                <h2>👥 Пользователи</h2>
                <div className="adm-sub">RPC admin_list_users · удаление с историей · сброс паролей через /api/admin-reset</div>
              </div>
            </div>
            <div className="adm-toolbar">
              <input className="adm-search" placeholder="🔍 Поиск по email / имени…" value={q} onChange={e => setQ(e.target.value)} />
              <select className="adm-search" value={fRole} onChange={e => setFRole(e.target.value)}>
                <option value="">Все роли</option><option value="admin">Админы</option><option value="user">Пользователи</option>
              </select>
              <button className="adm-btn secondary" onClick={loadUsers} disabled={loadingUsers}>
                {loadingUsers ? 'Загрузка…' : '⟳ Обновить'}
              </button>
              <div className="adm-count-note">Показано {shown.length} из {totalUsers}</div>
            </div>
            {usersError && <div className="adm-error">⚠ {usersError}</div>}
            <div className="adm-card" style={{ padding: '6px 0' }}>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr>
                    <th>Пользователь</th><th>Роль</th><th>Записей</th><th>Замеров</th>
                    <th>Регистрация</th><th>Активность</th><th style={{ textAlign: 'right' }}>Действия</th>
                  </tr></thead>
                  <tbody>
                    {loadingUsers && !users.length ? (
                      <tr><td colSpan={7}><div className="adm-empty">Загрузка списка пользователей…</div></td></tr>
                    ) : !shown.length ? (
                      <tr><td colSpan={7}><div className="adm-empty">{users.length ? 'Ничего не найдено 🔍' : 'Пользователей нет'}</div></td></tr>
                    ) : shown.map(u => {
                      const self = u.id === uid;
                      const demo = (u.email || '').startsWith('demo@');
                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="adm-u-cell">
                              <div className="adm-avatar">{initialsOf(u)}</div>
                              <div>
                                <div className="adm-u-name">{u.name || u.email || '—'}</div>
                                <div className="adm-u-email">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            {roleOf(u) === 'admin'
                              ? <span className="adm-tag admin">ADMIN</span>
                              : <span className="adm-tag user">USER</span>}
                            {demo && <span className="adm-tag demo" style={{ marginLeft: 6 }}>DEMO</span>}
                            {self && <span className="adm-tag self" style={{ marginLeft: 6 }}>это вы</span>}
                          </td>
                          <td>{Number(u.entries_count) || 0}</td>
                          <td>{Number(u.inbody_count) || 0}</td>
                          <td style={{ color: '#9ca3af' }}>{fmtDate(u.created_at)}</td>
                          <td style={{ color: '#9ca3af' }}>{fmtDate(u.last_activity)}</td>
                          <td>
                            <div className="adm-row-actions">
                              <button className="adm-btn sm secondary" disabled={busyId === u.id}
                                title="Отправить письмо со ссылкой смены пароля" onClick={() => doReset(u)}>
                                📩 Сброс пароля
                              </button>
                              <button className="adm-btn sm danger" disabled={self || busyId === u.id}
                                title={self ? 'Нельзя удалить самого себя' : 'Удалить вместе с историей'}
                                onClick={() => setConfirmDel(u)}>
                                🗑 Удалить
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="adm-sub" style={{ marginTop: 12 }}>
              Удаление необратимо: <span className="adm-code">admin_delete_user(target)</span> стирает аккаунт и каскадно всю историю
              (журнал, замеры, цели, блюда, профиль). «Сброс пароля» отправляет письмо со ссылкой восстановления.
            </div>
          </section>
        )}

        {/* ================= СПРАВОЧНИК БЛЮД ================= */}
        {page === 'dishes' && (
          <section className="adm-page active">
            <div className="adm-topbar">
              <div>
                <h2>🍽 Справочник блюд</h2>
                <div className="adm-sub">Таблица public.dishes · КБЖУ на порцию</div>
              </div>
              <button className="adm-btn" onClick={() => setDishDraft({ name: '', calories: 0, protein: 0, fat: 0, carbs: 0 })}>
                + Добавить блюдо
              </button>
            </div>
            {dishDraft && (
              <div className="adm-card" style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px' }}>
                  {dishDraft.id ? `✏️ Редактирование: ${dishDraft.name}` : '➕ Новое блюдо'}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                  <LabeledInput label="Название" value={dishDraft.name} onChange={v => setDishDraft({ ...dishDraft, name: v })} />
                  <LabeledInput label="Ккал" type="number" value={dishDraft.calories} onChange={v => setDishDraft({ ...dishDraft, calories: v })} />
                  <LabeledInput label="Белки, г" type="number" value={dishDraft.protein} onChange={v => setDishDraft({ ...dishDraft, protein: v })} />
                  <LabeledInput label="Жиры, г" type="number" value={dishDraft.fat} onChange={v => setDishDraft({ ...dishDraft, fat: v })} />
                  <LabeledInput label="Углеводы, г" type="number" value={dishDraft.carbs} onChange={v => setDishDraft({ ...dishDraft, carbs: v })} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="adm-btn sm" onClick={saveDish}>💾 Сохранить</button>
                    <button className="adm-btn sm secondary" onClick={() => setDishDraft(null)}>Отмена</button>
                  </div>
                </div>
              </div>
            )}
            <div className="adm-card" style={{ padding: '6px 0' }}>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr>
                    <th>Название</th><th>Калории</th><th>Белки</th><th>Жиры</th><th>Углеводы</th>
                    <th>Источник</th><th style={{ textAlign: 'right' }}>Действия</th>
                  </tr></thead>
                  <tbody>
                    {loadingDishes ? (
                      <tr><td colSpan={7}><div className="adm-empty">Загрузка блюд…</div></td></tr>
                    ) : !dishes.length ? (
                      <tr><td colSpan={7}><div className="adm-empty">Блюд пока нет</div></td></tr>
                    ) : dishes.map(d => (
                      <tr key={d.id}>
                        <td className="adm-u-name">{d.name}</td>
                        <td>{Math.round(d.calories || 0)} ккал</td>
                        <td>{num(d.protein)} г</td>
                        <td>{num(d.fat)} г</td>
                        <td>{num(d.carbs)} г</td>
                        <td>{d.user_id === uid
                          ? <span className="adm-tag admin">моё блюдо</span>
                          : <span className="adm-tag user">чужое</span>}</td>
                        <td>
                          <div className="adm-row-actions">
                            <button className="adm-btn sm secondary"
                              onClick={() => setDishDraft({ id: d.id, name: d.name, calories: d.calories || 0, protein: d.protein || 0, fat: d.fat || 0, carbs: d.carbs || 0 })}>
                              ✏️
                            </button>
                            {d.user_id === uid && (
                              <button className="adm-btn sm danger" onClick={() => deleteDish(d)}>🗑</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ================= НАСТРОЙКИ ================= */}
        {page === 'settings' && (
          <section className="adm-page active">
            <div className="adm-topbar">
              <div>
                <h2>⚙️ Настройки</h2>
                <div className="adm-sub">Конфигурация админки и сервисных ключей</div>
              </div>
            </div>
            <div className="adm-grid adm-grid-2" style={{ marginTop: 0 }}>
              <div className="adm-card">
                <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 16px' }}>Сервисные переменные</h3>
                <div className="adm-field" style={{ marginBottom: 14 }}>
                  <label>SUPABASE_SERVICE_ROLE_KEY (на хостинге)</label>
                  <input type="text" value="используется только в /api/admin-reset" readOnly />
                  <div className="adm-hint-ok">✔ Если ключ не задан, «Сброс пароля» вернёт понятную ошибку</div>
                </div>
                <div className="adm-field">
                  <label>Site URL / Redirect URLs</label>
                  <input type="text" defaultValue={`${window.location.origin}/#/auth?mode=recovery`} />
                </div>
                <div style={{ marginTop: 18 }}>
                  <button className="adm-btn" onClick={() => showToast('ℹ Настройки Auth изменяются в Supabase Dashboard → Authentication')}>
                    💾 Как сохранить
                  </button>
                </div>
              </div>
              <div className="adm-card">
                <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 16px' }}>Опасная зона</h3>
                <p className="adm-muted-p">
                  Удаление пользователей необратимо: RPC <span className="adm-code">admin_delete_user</span> каскадно
                  стирает журнал, замеры InBody, цели, блюда и профиль. Роли назначаются в таблице{' '}
                  <span className="adm-code">public.admin_roles</span> (supabase/admin.sql).
                </p>
                <button className="adm-btn danger"
                  onClick={() => showToast('🧹 Массовое удаление отключено — работайте по одному пользователю', 'danger')}>
                  🧹 Удалить всех demo-пользователей
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Модалка подтверждения удаления */}
      {confirmDel && (
        <div className="adm-backdrop open" onClick={e => { if (e.target === e.currentTarget) setConfirmDel(null); }}>
          <div className="adm-modal">
            <h3>🗑 Удалить пользователя?</h3>
            <p>Пользователь <b>{confirmDel.name || confirmDel.email}</b> ({confirmDel.email}) будет удалён вместе со всей историей.</p>
            <div className="adm-warn-box">
              Внимание: будут удалены <b>все данные</b> — {Number(confirmDel.entries_count) || 0} записей журнала,{' '}
              {Number(confirmDel.inbody_count) || 0} замеров, цели, блюда и профиль. Отменить это действие невозможно.
            </div>
            <div className="adm-modal-actions">
              <button className="adm-btn secondary" onClick={() => setConfirmDel(null)}>Отмена</button>
              <button className="adm-btn danger" disabled={busyId === confirmDel.id} onClick={() => doDelete(confirmDel)}>
                {busyId === confirmDel.id ? 'Удаление…' : 'Да, удалить всё'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- вспомогательные ---------- */
function Stat({ label, value, delta, up, danger }) {
  return (
    <div className="adm-card">
      <div className="adm-stat-label">{label}</div>
      <div className="adm-stat-value" style={danger ? { color: '#f87171' } : undefined}>{fmtNum(value)}</div>
      <div className={`adm-stat-delta${up ? ' up' : ''}`}>{delta}</div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = 'text' }) {
  return (
    <div className="adm-field">
      <label>{label}</label>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function fmtNum(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('ru-RU');
}
function num(v) { return Math.round((Number(v) || 0) * 10) / 10; }
function initialsOf(u) {
  const src = (u?.name || u?.email || '?').trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function isAdminRow(u) {
  const flags = u?.adm_flags;
  const inTable = Array.isArray(flags) ? flags.includes('admin') : !!u?.is_admin;
  return inTable || u?.app_role === 'admin';
}
