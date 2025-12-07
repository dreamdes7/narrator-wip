import React, { useState } from 'react';
import type { AgentDebugStore, AgentCallLog, AgentRole, PlayerState, StoryState, DirectorDirective } from '../../types/agents';
import type { WorldLore, WorldScenario, PlayableCharacter } from '../../services/llmService';

interface GameDebugPanelProps {
  // Agent logs
  debugStore: AgentDebugStore;
  onClearLogs: () => void;
  
  // Game state
  playerState?: PlayerState;
  worldLore?: WorldLore | null;
  worldScenario?: WorldScenario | null;
  selectedCharacter?: PlayableCharacter | null;
  sceneNumber?: number;
  isGameStarted?: boolean;
  
  // Director state
  storyState?: StoryState | null;
  lastDirective?: DirectorDirective | null;
}

// Цвета для разных агентов
const AGENT_COLORS: Record<AgentRole, { bg: string; border: string; text: string }> = {
  GOLEM: { bg: 'rgba(155, 89, 182, 0.15)', border: '#9b59b6', text: '#d4a5e8' },
  CHARACTER_GENERATOR: { bg: 'rgba(78, 205, 196, 0.15)', border: '#4ecdc4', text: '#7eeee6' },
  NARRATOR: { bg: 'rgba(230, 184, 0, 0.15)', border: '#e6b800', text: '#ffe066' },
  DIRECTOR: { bg: 'rgba(52, 152, 219, 0.15)', border: '#3498db', text: '#85c1e9' },
  SHOWRUNNER: { bg: 'rgba(231, 76, 60, 0.15)', border: '#e74c3c', text: '#ff8a80' }
};

const AGENT_LABELS: Record<AgentRole, string> = {
  GOLEM: '🌍 Golem',
  CHARACTER_GENERATOR: '🎭 Characters',
  NARRATOR: '📜 Narrator',
  DIRECTOR: '🎯 Director',
  SHOWRUNNER: '🎬 Showrunner'
};

