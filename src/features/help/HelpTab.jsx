import HelpContent from './HelpContent';

function HelpTab() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-1px', marginBottom: 6 }}>📖 Справка</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Как считаются все показатели</div>
      </div>
      <HelpContent />
    </div>

export default HelpTab;
