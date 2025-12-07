import React, { useState, useEffect } from 'react';
import type { Scene, SceneChoice, PlayerState, AppliedEffect } from '../../types/agents';

interface SceneViewProps {
  scene: Scene;
  characterName: string;
  onChoice: (choice: SceneChoice) => void;
  isLoading?: boolean;
  playerState?: PlayerState;
  lastEffects?: AppliedEffect[];
}

const SceneView: React.FC<SceneViewProps> = ({ 
  scene, 
  characterName, 
  onChoice, 
  isLoading,
  playerState,
  lastEffects = []
}) => {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showEffects, setShowEffects] = useState(false);

  // Show effects notification when they change
  useEffect(() => {
    if (lastEffects.length > 0) {
      setShowEffects(true);
      const timer = setTimeout(() => setShowEffects(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastEffects]);

  // Reset selection when scene changes
  useEffect(() => {
    setSelectedChoice(null);
  }, [scene?.id]);

  if (!scene) return null;

  const getToneStyle = (tone: SceneChoice['tone']) => {
    const styles: Record<string, { color: string; icon: string }> = {
      aggressive: { color: '#e74c3c', icon: '⚔️' },
      diplomatic: { color: '#3498db', icon: '🤝' },
      cunning: { color: '#9b59b6', icon: '🎭' },
      noble: { color: '#f1c40f', icon: '👑' },
      cautious: { color: '#95a5a6', icon: '🛡️' }
    };
    return styles[tone] || { color: '#7f8c8d', icon: '•' };
  };

  const handleChoiceClick = (choice: SceneChoice) => {
    if (isLoading) return;
    setSelectedChoice(choice.id);
    onChoice(choice);
  };

  // Minimized - compact bar
  if (isMinimized) {
    return (
      <button 
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(15, 15, 20, 0.95)',
          border: '1px solid #4ecdc4',
          borderRadius: '24px',
          padding: '10px 24px',
          cursor: 'pointer',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}
      >
        <span style={{ fontSize: '14px' }}>📖</span>
        <span style={{ color: '#fff', fontSize: '13px' }}>Продолжить историю</span>
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 99
      }} onClick={() => setIsMinimized(true)} />

      {/* Effects notification - shows after choice */}
      {showEffects && lastEffects.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(15, 15, 20, 0.95)',
          border: '1px solid #4ecdc4',
          borderRadius: '8px',
          padding: '12px 20px',
          zIndex: 110,
          display: 'flex',
          gap: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.3s ease'
        }}>
          {lastEffects.map((effect, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: effect.type === 'positive' ? '#2ecc71' : 
                     effect.type === 'negative' ? '#e74c3c' : '#888',
              fontSize: '13px'
            }}>
              <span>{effect.icon}</span>
              <span>{effect.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '92%',
        maxWidth: '700px',
        maxHeight: '80vh',
        backgroundColor: '#0f0f14',
        borderRadius: '12px',
        border: '1px solid #2a2a35',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 18px',
          borderBottom: '1px solid #2a2a35',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ color: '#888', fontSize: '12px' }}>
            {scene.location || 'Сцена'}
          </div>
          <button
            onClick={() => setIsMinimized(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '0 4px'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px 24px'
        }}>
          {/* Main Text */}
          <div style={{
            color: '#e8e8e8',
            fontSize: '15px',
            lineHeight: 1.75,
            fontFamily: "'Georgia', serif"
          }}>
            {(scene.description || '').split('\n').map((p, i) => (
              p.trim() && <p key={i} style={{ margin: '0 0 16px 0' }}>{p}</p>
            ))}
          </div>

          {/* Dialogue */}
          {scene.dialogue && scene.dialogue.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              {scene.dialogue.map((line, i) => {
                const isHero = line.speaker.toLowerCase() === characterName.toLowerCase();
                return (
                  <div key={i} style={{
                    margin: '12px 0',
                    paddingLeft: isHero ? '0' : '12px',
                    borderLeft: isHero ? 'none' : '2px solid #3a3a45'
                  }}>
                    <span style={{ 
                      color: isHero ? '#4ecdc4' : '#9a8c98',
                      fontSize: '12px',
                      fontWeight: 500
                    }}>
                      {line.speaker}
                    </span>
                    <p style={{ 
                      color: '#d0d0d0', 
                      margin: '4px 0 0 0',
                      fontSize: '14px',
                      fontStyle: 'italic'
                    }}>
                      «{line.text}»
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Choices - NO effect hints */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #2a2a35',
          backgroundColor: '#0a0a0e'
        }}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '8px'
          }}>
            {(scene.choices || []).map((choice) => {
              const style = getToneStyle(choice.tone);
              const isSelected = selectedChoice === choice.id;
              
              return (
                <button
                  key={choice.id}
                  onClick={() => handleChoiceClick(choice)}
                  disabled={isLoading}
                  style={{
                    padding: '14px 16px',
                    backgroundColor: isSelected ? `${style.color}15` : '#16161c',
                    border: `1px solid ${isSelected ? style.color : '#2a2a35'}`,
                    borderRadius: '8px',
                    cursor: isLoading ? 'wait' : 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    opacity: isLoading && !isSelected ? 0.4 : 1
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px'
                  }}>
                    <span style={{ fontSize: '18px', opacity: 0.8 }}>
                      {style.icon}
                    </span>
                    <span style={{ color: '#e0e0e0', fontSize: '14px' }}>
                      {choice.text}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {isLoading && (
            <div style={{ 
              textAlign: 'center', 
              marginTop: '12px', 
              color: '#4ecdc4',
              fontSize: '13px'
            }}>
              ⏳ Генерация...
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
};

export default SceneView;
