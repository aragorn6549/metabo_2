import { useState } from 'react';


function HelpContent() {
  const [openId, setOpenId] = useState('netflux');
  return (
    <div>
      {HELP_SECTIONS.map(s => {
        const isOpen = openId === s.id;
        return (
          <div key={s.id} className="help-section">
            <div className="help-header" onClick={() => setOpenId(isOpen ? null : s.id)}>
              <div className="help-header-title">
                <span className="help-header-icon">{s.icon}</span><span>{s.title}</span>
              </div>
              <span className={`help-chevron ${isOpen ? 'open' : ''}`}>▼</span>
            </div>
            {isOpen && <div className="help-body">{s.body}</div>}
          </div>
        );
      })}
    </div>

export default HelpContent;
