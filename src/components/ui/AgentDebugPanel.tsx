import React, { useState } from 'react';
import type { AgentDebugStore, AgentCallLog, AgentRole } from '../../types/agents';

interface AgentDebugPanelProps {
  debugStore: AgentDebugStore;
  onClear: () => void;
}

// Цвета для разных агентов
const AGENT_COLORS: Record<AgentRole, { bg: string; border: string; text: string }> = {
  GOLEM: { bg: 'rgba(155, 89, 182, 0.15)', border: '#9b59b6', text: '#d4a5e8' },
  CHARACTER_GENERATOR: { bg: 'rgba(78, 205, 196, 0.15)', border: '#4ecdc4', text: '#7eeee6' },
  NARRATOR: { bg: 'rgba(230, 184, 0, 0.15)', border: '#e6b800', text: '#ffe066' },
  SHOWRUNNER: { bg: 'rgba(231, 76, 60, 0.15)', border: '#e74c3c', text: '#ff8a80' }
};

const AGENT_LABELS: Record<AgentRole, string> = {
  GOLEM: '🌍 Golem (World Generator)',
  CHARACTER_GENERATOR: '🎭 Character Generator',
  NARRATOR: '📜 Narrator',
  SHOWRUNNER: '🎬 Showrunner (Scene Writer)'
};

