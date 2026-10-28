import { useState } from 'react';

import ChartsView from './ChartsView';
import InBodyTab from '@/features/inbody/InBodyTab';

function Journal({ history, goal, baseline, sim, todayData, inbodyLogs, onEditInbody, onDeleteInbody, onAddInbody }) {
  const [subTab, setSubTab] = useState('charts');
  return (
    <div>
      <div className="subtabs">
        <button className={`subtab ${subTab==='charts'?'active':''}`} onClick={() => setSubTab('charts')}>
          📊 Графики
        </button>
        <button className={`subtab ${subTab==='inbody'?'active':''}`} onClick={() => setSubTab('inbody')}>
          📋 Замеры InBody
        </button>
      </div>
      {subTab === 'charts' && (
        <ChartsView history={history} goal={goal} baseline={baseline} sim={sim} todayData={todayData} />
      )}
      {subTab === 'inbody' && (
        <InBodyTab inbodyLogs={inbodyLogs} baseline={baseline}
          onEdit={onEditInbody} onDelete={onDeleteInbody} onAdd={onAddInbody} />
      )}
    </div>
  );
}

export default Journal;
