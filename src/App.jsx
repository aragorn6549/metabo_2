import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import useMetaboStore from './store/useMetaboStore';
import GoalTab from './features/goal/GoalTab.jsx';

function App() {
  const [tab, setTab] = useState('inbody');
  const [session, setSession] = useState(null);
  const { profile, logs, activeGoal, loadInitialData, setGoal, deleteGoal } = useMetaboStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadInitialData();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadInitialData();
    });
    return () => subscription.unsubscribe();
  }, []);

  const baseline = logs.length > 0 ? [...logs].sort((a,b)=>new Date(b.date)-new Date(a.date))[0] : null;
  const tdee = baseline ? 3000 : null; // Заглушка, заменить на реальный расчет

  if (!session) return <div>Вход через Supabase Auth...</div>;

  return (
    <div className="app">
      <nav>
        <button onClick={()=>setTab('inbody')} className={tab==='inbody'?'active':''}>InBody</button>
        <button onClick={()=>setTab('goal')} className={tab==='goal'?'active':''}>Цель</button>
      </nav>
      {tab === 'goal' && (
        <GoalTab
          baseline={baseline}
          tdee={tdee}
          goal={activeGoal}
          plan={null}
          onSetGoal={setGoal}
          onDeleteGoal={deleteGoal}
        />
      )}
    </div>
  );
}

export default App;
