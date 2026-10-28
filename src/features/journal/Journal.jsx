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

// ============================================================
// СПРАВКА
// ============================================================
const HELP_SECTIONS = [
  { id:'bmr', icon:'🔥', title:'BMR — Базовый обмен веществ', body: (
    <><p><strong>BMR</strong> — сколько калорий тело тратит в полном покое.</p>
    <div className="formula">Мужчины: BMR = 10 × вес[кг] + 6.25 × рост[см] − 5 × возраст[лет] + 5{"\n"}Женщины: BMR = 10 × вес[кг] + 6.25 × рост[см] − 5 × возраст[лет] − 161</div>
    <p>Погрешность ±5%. BMR — 60–75% общего расхода.</p></>
  )},
  { id:'tdee', icon:'⚡', title:'TDEE — Общий суточный расход', body: (
    <><p><strong>TDEE</strong> = BMR × активность + TEF + тренировки.</p></>
  )},
  { id:'tef', icon:'🍽', title:'TEF — Термический эффект пищи', body: (
    <><div className="formula">TEF = Белки×4×0.30 + Углеводы×4×0.10 + Жиры×9×0.03</div></>
  )},
  { id:'lipolysis', icon:'🔥', title:'Липолиз — расщепление жира', body: (
    <><div className="formula fat">Липолиз = (0.22 + буст_тренировки) × инсулин × циркадный × сон × дефицит</div></>
  )},
  { id:'esterification', icon:'🔴', title:'Эстерификация — хранение жира', body: (
    <><div className="formula lipo">Эстерификация = база × (1 + инсулин_сигнал) × (1 + профицит) + DNL</div></>
  )},
  { id:'netflux', icon:'⚖️', title:'Баланс жира', body: (
    <><div className="formula">Значение = −(липолиз − эстерификация){"\n\n"}Отрицательное (зелёное) → сжигается{"\n"}Положительное (красное) → откладывается</div></>
  )},
  { id:'inbody', icon:'📋', title:'Замеры InBody', body: (
    <><p>История измерений с расчётом дельт:</p>
    <ul className="help-list">
      <li>Каждый новый замер сравнивается с предыдущим по времени</li>
      <li><strong>% жира</strong>: снижение = хорошо (зелёный), рост = плохо (красный)</li>
      <li><strong>% мышц, BMR</strong>: рост = хорошо (зелёный), снижение = плохо (красный)</li>
      <li><strong>Вес, ИМТ</strong>: нейтральные (серые) — зависят от цели</li>
    </ul>
    <p><strong>Baseline</strong> для всех расчётов всегда = <strong>последний по дате</strong> замер. При удалении самого нового — модель пересчитывается от нового последнего.</p></>
  )},
  { id:'dishes', icon:'🍽', title:'Рацион и логирование еды', body: (
    <><p>При добавлении приёма пищи:</p>
    <ul className="help-list">
      <li>Сначала выбираешь блюдо из каталога <strong>«Рацион»</strong></li>
      <li>Если нужного блюда нет — кнопка «+ Новое блюдо» → форма с нуля</li>
      <li>Можно менять КБЖУ при логировании — это не изменит каталог (порции разные)</li>
      <li>Каталог редактируется отдельно: вкладка «Рацион» → ✎ у блюда</li>
      <li>Новые названия добавляются в каталог автоматически при сохранении приёма</li>

export default Journal;
