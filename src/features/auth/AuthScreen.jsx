import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// DECISION: 1:1 разметка AuthScreen из прототипа; localStorage-авторизация заменена на Supabase Auth (ТЗ §5.1),
// демо-режим удалён (ТЗ §5.1 п.4). Валидация пароля ≥6 символов (ТЗ §5.1).
export default function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const doAuth = async () => {
    setError(''); setInfo('');
    const e = email.trim();
    if (!e || !password) { setError('Заполните оба поля'); return; }
    if (!e.includes('@')) { setError('Введите корректный email'); return; }
    if (password.length < 6) { setError('Пароль минимум 6 символов'); return; }
    setBusy(true);
    try {
      if (mode === 'register') {
        const { data, error: err } = await supabase.auth.signUp({ email: e, password });
        if (err) throw err;
        if (!data.session) setInfo('Аккаунт создан. Подтвердите email и войдите.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: e, password });
        if (err) throw err;
      }
    } catch (err) {
      const msg = String(err.message || '');
      if (/Invalid login credentials/i.test(msg)) setError('Неверный email или пароль');
      else if (/already registered|User already/i.test(msg)) setError('Пользователь уже существует. Переключитесь на «Вход».');
      else setError(msg || 'Ошибка сервера');
    } finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-logo">Meta<span>bo</span></div>
        <div className="auth-tag">Метаболизм в реальном времени</div>
        <div className="auth-switch">
          <button type="button" className={mode === 'login' ? 'active' : ''}
            onClick={() => { setMode('login'); setError(''); setInfo(''); }}>Вход</button>
          <button type="button" className={mode === 'register' ? 'active' : ''}
            onClick={() => { setMode('register'); setError(''); setInfo(''); }}>Регистрация</button>
        </div>
        <form onSubmit={(ev) => { ev.preventDefault(); doAuth(); }}>
          {error && <div className="auth-error">⚠ {error}</div>}
          {info && <div className="auth-note" style={{ marginTop: 0, marginBottom: 12 }}>{info}</div>}
          <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
            <div className="field"><label>Email</label>
              <input type="text" inputMode="email" placeholder="you@example.com" autoComplete="email"
                value={email} onChange={(ev) => setEmail(ev.target.value)} /></div>
            <div className="field"><label>Пароль</label>
              <input type="password" placeholder="Минимум 6 символов"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password} onChange={(ev) => setPassword(ev.target.value)} /></div>
          </div>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>
        <div className="auth-note">Данные хранятся в вашем личном Supabase-аккаунте.</div>
      </div>
    </div>
  );
}
