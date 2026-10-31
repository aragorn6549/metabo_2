import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import AuthScreen from '@/features/auth/AuthScreen';
import OnboardingScreen from '@/features/onboarding/OnboardingScreen';
import MetabolismMap from '@/features/map/MetabolismMap';
import ActivityHistory from '@/features/journal/ActivityHistory';
import GoalTab from '@/features/goal/GoalTab';
import DishesTab from '@/features/food/DishesTab';
import DishEditor from '@/features/food/DishEditor';
import Journal from '@/features/journal/Journal';
import HelpTab from '@/features/help/HelpTab';
import HelpContent from '@/features/help/HelpContent';
import MobileProfile from '@/features/profile/MobileProfile';
import AdminPanel from '@/features/admin/AdminPanel';
import ChangePasswordModal from '@/features/account/ChangePasswordModal';
import { fetchIsAdmin, invalidateAdminCache } from '@/lib/admin';
import MobileNav from '@/components/MobileNav';
import ActivityLogger from '@/features/activities/ActivityLogger';
import InBodyEditor from '@/features/inbody/InBodyEditor';
import { useMetaboStore } from '@/store/useMetaboStore';
import { buildDemoData } from '@/demo/demoData';

// DECISION: App — 1:1 структура прототипа (строки 2547–3057), заменены только:
// localStorage → Supabase (useMetaboStore), email-логин → Supabase Auth, демо-режим удалён (ТЗ §5.1).
export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  // DECISION: демо-режим по кнопке «Демонстрация» на экране входа — синтетические данные, БД не используется
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let alive = true;
    // DECISION: фикс мерцания дашборда — обработчик onAuthStateChange регистрируется ДО getSession(),
    // иначе события инициализации клиента (SIGNED_OUT при сбое restoreSession и т.п.), произошедшие
    // между ними, терялись и состояние рассинхронизировалось.
    // Также игнорируем ложные SIGNED_OUT из init-фазы: финальное слово за getSession().
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (session?.user) {
        setUser(session.user);
        setAuthChecked(true);
      } else if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_OUT') {
        setUser(null);
        setAuthChecked(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUser(data.session?.user || null);
      setAuthChecked(true);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const store = useMetaboStore(user);

  const [tab, setTab] = useState('map');
  const [mobileTab, setMobileTab] = useState('map');
  const [loggerOpen, setLoggerOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [dishEditorOpen, setDishEditorOpen] = useState(false);
  const [dishEditorDish, setDishEditorDish] = useState(null);
  const [inbodyEditorOpen, setInbodyEditorOpen] = useState(false);
  const [inbodyEditorEntry, setInbodyEditorEntry] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [editingBaseline, setEditingBaseline] = useState(false);
  // ===== Админка / пароли (доп. ТЗ) =====
  const [isAdmin, setIsAdmin] = useState(false);        // роль из public.admin_roles
  const [adminOpen, setAdminOpen] = useState(false);    // модалка списка пользователей
  const [changePwOpen, setChangePwOpen] = useState(false); // модалка смены своего пароля
  // ссылка восстановления из письма «Забыли пароль?» → #/auth?mode=recovery (implicit flow: токен в фрагменте)
  const [recoveryMode, setRecoveryMode] = useState(() =>
    typeof window !== 'undefined' && window.location.hash.includes('type=recovery'));

  useEffect(() => {
    // Событие PASSWORD_RECOVERY приходит, когда клиент обработал ссылку из письма —
    // показываем форму задания нового пароля даже если пользователь открыл ссылку во вкладке с приложением.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let alive = true;
    invalidateAdminCache();
    setIsAdmin(false);
    if (user?.id) fetchIsAdmin(user.id).then(v => { if (alive) setIsAdmin(v); });
    return () => { alive = false; };
  }, [user?.id]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const showToast = (msg, kind = 'success') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2500);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // DECISION: явный SIGNED_OUT обрабатываем здесь (в subscribe он игнорируется как ложный из init-фазы)
    setUser(null);
    setTab('map'); setMobileTab('map');
    setAdminOpen(false); setChangePwOpen(false); setIsAdmin(false); setRecoveryMode(false);
  };

  const { baseline, foodLogs, activities, dishes, goal, history, inbodyLogs, todayData, sim, plan } = store;

  const openLoggerNew = () => { setEditingEntry(null); setLoggerOpen(true); };
  const openLoggerEdit = (entry) => { setEditingEntry(entry); setLoggerOpen(true); };
  const closeLogger = () => { setLoggerOpen(false); setEditingEntry(null); };

  const handleSave = async (entry) => {
    await store.saveEntry(entry);
    if (editingEntry) showToast('✓ Изменения сохранены');
    else if (entry.type === 'food') showToast(`✓ ${entry.name || 'Приём пищи'} · ${entry.calories || 0} ккал`);
    else showToast(`✓ ${entry.type === 'workout' ? 'Тренировка' : entry.type === 'sleep' ? 'Сон' : 'Активность'}`);
    closeLogger();
  };

  const handleDelete = (entry) => {
    store.deleteEntry(entry);
    showToast('Удалено', 'danger');
  };

  const handleSetGoal = async (g) => {
    try {
      await store.setGoal(g);
      showToast(`🎯 Цель: ${g.targetValue}${g.assessment?.targetUnit || ''}`, 'goal');
    } catch (err) {
      console.error('setGoal:', err);
      showToast('⚠ Не удалось сохранить цель: ' + (err?.message || 'ошибка БД'), 'danger');
    }
  };

  const handleDeleteGoal = async () => {
    try {
      await store.deleteGoal();
      showToast('Цель удалена', 'danger');
    } catch (err) {
      console.error('deleteGoal:', err);
      showToast('⚠ Не удалось удалить цель: ' + (err?.message || 'ошибка БД'), 'danger');
    }
  };

  const openDishEditor = (dish) => { setDishEditorDish(dish); setDishEditorOpen(true); };
  const closeDishEditor = () => { setDishEditorOpen(false); setDishEditorDish(null); };
  const handleSaveDish = (dish) => {
    store.saveDish(dish);
    showToast(dish.id ? `✓ Обновлено: ${dish.name}` : `✓ Добавлено: ${dish.name}`);
    closeDishEditor();
  };
  const handleDeleteDish = (dish) => {
    store.deleteDish(dish);
    showToast(`Удалено: ${dish.name}`, 'danger');
  };

  const openInbodyEditorNew = () => { setInbodyEditorEntry(null); setInbodyEditorOpen(true); };
  const openInbodyEditorEdit = (entry) => { setInbodyEditorEntry(entry); setInbodyEditorOpen(true); };
  const closeInbodyEditor = () => { setInbodyEditorOpen(false); setInbodyEditorEntry(null); };
  const handleSaveInbody = async (entry) => {
    // DECISION: ждём фактической записи в Supabase — toast «обновлён/добавлен» больше не врёт при ошибке БД
    try {
      await store.saveInbody(entry);
      showToast(entry.id ? '✓ Замер обновлён' : '✓ Замер добавлен');
      closeInbodyEditor();
    } catch (err) {
      console.error('saveInbody:', err);
      showToast('⚠ Не удалось сохранить замер: ' + (err?.message || 'ошибка БД'), 'danger');
    }
  };
  const handleDeleteInbody = (entry) => {
    store.deleteInbody(entry);
    showToast('Замер удалён', 'danger');
  };

  const handleOnboardingComplete = async (data) => {
    await store.updateBaseline(data); // profiles + первый inbody_log на сегодня (ТЗ §5.2)
    const wasEditing = editingBaseline; // baseline уже пересчитается из стора после сохранения
    setEditingBaseline(false);
    showToast(wasEditing ? '✓ Данные обновлены' : '👋 Добро пожаловать!');
  };

  if (!authChecked) return <div className="app" />;
  if (demo) return <DemoApp onExit={() => setDemo(false)} showToast={showToast} toast={toast} />;
  // доп. ТЗ п.2: пользователь перешёл по ссылке восстановления из письма — задаём новый пароль
  // прямо поверх приложения (сессия recovery уже активна, AuthScreen в режиме recovery обновит пароль).
  if (!user || recoveryMode) {
    return (
      <AuthScreen
        key={recoveryMode ? 'recovery' : 'login'}
        onDemo={() => { setTab('map'); setMobileTab('map'); setDemo(true); }}
        initialMode={recoveryMode ? 'recovery' : 'login'}
        onRecovered={() => setRecoveryMode(false)}
      />
    );
  }
  if (!baseline || editingBaseline) {
    return <OnboardingScreen key={editingBaseline ? 'edit' : 'new'} initial={baseline}
      onComplete={handleOnboardingComplete}
      onCancel={baseline ? () => setEditingBaseline(false) : null} />;
  }
  if (store.loading) return <div className="app"><div className="empty-state">Загрузка…</div></div>;

  const hasAnyData = foodLogs.length > 0 || activities.length > 0;
  const goToGoal = () => { setTab('goal'); setMobileTab('goal'); };
  const userEmail = user.email || '';

  if (isMobile) {
    return (
      <div className="app">
        <div className="mobile-header">
          <div className="logo">Meta<span>bo</span></div>
          <div className="mobile-user">
            <div className="mobile-avatar" style={{ cursor: 'pointer' }}
              onClick={() => setMobileTab('profile')}>
              {(baseline.name || userEmail).charAt(0).toUpperCase()}
            </div>
            <span>{(baseline.name || userEmail.split('@')[0])}</span>
          </div>
        </div>
        <div className="mobile-content">
          {mobileTab === 'map' && todayData && (
            <>
              <MetabolismMap baseline={baseline} todayData={todayData} sim={sim} plan={plan}
                hasAnyData={hasAnyData} goal={goal}
                foodLogs={foodLogs} activities={activities}
                onOpenLogger={openLoggerNew} onGoToGoal={goToGoal} />
              <ActivityHistory foodLogs={foodLogs} activities={activities}
                onEdit={openLoggerEdit} onDelete={handleDelete} />
            </>
          )}
          {mobileTab === 'goal' && todayData && (
            <><div className="mobile-page-title">Цель</div>
              <GoalTab baseline={baseline} tdee={todayData.tdee} goal={goal} plan={plan} onSetGoal={handleSetGoal} onDeleteGoal={handleDeleteGoal} /></>
          )}
          {mobileTab === 'dishes' && (
            <DishesTab dishes={dishes} onEditDish={openDishEditor} onDeleteDish={handleDeleteDish}
              onAddDish={() => openDishEditor(null)} />
          )}
          {mobileTab === 'journal' && (
            <><div className="mobile-page-title">Журнал</div>
              <Journal history={history} goal={goal} baseline={baseline} sim={sim} todayData={todayData}
                inbodyLogs={inbodyLogs} onEditInbody={openInbodyEditorEdit}
                onDeleteInbody={handleDeleteInbody} onAddInbody={openInbodyEditorNew} /></>
          )}
          {mobileTab === 'profile' && (
            <MobileProfile user={userEmail} baseline={baseline} goal={goal}
              onLogout={handleLogout} onUpdateBaseline={openInbodyEditorNew}
              onOpenHelp={() => setHelpOpen(true)} onChangePassword={() => setChangePwOpen(true)} />
          )}
        </div>
        <MobileNav tab={mobileTab} onTab={setMobileTab} onAdd={openLoggerNew} />
        {loggerOpen && <ActivityLogger baseline={baseline} editingEntry={editingEntry}
          dishes={dishes} onClose={closeLogger} onSave={handleSave} />}
        {dishEditorOpen && <DishEditor dish={dishEditorDish} onSave={handleSaveDish} onClose={closeDishEditor} />}
        {inbodyEditorOpen && <InBodyEditor entry={inbodyEditorEntry} baseline={baseline}
          onSave={handleSaveInbody} onClose={closeInbodyEditor} />}
        {helpOpen && (
          <div className="modal-backdrop" onClick={() => setHelpOpen(false)}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">📖 Справка</div>
                <button className="close-btn" onClick={() => setHelpOpen(false)}>×</button>
              </div>
              <div className="modal-body"><HelpContent /></div>
            </div>
          </div>
        )}
        {/* доп. ТЗ: админка доступна и на мобильном — кнопка в шапке; смена пароля — из профиля */}
        {isAdmin && <AdminPanel currentUserId={user.id} onClose={() => setAdminOpen(false)} showToast={showToast} />}
        {changePwOpen && <ChangePasswordModal onClose={() => setChangePwOpen(false)} showToast={showToast} />}
        {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div className="logo">Meta<span>bo</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="tabs">
            <button className={`tab ${tab === 'map' ? 'active' : ''}`} onClick={() => setTab('map')}>Карта</button>
            <button className={`tab ${tab === 'goal' ? 'active' : ''}`} onClick={() => setTab('goal')}>Цель</button>
            <button className={`tab ${tab === 'dishes' ? 'active' : ''}`} onClick={() => setTab('dishes')}>Рацион</button>
            <button className={`tab ${tab === 'journal' ? 'active' : ''}`} onClick={() => setTab('journal')}>Журнал</button>
            <button className={`tab ${tab === 'help' ? 'active' : ''}`} onClick={() => setTab('help')}>📖 Справка</button>
            {/* доп. ТЗ п.1: вкладка админки видна только пользователям с ролью admin */}
            {isAdmin && (
              <button className="tab admin-tab" onClick={() => setAdminOpen(true)}>🛡 Админка</button>
            )}
          </div>
          <button className="logout-btn" onClick={() => setChangePwOpen(true)} title="Сменить пароль">🔑 Пароль</button>
          <div className="mobile-avatar" style={{ cursor: 'pointer' }} title={userEmail}>
            {(baseline.name || userEmail).charAt(0).toUpperCase()}
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Выйти из аккаунта">⏻ Выйти</button>
        </div>
      </div>
      {tab === 'map' && todayData && (
        <>
          <MetabolismMap baseline={baseline} todayData={todayData} sim={sim} plan={plan}
            hasAnyData={hasAnyData} goal={goal}
            foodLogs={foodLogs} activities={activities}
            onOpenLogger={openLoggerNew} onGoToGoal={goToGoal} />
          <ActivityHistory foodLogs={foodLogs} activities={activities}
            onEdit={openLoggerEdit} onDelete={handleDelete} />
        </>
      )}
      {tab === 'goal' && todayData && (
        <GoalTab baseline={baseline} tdee={todayData.tdee} goal={goal} plan={plan} onSetGoal={handleSetGoal} onDeleteGoal={handleDeleteGoal} />
      )}
      {tab === 'dishes' && (
        <DishesTab dishes={dishes} onEditDish={openDishEditor} onDeleteDish={handleDeleteDish}
          onAddDish={() => openDishEditor(null)} />
      )}
      {tab === 'journal' && (
        <Journal history={history} goal={goal} baseline={baseline} sim={sim} todayData={todayData}
          inbodyLogs={inbodyLogs} onEditInbody={openInbodyEditorEdit}
          onDeleteInbody={handleDeleteInbody} onAddInbody={openInbodyEditorNew} />
      )}
      {tab === 'help' && <HelpTab />}
      {isAdmin && <AdminPanel currentUserId={user.id} onClose={() => setAdminOpen(false)} showToast={showToast} />}
      {changePwOpen && <ChangePasswordModal onClose={() => setChangePwOpen(false)} showToast={showToast} />}
      {loggerOpen && <ActivityLogger baseline={baseline} editingEntry={editingEntry}
        dishes={dishes} onClose={closeLogger} onSave={handleSave} />}
      {dishEditorOpen && <DishEditor dish={dishEditorDish} onSave={handleSaveDish} onClose={closeDishEditor} />}
      {inbodyEditorOpen && <InBodyEditor entry={inbodyEditorEntry} baseline={baseline}
        onSave={handleSaveInbody} onClose={closeInbodyEditor} />}
      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}

// ============================================================
// ДЕМО-РЕЖИМ (кнопка «Демонстрация» на экране входа)
// DECISION: те же компоненты вкладок, что и в боевом режиме; данные — синтетические из
// src/demo/demoData.js (та же математика приложения), Supabase/БД не вызывается ни разу.
// Все мутации — no-op с предупреждающим тостом.
function DemoApp({ onExit, showToast, toast }) {
  const [tab, setTab] = useState('map');
  const [mobileTab, setMobileTab] = useState('map');
  const [loggerOpen, setLoggerOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const data = useMemo(() => buildDemoData(), []);
  const { baseline, foodLogs, activities, dishes, goal, history, inbodyLogs, todayData, sim, plan } = data;
  const hasAnyData = true;

  const demoBlocked = () => showToast('🎬 В демо-режиме изменения не сохраняются', 'danger');
  const openLoggerNew = () => { setEditingEntry(null); setLoggerOpen(true); };
  const openLoggerEdit = (entry) => { setEditingEntry(entry); setLoggerOpen(true); };
  const closeLogger = () => { setLoggerOpen(false); setEditingEntry(null); };
  const goToGoal = () => { setTab('goal'); setMobileTab('goal'); };

  const banner = (
    <div style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.4)',
      color: 'var(--goal)', borderRadius: 12, padding: '8px 14px', margin: '10px 16px 0',
      fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <span>🎬 Демонстрационный режим — данные синтетические, без аккаунта и БД</span>
      <button className="logout-btn" onClick={onExit}>← Назад к входу</button>
    </div>
  );

  if (isMobile) {
    return (
      <div className="app">
        <div className="mobile-header">
          <div className="logo">Meta<span>bo</span></div>
          <div className="mobile-user">
            <div className="mobile-avatar">{baseline.name.charAt(0).toUpperCase()}</div>
            <span>{baseline.name}</span>
          </div>
        </div>
        {banner}
        <div className="mobile-content">
          {mobileTab === 'map' && (
            <>
              <MetabolismMap baseline={baseline} todayData={todayData} sim={sim} plan={plan}
                hasAnyData={hasAnyData} goal={goal} foodLogs={foodLogs} activities={activities}
                onOpenLogger={openLoggerNew} onGoToGoal={goToGoal} />
              <ActivityHistory foodLogs={foodLogs} activities={activities}
                onEdit={openLoggerEdit} onDelete={demoBlocked} />
            </>
          )}
          {mobileTab === 'goal' && (
            <><div className="mobile-page-title">Цель</div>
              <GoalTab baseline={baseline} tdee={todayData.tdee} goal={goal} plan={plan} onSetGoal={demoBlocked} onDeleteGoal={demoBlocked} /></>
          )}
          {mobileTab === 'dishes' && (
            <DishesTab dishes={dishes} onEditDish={demoBlocked} onDeleteDish={demoBlocked} onAddDish={demoBlocked} />
          )}
          {mobileTab === 'journal' && (
            <><div className="mobile-page-title">Журнал</div>
              <Journal history={history} goal={goal} baseline={baseline} sim={sim} todayData={todayData}
                inbodyLogs={inbodyLogs} onEditInbody={demoBlocked} onDeleteInbody={demoBlocked} onAddInbody={demoBlocked} /></>
          )}
          {mobileTab === 'profile' && (
            <MobileProfile user="demo@metabo.app" baseline={baseline} goal={goal}
              onLogout={onExit} onUpdateBaseline={demoBlocked} onChangePassword={demoBlocked}
              onOpenHelp={() => showToast('🎬 Справка доступна в основном режиме', 'danger')} />
          )}
        </div>
        <MobileNav tab={mobileTab} onTab={setMobileTab} onAdd={openLoggerNew} />
        {loggerOpen && <ActivityLogger baseline={baseline} editingEntry={editingEntry}
          dishes={dishes} onClose={closeLogger} onSave={(e) => { demoBlocked(); closeLogger(); void e; }} />}
        {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div className="logo">Meta<span>bo</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="tabs">
            <button className={`tab ${tab === 'map' ? 'active' : ''}`} onClick={() => setTab('map')}>Карта</button>
            <button className={`tab ${tab === 'goal' ? 'active' : ''}`} onClick={() => setTab('goal')}>Цель</button>
            <button className={`tab ${tab === 'dishes' ? 'active' : ''}`} onClick={() => setTab('dishes')}>Рацион</button>
            <button className={`tab ${tab === 'journal' ? 'active' : ''}`} onClick={() => setTab('journal')}>Журнал</button>
          </div>
          <div className="mobile-avatar" title="Демо-аккаунт">{baseline.name.charAt(0).toUpperCase()}</div>
          <button className="logout-btn" onClick={onExit} title="Выйти из демонстрации">← К входу</button>
        </div>
      </div>
      {banner}
      {tab === 'map' && (
        <>
          <MetabolismMap baseline={baseline} todayData={todayData} sim={sim} plan={plan}
            hasAnyData={hasAnyData} goal={goal} foodLogs={foodLogs} activities={activities}
            onOpenLogger={openLoggerNew} onGoToGoal={goToGoal} />
          <ActivityHistory foodLogs={foodLogs} activities={activities}
            onEdit={openLoggerEdit} onDelete={demoBlocked} />
        </>
      )}
      {tab === 'goal' && (
        <GoalTab baseline={baseline} tdee={todayData.tdee} goal={goal} plan={plan} onSetGoal={demoBlocked} onDeleteGoal={demoBlocked} />
      )}
      {tab === 'dishes' && (
        <DishesTab dishes={dishes} onEditDish={demoBlocked} onDeleteDish={demoBlocked} onAddDish={demoBlocked} />
      )}
      {tab === 'journal' && (
        <Journal history={history} goal={goal} baseline={baseline} sim={sim} todayData={todayData}
          inbodyLogs={inbodyLogs} onEditInbody={demoBlocked} onDeleteInbody={demoBlocked} onAddInbody={demoBlocked} />
      )}
      {loggerOpen && <ActivityLogger baseline={baseline} editingEntry={editingEntry}
        dishes={dishes} onClose={closeLogger} onSave={(e) => { demoBlocked(); closeLogger(); void e; }} />}
      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}





if (user?.id) fetchIsAdmin(user.id, user).then(v => { if (alive) setIsAdmin(v); });
