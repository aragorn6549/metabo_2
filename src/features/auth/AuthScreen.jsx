import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// DECISION: 1:1 разметка AuthScreen из прототипа; localStorage-авторизация заменена на Supabase Auth (ТЗ §5.1).
// Демо-режим возвращён по запросу пользователя: открывается кнопкой «Демонстрация», данные синтетические (src/demo),
// БД не используется. Валидация пароля ≥6 символов (ТЗ §5.1).
// Админка/пароли (доп. ТЗ): на экране входа добавлен режим «Забыли пароль?» — письмо со ссылкой восстановления
// через supabase.auth.resetPasswordForEmail; по ссылке приложение открывает этот же экран в режиме recovery,
// где пользователь задаёт новый пароль (supabase.auth.updateUser).
export default function AuthScreen({ onDemo, initialMode = 'login', onRecovered }) {
  const [mode, setMode] = useState(initialMode); // login | register | forgot | recovery
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const switchMode = (m) => { setMode(m); setError(''); setInfo(''); setPassword(''); setPassword2(''); };

  const doAuth = async () => {
    setError(''); setInfo('');
    const e = email.trim();
    if (!e || !password) { setError('Заполните оба поля'); return; }
    if (!e.includes('@')) { setError('Введите корректный email'); return; }
    if (password.length < 6) { setError('Пароль минимум 6 символов'); return; }

    // Режим «новый пароль по ссылке из письма»: сессия recovery уже активна, меняем пароль через updateUser
    if (mode === 'recovery') {
      if (password !== password2) { setError('Пароли не совпадают'); return; }
      setBusy(true);
      try {
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) throw err;
        setInfo('✓ Пароль обновлён. Вы вошли в аккаунт.');
        // приложение само подхватит восстановленную сессию (onAuthStateChange)
        if (onRecovered) setTimeout(onRecovered, 800);
      } catch (err) {
        setError(String(err.message || 'Не удалось изменить пароль'));
      } finally { setBusy(false); }
      return;
    }

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

  const doForgot = async () => {
    setError(''); setInfo('');
    const e = email.trim();
    if (!e) { setError('Укажите email'); return; }
    if (!e.includes('@')) { setError('Введите корректный email'); return; }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo: `${window.location.origin}${window.location.pathname}#/auth?mode=recovery`,
      });
      if (err) throw err;
      setInfo('📩 Если такой аккаунт существует, мы отправили письмо со ссылкой для восстановления пароля. Проверьте почту (и папку «Спам»).');
    } catch (err) {
      const msg = String(err.message || '');
      if (/rate limit/i.test(msg)) setError('Слишком много запросов. Попробуйте через минуту.');
      else setError(msg || 'Не удалось отправить письмо. Попробуйте позже.');
    } finally { setBusy(false); }
  };

  const isForgot = mode === 'forgot';
  const isRecovery = mode === 'recovery';

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-logo">Meta<span>bo</span></div>
        <div className="auth-tag">Метаболизм в реальном времени</div>
        {!isRecovery && (
          <div className="auth-switch">
            <button type="button" className={mode === 'login' ? 'active' : ''}
              onClick={() => switchMode('login')}>Вход</button>
            <button type="button" className={mode === 'register' ? 'active' : ''}
              onClick={() => switchMode('register')}>Регистрация</button>
          </div>
        )}
        {isForgot && <div className="auth-note" style={{ marginTop: 0, marginBottom: 14 }}>🔑 Восстановление пароля — укажите email, отправим ссылку</div>}
        {isRecovery && <div className="auth-note" style={{ marginTop: 0, marginBottom: 14 }}>🔑 Задайте новый пароль для вашего аккаунта</div>}
        <form onSubmit={(ev) => { ev.preventDefault(); isForgot ? doForgot() : doAuth(); }}>
          {error && <div className="auth-error">⚠ {error}</div>}
          {info && <div className="auth-note" style={{ marginTop: 0, marginBottom: 12 }}>{info}</div>}
          <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
            {!isRecovery && (
              <div className="field"><label>Email</label>
                <input type="text" inputMode="email" placeholder="you@example.com" autoComplete="email"
                  value={email} onChange={(ev) => setEmail(ev.target.value)} /></div>
            )}
            {!isForgot && (
              <div className="field"><label>{isRecovery ? 'Новый пароль' : 'Пароль'}</label>
                <input type="password" placeholder="Минимум 6 символов"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password} onChange={(ev) => setPassword(ev.target.value)} /></div>
            )}
            {isRecovery && (
              <div className="field"><label>Повторите новый пароль</label>
                <input type="password" placeholder="Ещё раз тот же пароль" autoComplete="new-password"
                  value={password2} onChange={(ev) => setPassword2(ev.target.value)} /></div>
            )}
          </div>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Подождите…'
              : isForgot ? 'Отправить ссылку восстановления'
              : isRecovery ? 'Сохранить новый пароль'
              : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>
        {!isForgot && !isRecovery && (
          <button type="button" className="link-btn" onClick={() => switchMode('forgot')}>
            Забыли пароль? Восстановить доступ
          </button>
        )}
        {(isForgot || isRecovery) && (
          <button type="button" className="link-btn" onClick={() => switchMode('login')}>
            ← Вернуться ко входу
          </button>
        )}
        <button type="button" className="btn secondary" onClick={onDemo}
          style={{ marginTop: 12, opacity: 0.9 }}>🎬 Демонстрация</button>
        <div className="auth-note">Данные хранятся в вашем личном Supabase-аккаунте.</div>
      </div>
    </div>
  );
}
