import { useState, useEffect } from 'react';
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
import MobileNav from '@/components/MobileNav';
import ActivityLogger from '@/features/activities/ActivityLogger';
import InBodyEditor from '@/features/inbody/InBodyEditor';
import { useMetaboStore } from '@/store/useMetaboStore';

// DECISION: App — 1:1 структура прототипа (строки 2547–3057), заменены только:
// localStorage → Supabase (useMetaboStore), email-логин → Supabase Auth, демо-режим удалён (ТЗ §5.1).
export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => sub.subscription.unsubscribe();
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
    setUser(null);
    setTab('map'); setMobileTab('map');
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

  const handleSetGoal = (g) => {
    store.setGoal(g);
    showToast(`🎯 Цель: ${g.targetValue}${g.assessment?.targetUnit || ''}`, 'goal');
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
  const handleSaveInbody = (entry) => {
    store.saveInbody(entry);
    showToast(entry.id ? '✓ Замер обновлён' : '✓ Замер добавлен');
    closeInbodyEditor();
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
  if (!user) return <AuthScreen />;
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
              <GoalTab baseline={baseline} tdee={todayData.tdee} goal={goal} plan={plan} onSetGoal={handleSetGoal} /></>
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
              onOpenHelp={() => setHelpOpen(true)} />
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
          </div>
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
        <GoalTab baseline={baseline} tdee={todayData.tdee} goal={goal} plan={plan} onSetGoal={handleSetGoal} />
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
      {loggerOpen && <ActivityLogger baseline={baseline} editingEntry={editingEntry}
        dishes={dishes} onClose={closeLogger} onSave={handleSave} />}
      {dishEditorOpen && <DishEditor dish={dishEditorDish} onSave={handleSaveDish} onClose={closeDishEditor} />}
      {inbodyEditorOpen && <InBodyEditor entry={inbodyEditorEntry} baseline={baseline}
        onSave={handleSaveInbody} onClose={closeInbodyEditor} />}
      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}