// Компонент для одного лога
const LogEntry: React.FC<{ log: AgentCallLog; isExpanded: boolean; onToggle: () => void }> = ({ 
  log, 
  isExpanded, 
  onToggle 
}) => {
  const [activeTab, setActiveTab] = useState<'system' | 'user' | 'context' | 'response'>('context');
  const colors = AGENT_COLORS[log.agent];
  
  return (
    <div style={{
      backgroundColor: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      marginBottom: '12px',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div 
        onClick={onToggle}
        style={{
          padding: '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: isExpanded ? `1px solid ${colors.border}` : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: colors.text, fontWeight: 600 }}>
            {AGENT_LABELS[log.agent]}
          </span>
          <span style={{ 
            fontSize: '11px', 
            padding: '2px 8px', 
            borderRadius: '4px',
            backgroundColor: log.status === 'success' ? 'rgba(46, 204, 113, 0.3)' :
                           log.status === 'error' ? 'rgba(231, 76, 60, 0.3)' :
                           'rgba(241, 196, 15, 0.3)',
            color: log.status === 'success' ? '#2ecc71' :
                   log.status === 'error' ? '#e74c3c' : '#f1c40f'
          }}>
            {log.status.toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: '#888' }}>
          <span>Model: {log.model}</span>
          {log.durationMs && <span>{(log.durationMs / 1000).toFixed(1)}s</span>}
          {log.tokenEstimate && <span>~{log.tokenEstimate} tokens</span>}
          <span style={{ color: '#666' }}>{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{ padding: '0' }}>
          {/* Tabs */}
          <div style={{ 
            display: 'flex', 
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: 'rgba(0,0,0,0.2)'
          }}>
            {(['context', 'system', 'user', 'response'] as const).map(tab => (
              <button
                key={tab}
                onClick={(e) => { e.stopPropagation(); setActiveTab(tab); }}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: activeTab === tab ? colors.bg : 'transparent',
                  color: activeTab === tab ? colors.text : '#888',
                  cursor: 'pointer',
                  fontSize: '12px',
                  borderBottom: activeTab === tab ? `2px solid ${colors.border}` : '2px solid transparent',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {tab === 'context' ? '📋 Context' :
                 tab === 'system' ? '⚙️ System' :
                 tab === 'user' ? '👤 User' : '💬 Response'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ 
            padding: '12px 16px', 
            maxHeight: '400px', 
            overflow: 'auto',
            backgroundColor: 'rgba(0,0,0,0.1)'
          }}>
            {activeTab === 'context' && (
              <div>
                <h4 style={{ color: colors.text, margin: '0 0 8px 0', fontSize: '12px' }}>
                  Структурированный контекст (что передано агенту):
                </h4>
                <pre style={{ 
                  margin: 0, 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  fontSize: '11px',
                  color: '#c0c0c0',
                  lineHeight: 1.4
                }}>
                  {JSON.stringify(log.context, null, 2)}
                </pre>
              </div>
            )}

            {activeTab === 'system' && (
              <div>
                <h4 style={{ color: colors.text, margin: '0 0 8px 0', fontSize: '12px' }}>
                  System Prompt:
                </h4>
                <pre style={{ 
                  margin: 0, 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  fontSize: '11px',
                  color: '#c0c0c0',
                  lineHeight: 1.5
                }}>
                  {log.systemPrompt}
                </pre>
              </div>
            )}

            {activeTab === 'user' && (
              <div>
                <h4 style={{ color: colors.text, margin: '0 0 8px 0', fontSize: '12px' }}>
                  User Prompt:
                </h4>
                <pre style={{ 
                  margin: 0, 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  fontSize: '11px',
                  color: '#c0c0c0',
                  lineHeight: 1.5
                }}>
                  {log.userPrompt}
                </pre>
              </div>
            )}

            {activeTab === 'response' && (
              <div>
                {log.error ? (
                  <div style={{ color: '#e74c3c' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px' }}>❌ Error:</h4>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '11px' }}>
                      {log.error}
                    </pre>
                  </div>
                ) : (
                  <>
                    <h4 style={{ color: colors.text, margin: '0 0 8px 0', fontSize: '12px' }}>
                      Raw Response:
                    </h4>
                    <pre style={{ 
                      margin: '0 0 16px 0', 
                      whiteSpace: 'pre-wrap', 
                      wordBreak: 'break-word',
                      fontSize: '10px',
                      color: '#999',
                      maxHeight: '150px',
                      overflow: 'auto',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      padding: '8px',
                      borderRadius: '4px'
                    }}>
                      {log.rawResponse || 'No response'}
                    </pre>
                    
                    {log.parsedResponse && (
                      <>
                        <h4 style={{ color: colors.text, margin: '0 0 8px 0', fontSize: '12px' }}>
                          Parsed JSON:
                        </h4>
                        <pre style={{ 
                          margin: 0, 
                          whiteSpace: 'pre-wrap', 
                          wordBreak: 'break-word',
                          fontSize: '11px',
                          color: '#c0c0c0',
                          lineHeight: 1.4
                        }}>
                          {JSON.stringify(log.parsedResponse, null, 2)}
                        </pre>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Основной компонент панели
export const AgentDebugPanel: React.FC<AgentDebugPanelProps> = ({ debugStore, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const toggleLog = (logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedLogs(new Set(debugStore.logs.map(l => l.id)));
  };

  const collapseAll = () => {
    setExpandedLogs(new Set());
  };

  if (debugStore.logs.length === 0 && debugStore.currentPhase === 'IDLE') {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: 20,
      zIndex: 9998,
      fontFamily: "'Segoe UI', 'Roboto', sans-serif"
    }}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '10px 16px',
          backgroundColor: debugStore.currentPhase !== 'IDLE' 
            ? 'rgba(241, 196, 15, 0.3)' 
            : 'rgba(52, 73, 94, 0.9)',
          border: debugStore.currentPhase !== 'IDLE'
            ? '1px solid #f1c40f'
            : '1px solid #7f8c8d',
          borderRadius: '8px',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
      >
        <span style={{ fontSize: '16px' }}>🔧</span>
        <span>Agent Debug</span>
        {debugStore.logs.length > 0 && (
          <span style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            padding: '2px 8px',
            borderRadius: '10px',
            fontSize: '11px'
          }}>
            {debugStore.logs.length}
          </span>
        )}
        {debugStore.currentPhase !== 'IDLE' && (
          <span style={{ 
            animation: 'pulse 1s infinite',
            color: '#f1c40f'
          }}>
            ⏳
          </span>
        )}
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '50px',
          left: 0,
          width: '700px',
          maxHeight: '80vh',
          backgroundColor: 'rgba(20, 20, 30, 0.98)',
          borderRadius: '12px',
          border: '1px solid #4a4e69',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #4a4e69',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.2)'
          }}>
            <div>
              <h3 style={{ margin: 0, color: '#f2e9e4', fontSize: '16px' }}>
                🔧 Agent Interactions Debug
              </h3>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                {debugStore.totalCalls} calls | {(debugStore.totalDurationMs / 1000).toFixed(1)}s total
                {debugStore.currentPhase !== 'IDLE' && (
                  <span style={{ color: '#f1c40f', marginLeft: '8px' }}>
                    Current: {debugStore.currentPhase}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={expandAll}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#aaa',
                  cursor: 'pointer'
                }}
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#aaa',
                  cursor: 'pointer'
                }}
              >
                Collapse All
              </button>
              <button
                onClick={onClear}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: 'rgba(231, 76, 60, 0.2)',
                  border: '1px solid #e74c3c',
                  borderRadius: '4px',
                  color: '#e74c3c',
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Logs */}
          <div style={{ 
            padding: '16px', 
            overflow: 'auto', 
            flex: 1,
            maxHeight: 'calc(80vh - 80px)'
          }}>
            {debugStore.logs.length === 0 ? (
              <div style={{ 
                color: '#666', 
                textAlign: 'center', 
                padding: '40px',
                fontSize: '14px'
              }}>
                No agent calls yet. Generate lore to see interactions.
              </div>
            ) : (
              debugStore.logs.map(log => (
                <LogEntry
                  key={log.id}
                  log={log}
                  isExpanded={expandedLogs.has(log.id)}
                  onToggle={() => toggleLog(log.id)}
                />
              ))
            )}
          </div>

          {/* Schema Reference */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid #4a4e69',
            backgroundColor: 'rgba(0,0,0,0.2)',
            fontSize: '10px',
            color: '#666'
          }}>
            <strong>Agent Pipeline:</strong> GOLEM (World) → CHARACTER_GENERATOR (Heroes) → NARRATOR (Scenario) → SHOWRUNNER (Scenes)
          </div>
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

export default AgentDebugPanel;

