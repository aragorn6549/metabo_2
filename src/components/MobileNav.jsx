import { IconMap, IconGoal, IconJournal, IconMenu } from './icons';

function MobileNav({ tab, onTab, onAdd }) {
  return (
    <div className="mobile-nav">
      <button className={`mobile-nav-item ${tab==='map'?'active':''}`} onClick={()=>onTab('map')}><IconMap />Карта</button>
      <button className={`mobile-nav-item ${tab==='goal'?'active':''}`} onClick={()=>onTab('goal')}><IconGoal />Цель</button>
      <button className="mobile-nav-add" onClick={onAdd} aria-label="Добавить">+</button>
      <button className={`mobile-nav-item ${tab==='dishes'?'active':''}`} onClick={()=>onTab('dishes')}><IconMenu />Рацион</button>
      <button className={`mobile-nav-item ${tab==='journal'?'active':''}`} onClick={()=>onTab('journal')}><IconJournal />Журнал</button>
    </div>
  );
}


export default MobileNav;
