import React from 'react';
import type { PlayerState, AppliedEffect } from '../../types/agents';

interface PlayerStatsBarProps {
  playerState: PlayerState;
  characterName: string;
  currentLocation?: string;
  lastEffects?: AppliedEffect[];
}

const PlayerStatsBar: React.FC<PlayerStatsBarProps> = ({ 
  playerState, 
  characterName,
  currentLocation,
  lastEffects = []
}) => {
  const { stats, inventory, relationships } = playerState;

  // Find recent effect for animation
  const getRecentEffect = (attr: string) => {
    return lastEffects.find(e => e.description.toLowerCase().includes(attr.toLowerCase()));
  };

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      left: 12,
      backgroundColor: 'rgba(10, 10, 15, 0.9)',
      border: '1px solid #2a2a35',
      borderRadius: '8px',
      padding: '10px 14px',
      zIndex: 50,
      minWidth: '200px',
      backdropFilter: 'blur(8px)'
    }}>
      {/* Character name & location */}
      <div style={{ marginBottom: '8px', borderBottom: '1px solid #2a2a35', paddingBottom: '8px' }}>
        <div style={{ color: '#4ecdc4', fontSize: '13px', fontWeight: 500 }}>
          {characterName}
        </div>
        {currentLocation && (
          <div style={{ color: '#666', fontSize: '11px', marginTop: '2px' }}>
            📍 {currentLocation}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* Gold */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>💰</span>
          <span style={{ color: '#f1c40f', fontSize: '13px', fontWeight: 500 }}>
            {stats.gold}
          </span>
          <span style={{ color: '#666', fontSize: '10px' }}>золото</span>
          {getRecentEffect('золото') && (
            <span style={{ 
              color: getRecentEffect('золото')!.type === 'positive' ? '#2ecc71' : '#e74c3c',
              fontSize: '11px',
              animation: 'pulse 0.5s ease'
            }}>
              {getRecentEffect('золото')!.description.includes('+') ? '↑' : '↓'}
            </span>
          )}
        </div>

        {/* Reputation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>⭐</span>
          <span style={{ 
            color: stats.reputation >= 0 ? '#2ecc71' : '#e74c3c', 
            fontSize: '13px', 
            fontWeight: 500 
          }}>
            {stats.reputation > 0 ? '+' : ''}{stats.reputation}
          </span>
          <span style={{ color: '#666', fontSize: '10px' }}>репутация</span>
        </div>

        {/* Influence */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>👑</span>
          <span style={{ color: '#9b59b6', fontSize: '13px', fontWeight: 500 }}>
            {stats.influence}
          </span>
          <span style={{ color: '#666', fontSize: '10px' }}>влияние</span>
        </div>
      </div>

      {/* Inventory (if any) */}
      {inventory.length > 0 && (
        <div style={{ 
          marginTop: '8px', 
          paddingTop: '8px', 
          borderTop: '1px solid #2a2a35' 
        }}>
          <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>
            ИНВЕНТАРЬ
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {inventory.slice(0, 4).map((item, i) => (
              <span key={i} style={{
                backgroundColor: '#1a1a22',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                color: '#888'
              }}>
                {item.name} {item.quantity > 1 && `×${item.quantity}`}
              </span>
            ))}
            {inventory.length > 4 && (
              <span style={{ color: '#666', fontSize: '10px' }}>
                +{inventory.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Key relationships */}
      {relationships.filter(r => r.status !== 'neutral').length > 0 && (
        <div style={{ 
          marginTop: '8px', 
          paddingTop: '8px', 
          borderTop: '1px solid #2a2a35' 
        }}>
          <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>
            ОТНОШЕНИЯ
          </div>
          {relationships.filter(r => r.status !== 'neutral').slice(0, 3).map((rel, i) => (
            <div key={i} style={{ 
              fontSize: '10px', 
              color: rel.relation > 0 ? '#3498db' : '#e67e22',
              marginTop: '2px'
            }}>
              {rel.npcName}: {rel.status === 'ally' ? '🤝' : rel.status === 'enemy' ? '⚔️' : '👁️'}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default PlayerStatsBar;