// Компактный лог агента
const CompactLogEntry: React.FC<{ log: AgentCallLog; onExpand: () => void }> = ({ log, onExpand }) => {
  const colors = AGENT_COLORS[log.agent];
  
  return (
    <div 
      onClick={onExpand}
      style={{
        padding: '8px 12px',
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        marginBottom: '6px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: colors.text, fontWeight: 500, fontSize: '12px' }}>
          {AGENT_LABELS[log.agent]}
        </span>
        <span style={{ 
          fontSize: '10px', 
          padding: '1px 6px', 
          borderRadius: '3px',
          backgroundColor: log.status === 'success' ? 'rgba(46, 204, 113, 0.3)' :
                         log.status === 'error' ? 'rgba(231, 76, 60, 0.3)' :
                         'rgba(241, 196, 15, 0.3)',
          color: log.status === 'success' ? '#2ecc71' :
                 log.status === 'error' ? '#e74c3c' : '#f1c40f'
        }}>
          {log.status}
        </span>
      </div>
      <span style={{ fontSize: '10px', color: '#666' }}>
        {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : '...'}
      </span>
    </div>
  );
};

// Детальный просмотр лога
const DetailedLogView: React.FC<{ log: AgentCallLog; onClose: () => void }> = ({ log, onClose }) => {
  const [tab, setTab] = useState<'context' | 'prompts' | 'response'>('context');
  const colors = AGENT_COLORS[log.agent];
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }} onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          width: '90%',
          maxWidth: '800px',
          maxHeight: '80vh',
          backgroundColor: '#1a1a24',
          borderRadius: '12px',
          border: `2px solid ${colors.border}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: colors.bg
        }}>
          <span style={{ color: colors.text, fontWeight: 600 }}>{AGENT_LABELS[log.agent]}</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px'
          }}>×</button>
        </div>
        
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
          {(['context', 'prompts', 'response'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1,
              padding: '8px',
              background: tab === t ? colors.bg : 'transparent',
              border: 'none',
              borderBottom: tab === t ? `2px solid ${colors.border}` : 'none',
              color: tab === t ? colors.text : '#666',
              cursor: 'pointer',
              fontSize: '12px',
              textTransform: 'uppercase'
            }}>
              {t === 'context' ? '📋 Context' : t === 'prompts' ? '💬 Prompts' : '✅ Response'}
            </button>
          ))}
        </div>
        
        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {tab === 'context' && (
            <pre style={{ margin: 0, fontSize: '11px', color: '#aaa', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(log.context, null, 2)}
            </pre>
          )}
          {tab === 'prompts' && (
            <>
              <h4 style={{ color: '#888', margin: '0 0 8px 0', fontSize: '11px' }}>SYSTEM:</h4>
              <pre style={{ margin: '0 0 16px 0', fontSize: '10px', color: '#888', whiteSpace: 'pre-wrap', backgroundColor: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px', maxHeight: '200px', overflow: 'auto' }}>
                {log.systemPrompt}
              </pre>
              <h4 style={{ color: '#888', margin: '0 0 8px 0', fontSize: '11px' }}>USER:</h4>
              <pre style={{ margin: 0, fontSize: '10px', color: '#aaa', whiteSpace: 'pre-wrap', backgroundColor: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px', maxHeight: '200px', overflow: 'auto' }}>
                {log.userPrompt}
              </pre>
            </>
          )}
          {tab === 'response' && (
            <pre style={{ margin: 0, fontSize: '11px', color: '#aaa', whiteSpace: 'pre-wrap' }}>
              {log.parsedResponse ? JSON.stringify(log.parsedResponse, null, 2) : log.rawResponse || 'No response'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

export const GameDebugPanel: React.FC<GameDebugPanelProps> = ({
  debugStore,
  onClearLogs,
  playerState,
  worldLore,
  worldScenario,
  selectedCharacter,
  sceneNumber = 0,
  isGameStarted = false,
  storyState,
  lastDirective
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'agents' | 'player' | 'scenario' | 'world'>('agents');
  const [expandedLog, setExpandedLog] = useState<AgentCallLog | null>(null);

  const hasActivity = debugStore.logs.length > 0 || debugStore.currentPhase !== 'IDLE';

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: 20,
          left: 20,
          padding: '10px 16px',
          backgroundColor: hasActivity ? 'rgba(78, 205, 196, 0.2)' : 'rgba(52, 73, 94, 0.9)',
          border: `1px solid ${hasActivity ? '#4ecdc4' : '#555'}`,
          borderRadius: '8px',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 9998
        }}
      >
        <span>🔧</span>
        <span>Debug</span>
        {debugStore.logs.length > 0 && (
          <span style={{
            backgroundColor: 'rgba(78, 205, 196, 0.3)',
            padding: '2px 6px',
            borderRadius: '8px',
            fontSize: '10px'
          }}>
            {debugStore.logs.length}
          </span>
        )}
        {debugStore.currentPhase !== 'IDLE' && (
          <span style={{ animation: 'pulse 1s infinite', color: '#f1c40f' }}>⏳</span>
        )}
      </button>

      {/* Main Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 70,
          left: 20,
          width: '400px',
          maxHeight: '70vh',
          backgroundColor: 'rgba(15, 15, 22, 0.98)',
          borderRadius: '12px',
          border: '1px solid #333',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999
        }}>
          {/* Section Tabs */}
          <div style={{ 
            display: 'flex', 
            borderBottom: '1px solid #333',
            backgroundColor: 'rgba(0,0,0,0.3)'
          }}>
            {(['agents', 'player', 'scenario', 'world'] as const).map(section => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  background: activeSection === section ? 'rgba(78, 205, 196, 0.1)' : 'transparent',
                  border: 'none',
                  borderBottom: activeSection === section ? '2px solid #4ecdc4' : '2px solid transparent',
                  color: activeSection === section ? '#4ecdc4' : '#666',
                  cursor: 'pointer',
                  fontSize: '11px',
                  textTransform: 'uppercase'
                }}
              >
                {section === 'agents' ? '🤖' : section === 'player' ? '👤' : section === 'scenario' ? '📜' : '🌍'}
                <br />{section}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
            
            {/* AGENTS SECTION */}
            {activeSection === 'agents' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#666' }}>
                    {debugStore.totalCalls} calls • {(debugStore.totalDurationMs / 1000).toFixed(1)}s
                  </span>
                  <button onClick={onClearLogs} style={{
                    padding: '4px 8px',
                    fontSize: '10px',
                    backgroundColor: 'rgba(231, 76, 60, 0.2)',
                    border: '1px solid #e74c3c',
                    borderRadius: '4px',
                    color: '#e74c3c',
                    cursor: 'pointer'
                  }}>Clear</button>
                </div>
                
                {debugStore.logs.length === 0 ? (
                  <div style={{ color: '#555', textAlign: 'center', padding: '20px', fontSize: '12px' }}>
                    No agent calls yet
                  </div>
                ) : (
                  debugStore.logs.map(log => (
                    <CompactLogEntry key={log.id} log={log} onExpand={() => setExpandedLog(log)} />
                  ))
                )}
              </>
            )}

            {/* PLAYER SECTION */}
            {activeSection === 'player' && (
              <>
                {playerState ? (
                  <>
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ color: '#4ecdc4', margin: '0 0 8px 0', fontSize: '12px' }}>📊 STATS</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ padding: '8px', backgroundColor: 'rgba(241, 196, 15, 0.1)', borderRadius: '6px' }}>
                          <div style={{ fontSize: '10px', color: '#888' }}>💰 Gold</div>
                          <div style={{ fontSize: '16px', color: '#f1c40f', fontWeight: 'bold' }}>{playerState.stats.gold}</div>
                        </div>
                        <div style={{ padding: '8px', backgroundColor: 'rgba(46, 204, 113, 0.1)', borderRadius: '6px' }}>
                          <div style={{ fontSize: '10px', color: '#888' }}>⭐ Reputation</div>
                          <div style={{ fontSize: '16px', color: playerState.stats.reputation >= 0 ? '#2ecc71' : '#e74c3c', fontWeight: 'bold' }}>
                            {playerState.stats.reputation > 0 ? '+' : ''}{playerState.stats.reputation}
                          </div>
                        </div>
                        <div style={{ padding: '8px', backgroundColor: 'rgba(155, 89, 182, 0.1)', borderRadius: '6px' }}>
                          <div style={{ fontSize: '10px', color: '#888' }}>👑 Influence</div>
                          <div style={{ fontSize: '16px', color: '#9b59b6', fontWeight: 'bold' }}>{playerState.stats.influence}</div>
                        </div>
                        <div style={{ padding: '8px', backgroundColor: 'rgba(231, 76, 60, 0.1)', borderRadius: '6px' }}>
                          <div style={{ fontSize: '10px', color: '#888' }}>❤️ Health</div>
                          <div style={{ fontSize: '16px', color: '#e74c3c', fontWeight: 'bold' }}>{playerState.stats.health}</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ color: '#4ecdc4', margin: '0 0 8px 0', fontSize: '12px' }}>📦 INVENTORY ({playerState.inventory.length})</h4>
                      {playerState.inventory.length === 0 ? (
                        <div style={{ color: '#555', fontSize: '11px' }}>Empty</div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {playerState.inventory.map((item, i) => (
                            <span key={i} style={{
                              padding: '3px 8px',
                              backgroundColor: 'rgba(255,255,255,0.05)',
                              borderRadius: '4px',
                              fontSize: '10px',
                              color: '#aaa'
                            }}>{item.name}{item.quantity > 1 && ` ×${item.quantity}`}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 style={{ color: '#4ecdc4', margin: '0 0 8px 0', fontSize: '12px' }}>🤝 RELATIONSHIPS ({playerState.relationships.length})</h4>
                      {playerState.relationships.length === 0 ? (
                        <div style={{ color: '#555', fontSize: '11px' }}>None</div>
                      ) : (
                        playerState.relationships.map((rel, i) => (
                          <div key={i} style={{ 
                            padding: '6px 8px', 
                            backgroundColor: 'rgba(255,255,255,0.03)', 
                            borderRadius: '4px',
                            marginBottom: '4px',
                            fontSize: '11px'
                          }}>
                            <span style={{ color: '#ccc' }}>{rel.npcName}</span>
                            <span style={{ 
                              marginLeft: '8px',
                              color: rel.relation > 0 ? '#2ecc71' : '#e74c3c'
                            }}>
                              {rel.relation > 0 ? '+' : ''}{rel.relation}
                            </span>
                            <span style={{ marginLeft: '8px', color: '#666' }}>({rel.status})</span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#555', textAlign: 'center', padding: '20px', fontSize: '12px' }}>
                    Player state not initialized
                  </div>
                )}
              </>
            )}

            {/* SCENARIO SECTION */}
            {activeSection === 'scenario' && (
              <>
                {worldScenario ? (
                  <>
                    {/* Title */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '14px', color: '#ffe066', fontWeight: 500 }}>{worldScenario.title}</div>
                    </div>

                    {/* Visual Story Timeline */}
                    <div style={{ 
                      marginBottom: '16px', 
                      padding: '12px', 
                      backgroundColor: 'rgba(52, 152, 219, 0.08)', 
                      borderRadius: '8px',
                      border: '1px solid rgba(52, 152, 219, 0.2)'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: '8px'
                      }}>
                        <span style={{ fontSize: '10px', color: '#3498db', fontWeight: 500 }}>
                          🎯 STORY PROGRESS
                        </span>
                        {storyState && (
                          <span style={{ fontSize: '10px', color: '#7d8590' }}>
                            Act {storyState.currentAct} • {storyState.actProgress}%
                          </span>
                        )}
                      </div>

                      {/* Timeline Bar */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        marginBottom: '10px'
                      }}>
                        {[1, 2, 3].map(actNum => {
                          const isCurrentAct = storyState?.currentAct === actNum;
                          const isPastAct = storyState ? storyState.currentAct > actNum : false;
                          const progress = isCurrentAct ? (storyState?.actProgress || 0) : isPastAct ? 100 : 0;
                          
                          return (
                            <div key={actNum} style={{ flex: 1 }}>
                              {/* Act label */}
                              <div style={{ 
                                fontSize: '9px', 
                                color: isCurrentAct ? '#3498db' : isPastAct ? '#2ecc71' : '#555',
                                marginBottom: '3px',
                                fontWeight: isCurrentAct ? 600 : 400
                              }}>
                                ACT {actNum}
                              </div>
                              {/* Progress bar */}
                              <div style={{
                                height: '6px',
                                backgroundColor: '#21262d',
                                borderRadius: '3px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${progress}%`,
                                  height: '100%',
                                  backgroundColor: isPastAct ? '#2ecc71' : isCurrentAct ? '#3498db' : 'transparent',
                                  borderRadius: '3px',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Milestones */}
                      {storyState?.milestones && storyState.milestones.length > 0 && (
                        <div style={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: '4px',
                          marginTop: '8px'
                        }}>
                          {storyState.milestones.map((m, i) => (
                            <span key={i} style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              backgroundColor: m.reached ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255,255,255,0.05)',
                              color: m.reached ? '#2ecc71' : '#555',
                              border: `1px solid ${m.reached ? 'rgba(46, 204, 113, 0.3)' : '#30363d'}`
                            }}>
                              {m.reached ? '✓' : '○'} {m.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Current Focus from Director */}
                      {storyState?.currentFocus && (
                        <div style={{ 
                          marginTop: '10px',
                          padding: '8px',
                          backgroundColor: 'rgba(0,0,0,0.2)',
                          borderRadius: '4px'
                        }}>
                          <div style={{ fontSize: '9px', color: '#666', marginBottom: '2px' }}>CURRENT FOCUS</div>
                          <div style={{ fontSize: '11px', color: '#85c1e9' }}>{storyState.currentFocus}</div>
                        </div>
                      )}
                    </div>

                    {/* Director's Last Directive */}
                    {lastDirective && (
                      <div style={{ 
                        marginBottom: '12px',
                        padding: '10px',
                        backgroundColor: 'rgba(52, 152, 219, 0.05)',
                        borderRadius: '6px',
                        borderLeft: '3px solid #3498db'
                      }}>
                        <div style={{ fontSize: '10px', color: '#3498db', marginBottom: '6px', fontWeight: 500 }}>
                          🎯 DIRECTOR'S DIRECTIVE
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          <span style={{
                            fontSize: '9px',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            backgroundColor: 
                              lastDirective.pacing === 'climax' ? 'rgba(231, 76, 60, 0.2)' :
                              lastDirective.pacing === 'build_tension' ? 'rgba(230, 126, 34, 0.2)' :
                              lastDirective.pacing === 'resolution' ? 'rgba(46, 204, 113, 0.2)' :
                              'rgba(255,255,255,0.1)',
                            color: 
                              lastDirective.pacing === 'climax' ? '#e74c3c' :
                              lastDirective.pacing === 'build_tension' ? '#e67e22' :
                              lastDirective.pacing === 'resolution' ? '#2ecc71' :
                              '#888'
                          }}>
                            ⏱ {lastDirective.pacing}
                          </span>
                          <span style={{
                            fontSize: '9px',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            backgroundColor: 'rgba(155, 89, 182, 0.15)',
                            color: '#9b59b6'
                          }}>
                            📍 {lastDirective.currentBeat}
                          </span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#aaa' }}>
                          {lastDirective.focus}
                        </div>
                        {lastDirective.shouldEnd && (
                          <div style={{ 
                            marginTop: '6px',
                            fontSize: '10px',
                            color: '#e74c3c',
                            fontWeight: 500
                          }}>
                            ⚠️ FINALE: {lastDirective.endType}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Story Summary */}
                    {storyState?.storySummary && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>STORY SO FAR</div>
                        <div style={{ fontSize: '11px', color: '#888', lineHeight: 1.4 }}>{storyState.storySummary}</div>
                      </div>
                    )}

                    {/* Scene counter */}
                    <div style={{ 
                      fontSize: '10px', 
                      color: '#555', 
                      textAlign: 'center',
                      padding: '8px',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      borderRadius: '4px'
                    }}>
                      Scene {sceneNumber} • {isGameStarted ? '🎮 IN PROGRESS' : '⏸️ NOT STARTED'}
                      {storyState?.isClimax && ' • 🔥 CLIMAX'}
                      {storyState?.isEpilogue && ' • 📖 EPILOGUE'}
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#555', textAlign: 'center', padding: '20px', fontSize: '12px' }}>
                    No scenario generated
                  </div>
                )}
              </>
            )}

            {/* WORLD SECTION */}
            {activeSection === 'world' && (
              <>
                {worldLore ? (
                  <>
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>WORLD NAME</div>
                      <div style={{ fontSize: '16px', color: '#d4a5e8', fontWeight: 500 }}>{worldLore.worldName}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{worldLore.era}</div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>KINGDOMS ({worldLore.kingdoms.length})</div>
                      {worldLore.kingdoms.map((k, i) => (
                        <div key={i} style={{ 
                          padding: '8px', 
                          backgroundColor: 'rgba(155, 89, 182, 0.1)', 
                          borderRadius: '6px',
                          marginBottom: '6px'
                        }}>
                          <div style={{ fontSize: '12px', color: '#d4a5e8', fontWeight: 500 }}>{k.name}</div>
                          <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                            {k.initialState?.rulerName} • {k.initialState?.rulerPersonality}
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedCharacter && (
                      <div style={{ padding: '10px', backgroundColor: 'rgba(78, 205, 196, 0.1)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>SELECTED CHARACTER</div>
                        <div style={{ fontSize: '13px', color: '#4ecdc4', fontWeight: 500 }}>{selectedCharacter.name}</div>
                        <div style={{ fontSize: '11px', color: '#888' }}>{selectedCharacter.title}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: '#555', textAlign: 'center', padding: '20px', fontSize: '12px' }}>
                    No world lore generated
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Detailed Log Modal */}
      {expandedLog && (
        <DetailedLogView log={expandedLog} onClose={() => setExpandedLog(null)} />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  );
};

export default GameDebugPanel;

