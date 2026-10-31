import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// DECISION: смена пароля залогиненным пользователем (доп. ТЗ п.3) — модалка поверх профиля.
// Текущий пароль в Supabase запрашивать нельзя (нет такого API), поэтому используется
// standard-паттерн «reauthentication»: updateUser({password}) требует свежую сессии,
// при ошибке подсказываем перезайти. Валидация ≥6 символов и совпадения — как на экране входа.
export default function ChangePasswordModal({ onClose, showToast }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (ev) => {
    ev.preventDefault();
    setError('');
    if (p1.length < 6) { setError('Пароль минимум 6 символов'); return; }
    if (p1 !== p2) { setError('Пароли не совпадают'); return; }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: p1 });
      if (err) throw err;
      showToast('✓ Пароль изменён');
      onClose();
    } catch (err) {
      const msg = String(err?.message || '');
      if (/invalid login credentials|security|relog/i.test(msg)) {
        setError('Сессия устарела — выйдите и войдите заново, затем повторите смену пароля.');
      } else {
        setError(msg || 'Не удалось изменить пароль');
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="modal-title">🔑 Смена пароля</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <form onSubmit={submit}>
            {error && <div className="auth-error" style={{ marginBottom: 12 }}>⚠ {error}</div>}
            <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
              <div className="field"><label>Новый пароль</label>
                <input type="password" placeholder="Минимум 6 символов" autoComplete="new-password"
                  value={p1} onChange={e => setP1(e.target.value)} /></div>
              <div className="field"><label>Повторите новый пароль</label>
                <input type="password" placeholder="Ещё раз тот же пароль" autoComplete="new-password"
                  value={p2} onChange={e => setP2(e.target.value)} /></div>
            </div>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Сохранение…' : 'Сменить пароль'}
            </button>
          </form>
          <div className="auth-note" style={{ textAlign: 'left' }}>
            После смены текущая сессия остаётся активной на этом устройстве. На других устройствах потребуется войти с новым паролем.
          </div>
        </div>
      </div>
    </div>
  );
}
