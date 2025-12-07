import React from 'react';

interface StatusBarProps {
  year: number;
  gold: number;
  mana: number;
}

const StatusBar: React.FC<StatusBarProps> = ({ year, gold, mana }) => {
  return (
    <div className="status-bar">
      <div className="status-item">
        <span className="status-label">Year:</span>
        <span className="status-value">{year}</span>
      </div>
      <div className="status-divider"></div>
      <div className="status-item">
        <span className="status-icon">🪙</span>
        <span className="status-value">{gold} Gold</span>
      </div>
      <div className="status-item">
        <span className="status-icon">✨</span>
        <span className="status-value">{mana} Mana</span>
      </div>
      
      <div className="status-actions">
        <button className="icon-btn" title="Inventory">🎒</button>
        <button className="icon-btn" title="Quests">📜</button>
        <button className="icon-btn" title="Settings">⚙️</button>
      </div>
    </div>
  );
};

export default StatusBar;





