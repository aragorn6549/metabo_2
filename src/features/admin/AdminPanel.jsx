import { useEffect, useState } from 'react';
import { adminListUsers, adminDeleteUser, adminSendPasswordReset } from '@/lib/admin';

// DECISION: Админка — модальное окно (тот же паттерн, что HelpModal/редакторы), открывается
// вкладкой «Админка» в шапке только пользователям с ролью admin (public.admin_roles, supabase/admin.sql).
// Возможности (доп. ТЗ):
//   1) удаление пользователя ВМЕСТЕ со всей историей — RPC admin_delete_user (каскад по FK в БД);
//   2) отправка письма «сброс пароля» любому пользователю — через /api/admin-reset (service key на сервере).
// Удаление самого себя запрещено и на клиенте, и в RPC.

const fmtDate = (s) => s ? new Date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function AdminPanel({ currentUserId, onClose, showToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null); // user row pending delete
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      setUsers(await adminListUsers());
    } catch (err) {
      setError(String(err.message || err));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const q = filter.trim().toLowerCase();
  const shown = q ? users.filter(u => (u.email || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q)) : users;

  const doDelete = async (u) => {
    setBusyId(u.id);
    try {
      await adminDeleteUser(u.id);
      showToast(`Удалён: ${u.email} (вместе с историей)`, 'danger');
      setConfirmDel(null);
      await load();
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
    } catch (err) {
      showToast('⚠ ' + String(err.message || err), 'danger');
    } finally { setBusyId(null); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 860 }}>
        <div className="modal-header">
          <div className="modal-title">🛡 Админка · пользователи</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <input className="admin-filter" placeholder="Поиск по email / имени…"
              value={filter} onChange={e => setFilter(e.target.value)} />
            <button className="btn secondary" onClick={load} disabled={loading}>
              {loading ? 'Загрузка…' : '⟳ Обновить'}
            </button>
          </div>
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>⚠ {error}</div>}
          {loading && !users.length ? (
            <div className="empty-state">Загрузка списка пользователей…</div>
          ) : !shown.length ? (
            <div className="empty-state">{users.length ? 'Ничего не найдено' : 'Пользователей нет'}</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Email</th><th>Имя</th><th>Регистрация</th><th>Активность</th>
                    <th>Данные</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(u => (
                    <tr key={u.id} className={u.id === currentUserId ? 'admin-row-self' : ''}>
                      <td>
                        {u.email || '—'}
                        {u.is_admin && <span className="admin-badge">ADMIN</span>}
                        {u.id === currentUserId && <span className="admin-badge muted">это вы</span>}
                      </td>
                      <td>{u.name || '—'}</td>
                      <td>{fmtDate(u.created_at)}</td>
                      <td>{fmtDate(u.last_activity)}</td>
                      <td>{u.entries_count || 0} записей · {u.inbody_count || 0} замеров</td>
                      <td className="admin-actions">
                        <button className="btn secondary sm" onClick={() => doReset(u)}
                          disabled={busyId === u.id} title="Отправить письмо со ссылкой смены пароля">📩 Сброс пароля</button>
                        <button className="btn danger sm"
                          disabled={u.id === currentUserId || busyId === u.id}
                          onClick={() => setConfirmDel(u)}>🗑 Удалить</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="auth-note" style={{ textAlign: 'left', marginTop: 14 }}>
            Удаление необратимо: пользователь стирается вместе со всей историей (журнал, замеры, цели, блюда, профиль).
            «Сброс пароля» отправляет на email ссылку восстановления — по ней пользователь задаёт новый пароль.
          </div>
        </div>
        {confirmDel && (
          <div className="admin-confirm">
            <div className="admin-confirm-box">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Удалить {confirmDel.email}?</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                Будут удалены аккаунт и вся его история: {confirmDel.entries_count || 0} записей журнала,
                {' '}{confirmDel.inbody_count || 0} замеров, цели и блюда. Отменить это нельзя.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn secondary" onClick={() => setConfirmDel(null)}>Отмена</button>
                <button className="btn danger" disabled={busyId === confirmDel.id}
                  onClick={() => doDelete(confirmDel)}>
                  {busyId === confirmDel.id ? 'Удаление…' : 'Да, удалить всё'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
