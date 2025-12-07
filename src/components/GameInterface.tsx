import React, { useState, useEffect } from 'react';
import WorldMap from './WorldMap';
import CityMap from './CityMap';
import LocationCard from './ui/LocationCard';
import StoryLog, { type LogEntry } from './ui/StoryLog';
import StatusBar from './ui/StatusBar';
import GameDebugPanel from './ui/GameDebugPanel';
import SceneView from './ui/SceneView';
import PlayerStatsBar from './ui/PlayerStatsBar';
import './ui/GameUI.css';
import type { POI, Kingdom, WorldData, CellData, Point2D } from '../types/world';
import { generateWorld, computeKingdomPath } from '../utils/worldGenerator';
import { DEFAULT_WORLD_CONFIG } from '../types/world';
import { useWorldSimulation } from '../hooks/useWorldSimulation';
import { useWorldLore } from '../hooks/useWorldLore';
import { initializeImageAssignments, updateCityImageFromLore, getAssignmentCounts } from '../utils/locationImages';
import { getAvatarById } from '../utils/characterAssets';
import type { WorldLore, WorldScenario, PlayableCharacter } from '../services/llmService';
import type { SceneChoice } from '../types/agents';
import type { TravelRoute } from '../types/travel';
import TravelView from './ui/TravelView';
import { 
  getKingdomRoutes, 
  getPOIById, 
  createPathLines
} from '../utils/travelSystem';
import type { TravelPath } from './WorldMap';

const DebugPanel: React.FC<{ data: any; title: string }> = ({ data, title }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!data) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      backgroundColor: 'rgba(20, 20, 30, 0.9)',
      backdropFilter: 'blur(5px)',
      color: '#c9ada7',
      fontFamily: "'Courier New', Courier, monospace",
      padding: '12px',
      borderRadius: '8px',
      maxHeight: '80vh',
      maxWidth: '320px',
      overflow: 'auto',
      zIndex: 9999,
      fontSize: '11px',
      border: '1px solid #4a4e69',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)'
    }}>
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        style={{ 
            cursor: 'pointer', 
            fontWeight: 'bold', 
            userSelect: 'none', 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#f2e9e4',
            borderBottom: isOpen ? '1px solid #4a4e69' : 'none',
            paddingBottom: isOpen ? '8px' : '0',
            marginBottom: isOpen ? '8px' : '0'
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: '10px', color: '#9a8c98' }}>{isOpen ? '▼' : '▶'}</span>
      </div>
      {isOpen && (
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '1.4' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
};

// Lore Panel Component
const LorePanel: React.FC<{ 
  lore: WorldLore | null; 
  isOpen: boolean;
  onClose: () => void;
}> = ({ lore, isOpen, onClose }) => {
  if (!isOpen || !lore) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif"
    }}>
      <div style={{
        backgroundColor: '#1e1e2e',
        borderRadius: '12px',
        maxWidth: '850px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        padding: '28px',
        border: '2px solid #c9ada7',
        boxShadow: '0 0 60px rgba(201, 173, 167, 0.25)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ margin: 0, color: '#c9ada7', fontSize: '28px', fontWeight: 600 }}>{lore.worldName}</h1>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid #666',
              color: '#ccc',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Закрыть
          </button>
        </div>

        <p style={{ color: '#b0b0b0', fontStyle: 'italic', marginBottom: '20px', lineHeight: 1.7, fontSize: '15px' }}>
          {lore.worldDescription}
        </p>

        <div style={{ 
          backgroundColor: 'rgba(201, 173, 167, 0.1)', 
          padding: '12px', 
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <strong style={{ color: '#c9ada7' }}>Current Era:</strong>{' '}
          <span style={{ color: '#f0e6e3' }}>{lore.era}</span>
        </div>

        <h2 style={{ color: '#c9ada7', fontSize: '18px', marginBottom: '12px', fontWeight: 600 }}>
          Исторические события
        </h2>
        <ul style={{ color: '#d0d0d0', marginBottom: '24px', paddingLeft: '24px', fontSize: '14px' }}>
          {lore.majorEvents.map((event, i) => (
            <li key={i} style={{ marginBottom: '10px', lineHeight: 1.6 }}>{event}</li>
          ))}
        </ul>

        <h2 style={{ color: '#c9ada7', fontSize: '18px', marginBottom: '16px', fontWeight: 600 }}>
          Королевства
        </h2>
        <div style={{ display: 'grid', gap: '20px' }}>
          {lore.kingdoms.map(k => (
            <div key={k.id} style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              padding: '16px',
              borderRadius: '8px',
              borderLeft: '3px solid #c9ada7'
            }}>
              {/* Header with name, motto and stats */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: '0', color: '#f0e6e3', fontSize: '18px' }}>{k.name}</h3>
                  {k.motto && (
                    <div style={{ fontSize: '12px', color: '#c9ada7', fontStyle: 'italic', marginTop: '4px' }}>
                      "{k.motto}"
                    </div>
                  )}
                </div>
                {k.initialState && (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(2, 1fr)', 
                    gap: '6px',
                    fontSize: '11px',
                    textAlign: 'right'
                  }}>
                    <div style={{ color: '#e74c3c' }}>⚔ {k.initialState.militaryStrength}</div>
                    <div style={{ color: '#f1c40f' }}>💰 {k.initialState.gold}</div>
                    <div style={{ color: '#9b59b6' }}>✨ {k.initialState.mana}</div>
                    <div style={{ color: '#2ecc71' }}>🍞 {k.initialState.food}</div>
                  </div>
                )}
              </div>

              {/* Ruler info */}
              {k.initialState && (
                <div style={{ 
                  fontSize: '13px', 
                  color: '#aaa', 
                  marginBottom: '10px',
                  padding: '8px 10px',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: '4px'
                }}>
                  <span style={{ color: '#888' }}>{k.initialState.rulerTitle || 'Ruler'}:</span>{' '}
                  <strong style={{ color: '#f0e6e3' }}>{k.initialState.rulerName}</strong>
                  <span style={{ 
                    marginLeft: '8px',
                    padding: '2px 8px',
                    backgroundColor: k.initialState.rulerPersonality === 'Aggressive' ? 'rgba(231, 76, 60, 0.3)' :
                      k.initialState.rulerPersonality === 'Defensive' ? 'rgba(52, 152, 219, 0.3)' :
                      k.initialState.rulerPersonality === 'Diplomatic' ? 'rgba(46, 204, 113, 0.3)' :
                      k.initialState.rulerPersonality === 'Expansionist' ? 'rgba(155, 89, 182, 0.3)' :
                      'rgba(149, 165, 166, 0.3)',
                    borderRadius: '4px',
                    fontSize: '10px'
                  }}>
                    {k.initialState.rulerPersonality}
                  </span>
                </div>
              )}

              {/* Culture & History */}
              <p style={{ color: '#c5c5c5', fontSize: '14px', margin: '0 0 8px 0', lineHeight: 1.6 }}>
                {k.culture}
              </p>
              <p style={{ color: '#aaa', fontSize: '14px', margin: '0 0 10px 0', lineHeight: 1.6 }}>
                {k.history}
              </p>
              
              {/* Religion */}
              {k.religion && (
                <div style={{ fontSize: '13px', color: '#b794f6', marginBottom: '10px' }}>
                  ✦ {k.religion}
                </div>
              )}

              {/* Traits */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {k.traits.map((trait, i) => (
                  <span key={i} style={{
                    backgroundColor: 'rgba(201, 173, 167, 0.2)',
                    color: '#c9ada7',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}>
                    {trait}
                  </span>
                ))}
              </div>

              {/* Capital */}
              {k.capital && (
                <div style={{ 
                  marginTop: '12px', 
                  padding: '10px',
                  backgroundColor: 'rgba(201, 173, 167, 0.1)',
                  borderRadius: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ color: '#f1c40f' }}>👑</span>
                    <strong style={{ color: '#f0e6e3', fontSize: '14px' }}>{k.capital.name}</strong>
                    {k.capital.mood && (
                      <span style={{ 
                        fontSize: '10px', 
                        color: '#888',
                        padding: '2px 6px',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        borderRadius: '8px',
                        textTransform: 'uppercase'
                      }}>
                        {k.capital.mood}
                      </span>
                    )}
                  </div>
                  {k.capital.description && (
                    <p style={{ color: '#bbb', fontSize: '13px', margin: '0 0 6px 0', lineHeight: 1.5 }}>{k.capital.description}</p>
                  )}
                  {k.capital.specialty && (
                    <div style={{ color: '#c9ada7', fontSize: '12px' }}>Известна: {k.capital.specialty}</div>
                  )}
                  {k.capital.landmark && (
                    <div style={{ color: '#999', fontSize: '12px', fontStyle: 'italic', marginTop: '4px' }}>"{k.capital.landmark}"</div>
                  )}
                </div>
              )}

              {/* Cities */}
              {k.cities && k.cities.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Города</div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {k.cities.map((city, idx) => (
                      <div key={idx} style={{ 
                        padding: '8px',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        borderRadius: '4px',
                        borderLeft: '2px solid rgba(201, 173, 167, 0.3)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ color: '#ddd', fontSize: '13px' }}>{city.name}</strong>
                          {city.mood && (
                            <span style={{ 
                              fontSize: '9px', 
                              color: '#777',
                              padding: '1px 5px',
                              backgroundColor: 'rgba(0,0,0,0.2)',
                              borderRadius: '6px'
                            }}>
                              {city.mood}
                            </span>
                          )}
                        </div>
                        {city.description && (
                          <p style={{ color: '#aaa', fontSize: '12px', margin: '4px 0 0 0', lineHeight: 1.5 }}>{city.description}</p>
                        )}
                        {city.specialty && (
                          <div style={{ color: '#999', fontSize: '11px', marginTop: '4px' }}>{city.specialty}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Relations */}
              <p style={{ color: '#aaa', fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>
                <strong style={{ color: '#c9ada7' }}>Отношения:</strong> {k.relations}
              </p>
            </div>
          ))}
        </div>

        <h2 style={{ color: '#c9ada7', fontSize: '18px', margin: '24px 0 12px 0', fontWeight: 600 }}>
          Легенды мира
        </h2>
        <div style={{ color: '#b0b0b0', fontStyle: 'italic' }}>
          {lore.legends.map((legend, i) => (
            <p key={i} style={{ marginBottom: '12px', lineHeight: 1.6, paddingLeft: '16px', borderLeft: '2px solid #555' }}>
              "{legend}"
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};

// Scenario Panel Component (Narrator Agent Output)
const ScenarioPanel: React.FC<{ 
  scenario: WorldScenario | null; 
  isOpen: boolean;
  onClose: () => void;
}> = ({ scenario, isOpen, onClose }) => {
  if (!isOpen || !scenario) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      zIndex: 1001,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif"
    }}>
      <div style={{
        backgroundColor: '#1a1a2e',
        borderRadius: '12px',
        maxWidth: '1000px',
        width: '100%',
        maxHeight: '94vh',
        overflow: 'auto',
        padding: '28px',
        border: '2px solid #e6b800',
        boxShadow: '0 0 60px rgba(230, 184, 0, 0.3)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#e6b800', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '2px' }}>
              📜 Narrator Agent
            </div>
            <h1 style={{ margin: 0, color: '#e6b800', fontSize: '24px', fontWeight: 600 }}>{scenario.title}</h1>
            {scenario.logline && (
              <p style={{ color: '#888', fontSize: '13px', margin: '6px 0 0 0', fontStyle: 'italic' }}>{scenario.logline}</p>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid #666', color: '#ccc', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            Закрыть
          </button>
        </div>

        {/* Tone & Themes */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {scenario.tone && (
            <span style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: 'rgba(230, 184, 0, 0.2)', borderRadius: '12px', color: '#e6b800' }}>
              🎭 {scenario.tone}
            </span>
          )}
          {scenario.themes?.map((theme, i) => (
            <span key={i} style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: 'rgba(155, 89, 182, 0.2)', borderRadius: '12px', color: '#d4a5e8' }}>
              {theme}
            </span>
          ))}
        </div>

        {/* ═══ ДРАМАТУРГИЯ ГЕРОЯ (создана Narrator'ом) ═══ */}
        {scenario.heroDramaturgy && (
          <div style={{ 
            backgroundColor: 'rgba(231, 76, 60, 0.08)', 
            padding: '16px', 
            borderRadius: '10px', 
            marginBottom: '20px',
            border: '1px solid rgba(231, 76, 60, 0.3)'
          }}>
            <h3 style={{ color: '#ff6b6b', fontSize: '14px', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔥 Драматургия героя
              <span style={{ fontSize: '10px', color: '#888', fontWeight: 'normal' }}>(создано Narrator)</span>
            </h3>
            
            <div style={{ display: 'grid', gap: '10px' }}>
              {/* Inciting Incident */}
              <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                <span style={{ color: '#ff6b6b', fontSize: '11px' }}>⚡ Инцидент:</span>
                <p style={{ color: '#c0c0c0', fontSize: '13px', margin: '4px 0 0 0', lineHeight: 1.5 }}>{scenario.heroDramaturgy.incitingIncident}</p>
              </div>
              
              {/* Moral Dilemma */}
              <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                <span style={{ color: '#9b59b6', fontSize: '11px' }}>⚖️ Дилемма:</span>
                <p style={{ color: '#c0c0c0', fontSize: '13px', margin: '4px 0 0 0' }}>{scenario.heroDramaturgy.moralDilemma}</p>
              </div>
              
              {/* Secret/Flaw & Stakes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                  <span style={{ color: '#e74c3c', fontSize: '11px' }}>🔒 Слабость:</span>
                  <p style={{ color: '#aaa', fontSize: '12px', margin: '4px 0 0 0' }}>{scenario.heroDramaturgy.secretOrFlaw}</p>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                  <span style={{ color: '#e6b800', fontSize: '11px' }}>💎 На кону:</span>
                  <p style={{ color: '#aaa', fontSize: '12px', margin: '4px 0 0 0' }}>{scenario.heroDramaturgy.stakes}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ СВЯЗИ ГЕРОЯ ═══ */}
        {scenario.connections && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '10px', 
            marginBottom: '20px' 
          }}>
            <div style={{ backgroundColor: 'rgba(78, 205, 196, 0.1)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #4ecdc4' }}>
              <span style={{ color: '#4ecdc4', fontSize: '10px' }}>👤 СОЮЗНИК</span>
              <div style={{ color: '#fff', fontSize: '13px', marginTop: '4px' }}>{scenario.connections.ally?.name}</div>
              <div style={{ color: '#888', fontSize: '11px' }}>{scenario.connections.ally?.who}</div>
            </div>
            <div style={{ backgroundColor: 'rgba(231, 76, 60, 0.1)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #e74c3c' }}>
              <span style={{ color: '#e74c3c', fontSize: '10px' }}>⚔️ СОПЕРНИК</span>
              <div style={{ color: '#fff', fontSize: '13px', marginTop: '4px' }}>{scenario.connections.rival?.name}</div>
              <div style={{ color: '#888', fontSize: '11px' }}>{scenario.connections.rival?.conflict}</div>
            </div>
            <div style={{ backgroundColor: 'rgba(243, 156, 18, 0.1)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #f39c12' }}>
              <span style={{ color: '#f39c12', fontSize: '10px' }}>📚 НАСТАВНИК</span>
              <div style={{ color: '#fff', fontSize: '13px', marginTop: '4px' }}>{scenario.connections.mentor?.name}</div>
              <div style={{ color: '#888', fontSize: '11px' }}>{scenario.connections.mentor?.lesson}</div>
            </div>
            {scenario.connections.loveInterest && (
              <div style={{ backgroundColor: 'rgba(155, 89, 182, 0.1)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #9b59b6' }}>
                <span style={{ color: '#9b59b6', fontSize: '10px' }}>💜 ИНТЕРЕС</span>
                <div style={{ color: '#fff', fontSize: '13px', marginTop: '4px' }}>{scenario.connections.loveInterest?.name}</div>
                <div style={{ color: '#888', fontSize: '11px' }}>{scenario.connections.loveInterest?.complication}</div>
              </div>
            )}
          </div>
        )}

        {/* Premise */}
        <div style={{ backgroundColor: 'rgba(230, 184, 0, 0.08)', padding: '14px', borderRadius: '8px', marginBottom: '16px', borderLeft: '3px solid #e6b800' }}>
          <h3 style={{ color: '#e6b800', fontSize: '12px', margin: '0 0 8px 0' }}>📖 ЗАВЯЗКА</h3>
          <p style={{ color: '#c0c0c0', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>{scenario.premise}</p>
        </div>

        {scenario.moralQuestion && (
          <div style={{ backgroundColor: 'rgba(155, 89, 182, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
            <span style={{ color: '#9b59b6', fontSize: '12px' }}>❓ Моральный вопрос:</span>
            <p style={{ color: '#c0c0c0', fontSize: '14px', margin: '6px 0 0 0', fontStyle: 'italic' }}>{scenario.moralQuestion}</p>
          </div>
        )}

        {/* Player Character Arc */}
        {scenario.playerCharacterArc && (
          <div style={{ backgroundColor: 'rgba(78, 205, 196, 0.1)', padding: '14px', borderRadius: '8px', marginBottom: '20px', borderLeft: '3px solid #4ecdc4' }}>
            <h3 style={{ color: '#4ecdc4', fontSize: '14px', margin: '0 0 8px 0' }}>🦋 Трансформация героя</h3>
            <p style={{ color: '#c0c0c0', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>{scenario.playerCharacterArc}</p>
            {scenario.heroDramaturgy?.transformation && (
              <p style={{ color: '#888', fontSize: '12px', margin: '8px 0 0 0', fontStyle: 'italic' }}>
                → {scenario.heroDramaturgy.transformation}
              </p>
            )}
          </div>
        )}

        {/* NPCs */}
        {scenario.npcs && scenario.npcs.length > 0 && (
          <>
            <h2 style={{ color: '#f39c12', fontSize: '16px', marginBottom: '12px' }}>👥 Ключевые NPC</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '24px' }}>
              {scenario.npcs.map((npc, i) => (
                <div key={i} style={{ backgroundColor: 'rgba(243, 156, 18, 0.06)', padding: '12px', borderRadius: '6px', borderLeft: npc.potentialBetrayal ? '3px solid #e74c3c' : '3px solid #f39c12' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#f39c12', fontSize: '13px' }}>{npc.name}</strong>
                    <span style={{ fontSize: '10px', color: npc.potentialBetrayal ? '#e74c3c' : '#666' }}>
                      {npc.potentialBetrayal ? '⚠️' : ''} Акт {npc.firstAppearance}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{npc.role}</div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>{npc.personality}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ACTS */}
        <h2 style={{ color: '#e6b800', fontSize: '16px', marginBottom: '12px' }}>📖 Акты</h2>
        <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
          {scenario.acts?.map((act) => (
            <div key={act.actNumber} style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', borderLeft: `3px solid ${act.actNumber === 1 ? '#4ecdc4' : act.actNumber === 2 ? '#ffe66d' : '#ff6b6b'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ backgroundColor: act.actNumber === 1 ? '#4ecdc4' : act.actNumber === 2 ? '#ffe66d' : '#ff6b6b', color: '#1a1a2e', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                  АКТ {act.actNumber}
                </span>
                <span style={{ color: '#e0e0e0', fontSize: '14px', fontWeight: 500 }}>{act.title}</span>
              </div>
              <p style={{ color: '#a0a0a0', fontSize: '13px', lineHeight: 1.5, margin: '0 0 10px 0' }}>{act.description}</p>
              <div style={{ fontSize: '12px', color: '#777' }}>
                {act.keyEvents?.length > 0 && <div><strong style={{ color: '#999' }}>События:</strong> {act.keyEvents.join(' → ')}</div>}
                {act.moralChoices?.length > 0 && <div style={{ marginTop: '4px' }}><strong style={{ color: '#9b59b6' }}>Выборы:</strong> {act.moralChoices.join('; ')}</div>}
                {act.revelations?.length > 0 && <div style={{ marginTop: '4px' }}><strong style={{ color: '#3498db' }}>Раскрытия:</strong> {act.revelations.join('; ')}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Side Conflicts */}
        {scenario.sideConflicts && scenario.sideConflicts.length > 0 && (
          <>
            <h2 style={{ color: '#e74c3c', fontSize: '16px', marginBottom: '12px' }}>⚡ Побочные конфликты</h2>
            <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
              {scenario.sideConflicts.map((conflict, i) => (
                <div key={i} style={{ backgroundColor: 'rgba(231, 76, 60, 0.06)', padding: '12px', borderRadius: '6px' }}>
                  <strong style={{ color: '#e74c3c', fontSize: '13px' }}>{conflict.name}</strong>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{conflict.parties?.join(' vs ')} — {conflict.nature}</div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>→ {conflict.connectionToMain}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Chekhov's Guns */}
        {scenario.chekhovsGuns && scenario.chekhovsGuns.length > 0 && (
          <>
            <h2 style={{ color: '#9b59b6', fontSize: '16px', marginBottom: '12px' }}>🔫 Чеховские ружья</h2>
            <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
              {scenario.chekhovsGuns.map((gun, i) => (
                <div key={i} style={{ backgroundColor: 'rgba(155, 89, 182, 0.06)', padding: '10px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: '#9b59b6', fontSize: '12px', minWidth: '100px' }}>{gun.element}</span>
                  <span style={{ color: '#666', fontSize: '11px' }}>Акт {gun.actIntroduced}: {gun.introduction}</span>
                  <span style={{ color: '#444' }}>→</span>
                  <span style={{ color: '#888', fontSize: '11px' }}>Акт {gun.actPayoff}: {gun.payoff}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Climax */}
        <div style={{ backgroundColor: 'rgba(255, 107, 107, 0.1)', padding: '14px', borderRadius: '8px', marginBottom: '16px', borderLeft: '3px solid #ff6b6b' }}>
          <h3 style={{ color: '#ff6b6b', fontSize: '14px', margin: '0 0 6px 0' }}>🔥 Кульминация</h3>
          <p style={{ color: '#c0c0c0', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>{scenario.climax}</p>
        </div>

        {/* Endings */}
        <h3 style={{ color: '#e6b800', fontSize: '14px', marginBottom: '10px' }}>🎭 Возможные концовки</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          <div style={{ backgroundColor: 'rgba(46, 204, 113, 0.08)', padding: '10px', borderRadius: '6px' }}>
            <div style={{ color: '#2ecc71', fontSize: '11px', marginBottom: '4px', fontWeight: 'bold' }}>🏆 ТРИУМФ</div>
            <p style={{ color: '#999', fontSize: '12px', margin: 0, lineHeight: 1.4 }}>{scenario.possibleEndings?.triumph}</p>
          </div>
          <div style={{ backgroundColor: 'rgba(241, 196, 15, 0.08)', padding: '10px', borderRadius: '6px' }}>
            <div style={{ color: '#f1c40f', fontSize: '11px', marginBottom: '4px', fontWeight: 'bold' }}>💔 ГОРЬКО-СЛАДКАЯ</div>
            <p style={{ color: '#999', fontSize: '12px', margin: 0, lineHeight: 1.4 }}>{scenario.possibleEndings?.bittersweet}</p>
          </div>
          <div style={{ backgroundColor: 'rgba(231, 76, 60, 0.08)', padding: '10px', borderRadius: '6px' }}>
            <div style={{ color: '#e74c3c', fontSize: '11px', marginBottom: '4px', fontWeight: 'bold' }}>💀 ТРАГЕДИЯ</div>
            <p style={{ color: '#999', fontSize: '12px', margin: 0, lineHeight: 1.4 }}>{scenario.possibleEndings?.tragic}</p>
          </div>
        </div>

        {/* Warnings */}
        {scenario.warnings && scenario.warnings.length > 0 && (
          <div style={{ fontSize: '11px', color: '#666', marginBottom: '16px' }}>
            ⚠️ Темы: {scenario.warnings.join(', ')}
          </div>
        )}

        {/* Debug JSON */}
        <details style={{ marginTop: '16px' }}>
          <summary style={{ color: '#555', cursor: 'pointer', fontSize: '11px' }}>🔧 Debug: Raw JSON</summary>
          <pre style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', fontSize: '10px', color: '#666', overflow: 'auto', maxHeight: '250px' }}>
            {JSON.stringify(scenario, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
};

// Character Selection Panel - Redesigned
const CharacterSelectionPanel: React.FC<{
  characters: PlayableCharacter[];
  selectedCharacter: PlayableCharacter | null;
  characterContext: { sharedWorld: string; timeline: string } | null;
  isOpen: boolean;
  onSelect: (character: PlayableCharacter) => void;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ characters, selectedCharacter, characterContext, isOpen, onSelect, onClose, onConfirm }) => {
  if (!isOpen || characters.length === 0) return null;

  const getPlaystyleIcon = (ps: string) => {
    if (ps === 'боевой') return '⚔️';
    if (ps === 'интриги') return '🗡️';
    if (ps === 'дипломатия') return '🤝';
    if (ps === 'торговля') return '💰';
    return '🔮';
  };

  const getPlaystyleColor = (ps: string) => {
    if (ps === 'боевой') return '#e74c3c';
    if (ps === 'интриги') return '#9b59b6';
    if (ps === 'дипломатия') return '#2ecc71';
    if (ps === 'торговля') return '#f1c40f';
    return '#3498db';
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(5, 10, 15, 0.95)',
      backdropFilter: 'blur(8px)',
      zIndex: 1002,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px'
    }}>
      <div style={{
        backgroundColor: '#0d1117',
        borderRadius: '16px',
        maxWidth: '1200px',
        width: '100%',
        maxHeight: '92vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #21262d'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '24px 28px', 
          borderBottom: '1px solid #21262d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, color: '#e6edf3', fontSize: '24px', fontWeight: 600 }}>
              Выберите персонажа
            </h2>
            {characterContext && (
              <p style={{ margin: '8px 0 0 0', color: '#7d8590', fontSize: '15px' }}>
                {characterContext.timeline}
              </p>
            )}
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#7d8590', 
              cursor: 'pointer', 
              fontSize: '20px',
              padding: '4px 8px'
            }}
          >
            ×
          </button>
        </div>

        {/* Character Cards */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: '24px 28px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
          alignContent: 'start'
        }}>
          {characters.map((char) => {
            const isSelected = selectedCharacter?.id === char.id;
            const playstyleColor = getPlaystyleColor(char.playstyle);
            const avatar = getAvatarById(char.avatarId);
            
            return (
              <div 
                key={char.id}
                onClick={() => onSelect(char)}
                style={{ 
                  backgroundColor: isSelected ? 'rgba(78, 205, 196, 0.08)' : '#161b22',
                  borderRadius: '12px',
                  border: isSelected ? '2px solid #4ecdc4' : '1px solid #30363d',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Avatar Section - 3:4 aspect ratio */}
                <div style={{ 
                  width: '100%',
                  aspectRatio: '3 / 4',
                  position: 'relative',
                  overflow: 'hidden',
                  backgroundColor: '#0d1117'
                }}>
                  {avatar ? (
                    <img 
                      src={avatar.imageSrc}
                      alt={char.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center top',
                        filter: isSelected ? 'brightness(1.1)' : 'brightness(0.9)',
                        transition: 'filter 0.2s ease'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#21262d',
                      color: '#7d8590',
                      fontSize: '64px'
                    }}>
                      👤
                    </div>
                  )}
                  {/* Gradient overlay */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '60px',
                    background: 'linear-gradient(transparent, #161b22)',
                    pointerEvents: 'none'
                  }} />
                  {/* Playstyle badge */}
                  <span style={{ 
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    fontSize: '12px', 
                    padding: '4px 10px', 
                    backgroundColor: `${playstyleColor}dd`,
                    color: '#fff',
                    borderRadius: '6px',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
                  }}>
                    {getPlaystyleIcon(char.playstyle)} {char.playstyle}
                  </span>
                </div>

                {/* Card Header */}
                <div style={{ 
                  padding: '14px 16px 10px',
                  borderBottom: `1px solid ${isSelected ? 'rgba(78, 205, 196, 0.2)' : '#21262d'}`
                }}>
                  <h3 style={{ 
                    margin: 0, 
                    color: isSelected ? '#4ecdc4' : '#e6edf3', 
                    fontSize: '18px',
                    fontWeight: 600,
                    lineHeight: 1.3
                  }}>
                    {char.name}
                  </h3>
                  <p style={{ margin: '4px 0 0 0', color: '#7d8590', fontSize: '14px', lineHeight: 1.4 }}>
                    {char.title}
                  </p>
                </div>

                {/* Card Body */}
                <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Personality */}
                  <p style={{ 
                    color: '#c9d1d9', 
                    fontSize: '14px', 
                    lineHeight: 1.6, 
                    margin: '0 0 12px 0',
                    flex: 1
                  }}>
                    {char.personality}
                  </p>

                  {/* Ambition */}
                  <div style={{ 
                    backgroundColor: 'rgba(230, 184, 0, 0.08)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    marginBottom: '12px'
                  }}>
                    <div style={{ color: '#e6b800', fontSize: '11px', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      ЦЕЛЬ
                    </div>
                    <p style={{ color: '#c9d1d9', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                      {char.ambition}
                    </p>
                  </div>

                  {/* Skills row */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {char.skills?.slice(0, 3).map((skill, i) => (
                      <span key={i} style={{
                        backgroundColor: 'rgba(110, 118, 129, 0.15)',
                        color: '#7d8590',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 500
                      }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ 
          padding: '20px 28px', 
          borderTop: '1px solid #21262d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0d1117'
        }}>
          <div style={{ color: '#7d8590', fontSize: '15px' }}>
            {selectedCharacter ? (
              <span>
                <span style={{ color: '#4ecdc4', fontWeight: 500 }}>{selectedCharacter.name}</span> • {selectedCharacter.startingPosition}
              </span>
            ) : (
              'Нажмите на карточку персонажа'
            )}
          </div>
          <button
            onClick={onConfirm}
            disabled={!selectedCharacter}
            style={{
              padding: '12px 28px',
              fontSize: '16px',
              backgroundColor: selectedCharacter ? '#238636' : '#21262d',
              color: selectedCharacter ? '#fff' : '#484f58',
              border: 'none',
              borderRadius: '8px',
              cursor: selectedCharacter ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              transition: 'all 0.15s ease'
            }}
          >
            Подтвердить выбор
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper to find closest cell ID for a point
const getClosestCellId = (point: Point2D, cells: CellData[]): number => {
    let minD = Infinity;
    let closest = -1;
    // Optimization: check only a subset if possible, but for ~2000 cells this is fast enough
    for (const c of cells) {
        const d = (c.center.x - point.x)**2 + (c.center.y - point.y)**2;
        if (d < minD) { minD = d; closest = c.id; }
    }
    return closest;
};

const GameInterface: React.FC = () => {
  // Static World Data
  const [worldData, setWorldData] = useState<WorldData | null>(null);
  
  // Selection State
  const [selectedLocation, setSelectedLocation] = useState<POI | null>(null);
  const [selectedKingdom, setSelectedKingdom] = useState<Kingdom | null>(null);
  const [hoveredKingdom, setHoveredKingdom] = useState<Kingdom | null>(null);
  
  // UI State
  const [warMode, setWarMode] = useState(false);
  const [viewMode, setViewMode] = useState<'WORLD' | 'CITY'>('WORLD');
  
  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // --- INITIALIZATION ---
  useEffect(() => {
    // Generate static world once
    const data = generateWorld(DEFAULT_WORLD_CONFIG);
    
    // Initialize capital and city image assignments based on kingdom/city geography
    // Pass world seed for deterministic shuffling
    initializeImageAssignments(data.kingdoms, data.seed);
    
    setWorldData(data);
  }, []);

  // --- SIMULATION ENGINE ---
  const { state: worldState, actions: simulationActions } = useWorldSimulation(worldData);

  // --- WORLD LORE, CHARACTERS & SCENARIO (LLM) ---
  const { 
    lore: worldLore, 
    scenario: worldScenario,
    characters: playableCharacters,
    selectedCharacter,
    characterContext,
    // Scene state (Showrunner)
    currentScene,
    sceneNumber,
    isGameStarted,
    // Player state
    playerState,
    lastAppliedEffects,
    // Story state (Director)
    storyState,
    lastDirective,
    // Travel & Quest state
    travelState,
    quests,
    // Loading states
    isGenerating: isGeneratingLore, 
    isGeneratingCharacters,
    isGeneratingScenario,
    isGeneratingScene,
    error: loreError, 
    // Actions
    generate: generateLore,
    generateCharacters,
    selectCharacter,
    generateWorldScenario,
    startGame,
    continueWithChoice,
    // Debug
    debugStore,
    clearDebugLogs
  } = useWorldLore();
  
  // Travel UI state
  const [showTravelView, setShowTravelView] = useState(false);
  const [showTravelPaths, setShowTravelPaths] = useState(false);
  const [selectedTravelDestination, setSelectedTravelDestination] = useState<string | null>(null); // POI id
  const [isLorePanelOpen, setIsLorePanelOpen] = useState(false);
  const [isCharacterPanelOpen, setIsCharacterPanelOpen] = useState(false);
  const [isScenarioPanelOpen, setIsScenarioPanelOpen] = useState(false);

  const handleGenerateLore = async () => {
    if (!worldData || !worldState) return;
    
    console.log('BEFORE lore generation - assignments:', getAssignmentCounts());
    
    const result = await generateLore(worldData, worldState);
    if (result) {
      console.log('AFTER lore generation - assignments:', getAssignmentCounts());
      
      // Apply initial states from LLM to simulation
      result.kingdoms.forEach(kLore => {
        // Find the kingdom data
        const kingdom = worldData.kingdoms.find(k => k.id === kLore.id);
        if (!kingdom) return;
        
        // Update kingdom state
        if (kLore.initialState) {
          const rulerFullTitle = kLore.initialState.rulerTitle 
            ? `${kLore.initialState.rulerTitle} ${kLore.initialState.rulerName}`
            : kLore.initialState.rulerName;
            
          simulationActions.updateKingdomState(kLore.id, {
            ruler: {
              name: rulerFullTitle,
              personality: kLore.initialState.rulerPersonality
            },
            military: {
              strength: kLore.initialState.militaryStrength,
              readiness: 100
            },
            resources: {
              gold: kLore.initialState.gold,
              mana: kLore.initialState.mana,
              food: kLore.initialState.food
            }
          });
        }
        
        // Update city images based on LLM-generated specialties
        if (kLore.cities) {
          kLore.cities.forEach(cityLore => {
            const city = kingdom.cities.find(c => c.id === cityLore.id || c.name === cityLore.name);
            if (city && cityLore.specialty) {
              updateCityImageFromLore(
                city.id,
                city.climate || kingdom.geography.climateZone,
                city.biome || 'PLAINS',
                kingdom.geography.hasCoastline,
                cityLore.specialty
              );
            }
          });
        }
      });
      
      console.log('AFTER city image updates - assignments:', getAssignmentCounts());
      
      setIsLorePanelOpen(true);
      addLog('system', `The chroniclers have compiled the history of **${result.worldName}**. Kingdom states initialized.`);
    }
  };

  // Generate playable characters (after lore)
  const handleGenerateCharacters = async () => {
    if (!worldData || !worldState || !worldLore) return;
    
    const result = await generateCharacters(worldData, worldState, worldLore);
    if (result) {
      setIsCharacterPanelOpen(true);
      addLog('system', `🎭 The fates have revealed **${result.characters.length}** possible destinies...`);
    }
  };

  // Confirm character selection and generate scenario
  const handleConfirmCharacter = async () => {
    if (!worldData || !worldState || !worldLore || !selectedCharacter) return;
    
    setIsCharacterPanelOpen(false);
    addLog('system', `You have chosen to walk the path of **${selectedCharacter.name}**, ${selectedCharacter.title}.`);
    
    // Get supporting cast (other characters that weren't selected)
    const supportingCast = playableCharacters.filter(c => c.id !== selectedCharacter.id);
    if (supportingCast.length > 0) {
      addLog('system', `🎭 Supporting cast: ${supportingCast.map(c => c.name).join(', ')} will appear as NPCs.`);
    }
    
    // Now generate scenario for selected character WITH supporting cast
    const result = await generateWorldScenario(
      worldData, 
      worldState, 
      worldLore, 
      selectedCharacter,
      playableCharacters  // Pass all characters so hook can extract supporting cast
    );
    
    if (result) {
      setIsScenarioPanelOpen(true);
      addLog('system', `📜 The Narrator has crafted your saga: **${result.title}**`);
    }
  };

  // Initialize logs once state is ready
  useEffect(() => {
      if (worldState && logs.length === 0) {
        setLogs([
            { id: 1, type: 'system', text: 'Welcome, Traveler. The world of **Ethereal** awaits.', timestamp: `Year ${worldState.date.year}` }
        ]);
      }
  }, [worldState, logs.length]);

  const addLog = (type: LogEntry['type'], text: string) => {
    if (!worldState) return;
    setLogs(prev => [...prev, {
      id: Date.now(),
      type,
      text,
      timestamp: `Year ${worldState.date.year}`
    }]);
  };

  // --- WAR ACTIONS ---
  // Now creates a CONFLICT instead of instant capture
  const handleWarAction = (action: { type: 'conquest', attackerId: number, defenderId: number, cellId: number, capturedCellIds: number[] }) => {
      if (!worldData || !worldState) return;

      const { attackerId, defenderId, capturedCellIds } = action;
      const attackerK = worldData.kingdoms.find(k => k.id === attackerId);
      const defenderK = worldData.kingdoms.find(k => k.id === defenderId);

      // Start conflict instead of instant capture
      simulationActions.startConflict(attackerId, defenderId, capturedCellIds);
      
      addLog('combat', `**${attackerK?.name}** has initiated battle against **${defenderK?.name}**! Territory is now contested.`);
  };

  // Apply territory transfer after conflict resolution
  const applyConflictResolution = (winnerId: number, loserId: number, cellIds: number[]) => {
      if (!worldData || !worldState) return;

      const newCells = [...worldData.cells];
      const newKingdoms = worldData.kingdoms.map(k => ({ 
          ...k, 
          cellIds: [...k.cellIds],
          cities: [...k.cities], 
          capital: { ...k.capital } 
      }));

      // Update cell owners
      cellIds.forEach(id => {
          newCells[id] = { ...newCells[id], kingdomId: winnerId };
      });

      const winner = newKingdoms.find(k => k.id === winnerId)!;
      const loser = newKingdoms.find(k => k.id === loserId)!;

      // Update territory lists
      winner.cellIds = [...winner.cellIds, ...cellIds];
      loser.cellIds = loser.cellIds.filter(id => !cellIds.includes(id));

      // Recompute Visuals
      winner.svgPath = computeKingdomPath(winner.cellIds, newCells);
      loser.svgPath = computeKingdomPath(loser.cellIds, newCells);

      // --- CAPTURE CITIES ---
      const capturedCities: POI[] = [];
      const citiesToKeepInLoser: POI[] = [];

      loser.cities.forEach(city => {
          const cellId = getClosestCellId(city.position, newCells);
          if (cellIds.includes(cellId)) {
              city.kingdomId = winnerId;
              capturedCities.push(city);
          } else {
              citiesToKeepInLoser.push(city);
          }
      });

      // Check capital capture
      const capitalCellId = getClosestCellId(loser.capital.position, newCells);
      
      if (cellIds.includes(capitalCellId)) {
          const capturedCapitalAsCity: POI = { 
              ...loser.capital, 
              kingdomId: winnerId, 
              type: 'city' 
          };
          capturedCities.push(capturedCapitalAsCity);
          
          if (citiesToKeepInLoser.length > 0) {
              const newCapitalPOI = citiesToKeepInLoser[0];
              citiesToKeepInLoser.shift();
              loser.capital = { ...newCapitalPOI, type: 'capital' };
              addLog('combat', `The capital of **${loser.name}** has fallen! The court moves to **${newCapitalPOI.name}**.`);
      } else {
              loser.capital.position = { x: -9999, y: -9999 };
              loser.capital.kingdomId = -1; 
              loser.capital.id = `ruins-${loser.capital.id}`;
              loser.capital.name = `Ruins of ${loser.capital.name}`;
              addLog('combat', `The kingdom of **${loser.name}** has been wiped out!`);
          }
      }

      loser.cities = citiesToKeepInLoser;
      winner.cities = [...winner.cities, ...capturedCities];

      setWorldData({
          ...worldData,
          cells: newCells,
          kingdoms: newKingdoms
      });

      if (capturedCities.length > 0) {
          const cityNames = capturedCities.map(c => c.name).join(', ');
          addLog('combat', `**${winner.name}** captured **${cityNames}**!`);
      } else {
          addLog('combat', `**${winner.name}** captured territory!`);
      }
  };

  // Handle battle round resolution
  const handleBattleRound = (conflictId: string) => {
      const result = simulationActions.resolveBattleRound(conflictId);
      if (!result || !worldState) return;

      const conflict = worldState.activeConflicts.find(c => c.id === conflictId);
      if (!conflict) return;

      const attackerK = worldData?.kingdoms.find(k => k.id === conflict.attackerId);
      const defenderK = worldData?.kingdoms.find(k => k.id === conflict.defenderId);

      if (result.status === 'ATTACKER_WINNING') {
          addLog('combat', `Battle rages! **${attackerK?.name}** is winning. Losses: ${result.attackerLosses} vs ${result.defenderLosses}`);
      } else if (result.status === 'DEFENDER_WINNING') {
          addLog('combat', `Battle rages! **${defenderK?.name}** holds the line! Losses: ${result.defenderLosses} vs ${result.attackerLosses}`);
      } else {
          addLog('combat', `Stalemate! Both sides suffer. Losses: ${result.attackerLosses} / ${result.defenderLosses}`);
      }
  };

  // Force resolve conflict
  const handleForceResolve = (conflictId: string, outcome: 'ATTACKER_VICTORY' | 'DEFENDER_VICTORY' | 'RETREAT') => {
      if (!worldState) return;

      const conflict = worldState.activeConflicts.find(c => c.id === conflictId);
      if (!conflict) return;

      const attackerK = worldData?.kingdoms.find(k => k.id === conflict.attackerId);
      const defenderK = worldData?.kingdoms.find(k => k.id === conflict.defenderId);

      simulationActions.forceResolveConflict(conflictId, outcome);

      if (outcome === 'ATTACKER_VICTORY') {
          applyConflictResolution(conflict.attackerId, conflict.defenderId, conflict.contestedCellIds);
          addLog('combat', `**${attackerK?.name}** is VICTORIOUS! Territory seized.`);
      } else if (outcome === 'DEFENDER_VICTORY') {
          // Defender can counter-attack and take some attacker territory!
          addLog('combat', `**${defenderK?.name}** REPELS the invasion! Enemy forces retreat.`);
      } else {
          addLog('combat', `Both sides retreat. The contested territory remains disputed.`);
      }

      // Clear conflict after resolution
      setTimeout(() => simulationActions.clearConflict(conflictId), 1000);
  };

  // --- INTERACTION ---
  const handleLocationSelect = (location: POI | null, kingdom: Kingdom | null) => {
    // If we select a location, we need to find its CURRENT owner from worldData, 
    // because it might have changed during war
    if (location && worldData) {
        const currentOwner = worldData.kingdoms.find(k => 
            k.id === location.kingdomId || 
            k.cities.some(c => c.id === location.id) || 
            k.capital.id === location.id
        );
        setSelectedLocation(location);
        setSelectedKingdom(currentOwner || kingdom);
    } else {
    setSelectedLocation(location);
    setSelectedKingdom(kingdom);
    }
  };

  // Determine starting location based on selected character
  const getStartingLocation = (): POI | null => {
    if (!selectedCharacter || !worldData) return null;
    
    const startKingdom = worldData.kingdoms.find(k => k.id === selectedCharacter.startingKingdom);
    if (!startKingdom) return worldData.kingdoms[0]?.capital || null;
    
    // Return the capital of the starting kingdom
    return startKingdom.capital;
  };

  const startingLocation = getStartingLocation();
  
  // Get current player location (during game)
  const currentPlayerLocation = React.useMemo((): POI | null => {
    if (!worldData || !travelState) return startingLocation;
    return getPOIById(worldData, travelState.currentLocationId) || startingLocation;
  }, [worldData, travelState, startingLocation]);
  
  // Show travel path only when destination is selected
  const shouldShowTravelPaths = !!selectedTravelDestination || showTravelPaths;
  
  // Calculate travel paths for map visualization - only to selected destination
  const travelPaths = React.useMemo((): TravelPath[] => {
    if (!worldData || !travelState) return [];
    
    // If there's a selected destination, show only that path
    if (selectedTravelDestination) {
      const paths = createPathLines(
        travelState.currentLocationId,
        worldData,
        travelState,
        false // Include cross-kingdom for quest targets
      );
      // Filter to only selected destination
      return paths
        .filter(p => p.toId === selectedTravelDestination)
        .map(p => ({
          ...p,
          from: p.from,
          to: p.to
        }));
    }
    
    // If showTravelPaths is enabled manually, show all kingdom routes
    if (showTravelPaths) {
      const paths = createPathLines(
        travelState.currentLocationId,
        worldData,
        travelState,
        true
      );
      return paths.map(p => ({
        ...p,
        from: p.from,
        to: p.to
      }));
    }
    
    return [];
  }, [worldData, travelState, selectedTravelDestination, showTravelPaths]);
  
  // Get available routes with names for TravelView
  const availableRoutes = React.useMemo(() => {
    if (!worldData || !travelState) return [];
    
    return getKingdomRoutes(travelState.currentLocationId, worldData).map(route => {
      const targetPOI = getPOIById(worldData, route.toId);
      return {
        ...route,
        targetName: targetPOI?.name || 'Unknown'
      };
    });
  }, [worldData, travelState]);
  
  // Get quest target location
  const questTargetLocation = React.useMemo((): POI | null => {
    if (!worldData || !travelState?.travelQuest) return null;
    return getPOIById(worldData, travelState.travelQuest.targetLocationId) || null;
  }, [worldData, travelState]);
  
  // Handle travel selection from map - clicking on a city
  const handleTravelSelect = (toLocationId: string) => {
    if (!worldData || !travelState) return;
    
    // If clicking on same destination, deselect
    if (selectedTravelDestination === toLocationId) {
      setSelectedTravelDestination(null);
      return;
    }
    
    // Check if this is the quest target or within kingdom
    const isQuestTarget = travelState.travelQuest?.targetLocationId === toLocationId;
    const isUnlocked = travelState.unlockedLocations.includes(toLocationId);
    
    if (isQuestTarget || isUnlocked) {
      setSelectedTravelDestination(toLocationId);
    }
  };
  
  // Get route to selected destination
  const selectedRoute = React.useMemo(() => {
    if (!worldData || !travelState || !selectedTravelDestination) return null;
    
    // Get all routes (including cross-kingdom for quests)
    const allRoutes = createPathLines(
      travelState.currentLocationId,
      worldData,
      travelState,
      false
    );
    
    const path = allRoutes.find(p => p.toId === selectedTravelDestination);
    if (!path) return null;
    
    const targetPOI = getPOIById(worldData, selectedTravelDestination);
    return {
      ...path,
      targetName: targetPOI?.name || 'Неизвестная локация',
      targetPOI
    };
  }, [worldData, travelState, selectedTravelDestination]);
  
  // Handle travel action - start the journey
  const handleStartTravel = async () => {
    if (!worldData || !worldState || !travelState || !selectedCharacter || !selectedRoute) return;
    
    // Check if player has enough gold
    if (playerState.stats.gold < selectedRoute.cost) {
      addLog('system', `❌ Недостаточно золота для путешествия! Нужно: ${selectedRoute.cost}, у вас: ${playerState.stats.gold}`);
      return;
    }
    
    // Create a travel choice
    const travelChoice: SceneChoice = {
      id: `travel-${selectedRoute.toId}`,
      text: `Отправиться в ${selectedRoute.targetName}`,
      tone: 'travel',
      travelTo: {
        locationId: selectedRoute.toId,
        locationName: selectedRoute.targetName,
        distance: selectedRoute.distance,
        cost: selectedRoute.cost,
        danger: selectedRoute.danger
      },
      effects: [
        { type: 'stat', stat: { attribute: 'gold', change: -selectedRoute.cost, target: 'player' } }
      ]
    };
    
    // Clear selection
    setSelectedTravelDestination(null);
    setShowTravelView(false);
    setShowTravelPaths(false);
    
    // Get target location for scene generation
    const targetKingdom = worldData.kingdoms.find(k => 
      k.capital.id === selectedRoute.toId || k.cities.some(c => c.id === selectedRoute.toId)
    );
    
    if (selectedRoute.targetPOI && targetKingdom) {
      addLog('system', `🚶 Отправляемся в **${selectedRoute.targetName}**... (${selectedRoute.distance} дн., ${selectedRoute.cost} золота)`);
      await continueWithChoice(worldData, worldState, {
        name: selectedRoute.targetPOI.name,
        type: selectedRoute.targetPOI.type,
        kingdomId: targetKingdom.id,
        id: selectedRoute.targetPOI.id
      }, travelChoice);
    }
  };
  
  // Legacy handler for TravelView modal
  const handleTravel = async (route: TravelRoute) => {
    setSelectedTravelDestination(route.toId);
    // Will trigger via selectedRoute
  };

  // Auto-select starting location when scenario is generated
  React.useEffect(() => {
    if (startingLocation && worldScenario && !selectedLocation) {
      const startKingdom = worldData?.kingdoms.find(k => k.id === selectedCharacter?.startingKingdom);
      if (startKingdom) {
        setSelectedLocation(startingLocation);
        setSelectedKingdom(startKingdom);
        addLog('system', `📍 Ваша история начинается в **${startingLocation.name}**, ${startKingdom.name}.`);
      }
    }
  }, [worldScenario, startingLocation]);

  // --- CITY ACTIONS ---
  const handleEnterCity = () => {
    if (selectedLocation) {
      setViewMode('CITY');
      addLog('system', `Entering the gates of **${selectedLocation.name}**...`);
    }
  };

  // --- GAME START (Showrunner) ---
  const handleStartGame = async () => {
    if (!worldData || !worldState || !startingLocation || !selectedCharacter) return;
    
    const startKingdom = worldData.kingdoms.find(k => k.id === selectedCharacter.startingKingdom);
    if (!startKingdom) return;
    
    addLog('system', `🎬 Showrunner начинает вашу историю...`);
    
    const scene = await startGame(worldData, worldState, {
      name: startingLocation.name,
      type: startingLocation.type,
      kingdomId: startKingdom.id
    });
    
    if (scene) {
      addLog('system', `📖 Сцена 1: ${scene.location}`);
    }
  };

  // --- SCENE CHOICE HANDLER ---
  const handleSceneChoice = async (choice: SceneChoice) => {
    if (!worldData || !worldState || !selectedLocation || !selectedCharacter) return;
    
    addLog('system', `▶️ Выбор: ${choice.text}`);
    
    const scene = await continueWithChoice(worldData, worldState, {
      name: selectedLocation.name,
      type: selectedLocation.type,
      kingdomId: selectedLocation.kingdomId
    }, choice);  // Pass full choice object for effects
    
    if (scene) {
      addLog('system', `📖 Сцена ${scene.sceneNumber}: ${scene.location}`);
    }
  };

  if (!worldData || !worldState) {
      return <div className="loading-screen">Forging the world...</div>;
  }

  const displayKingdomId = selectedKingdom?.id ?? worldData.kingdoms[0].id;
  const currentKingdomState = worldState.kingdoms[displayKingdomId];

  return (
    <div className="game-interface">
      {/* Game Debug Panel - единая панель отладки */}
      <GameDebugPanel 
        debugStore={debugStore} 
        onClearLogs={clearDebugLogs}
        playerState={playerState}
        worldLore={worldLore}
        worldScenario={worldScenario}
        selectedCharacter={selectedCharacter}
        sceneNumber={sceneNumber}
        isGameStarted={isGameStarted}
        storyState={storyState}
        lastDirective={lastDirective}
      />

      <DebugPanel 
        title="🌍 World State Debug" 
        data={{
            date: worldState.date,
            viewMode,
            activeConflicts: worldState.activeConflicts.length,
            selectedLocation: selectedLocation ? {
                name: selectedLocation.name,
                ownerId: selectedLocation.kingdomId,
                "GEOGRAPHIC_CLIMATE": selectedLocation.climate || 
                    (selectedLocation.position.y < worldData.height * 0.35 ? 'NORTH' : 
                     selectedLocation.position.y > worldData.height * 0.70 ? 'SOUTH' : 'CENTRAL')
            } : null,
            ownerKingdom: selectedKingdom ? {
                name: selectedKingdom.name,
                id: selectedKingdom.id,
                climate: selectedKingdom.geography.climateZone,
                biome: selectedKingdom.geography.dominantBiome,
                // Dynamic state from simulation
                military: worldState.kingdoms[selectedKingdom.id]?.military,
                resources: worldState.kingdoms[selectedKingdom.id]?.resources
            } : null,
            warMode
        }} 
      />

      <LorePanel 
        lore={worldLore}
        isOpen={isLorePanelOpen}
        onClose={() => setIsLorePanelOpen(false)}
      />

      <ScenarioPanel 
        scenario={worldScenario}
        isOpen={isScenarioPanelOpen}
        onClose={() => setIsScenarioPanelOpen(false)}
      />

      <CharacterSelectionPanel
        characters={playableCharacters}
        selectedCharacter={selectedCharacter}
        characterContext={characterContext}
        isOpen={isCharacterPanelOpen}
        onSelect={selectCharacter}
        onClose={() => setIsCharacterPanelOpen(false)}
        onConfirm={handleConfirmCharacter}
      />

      {/* Active Conflicts Panel */}
      {worldState.activeConflicts.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(30, 20, 20, 0.95)',
          border: '2px solid #c0392b',
          borderRadius: '12px',
          padding: '16px',
          zIndex: 100,
          minWidth: '400px',
          maxWidth: '600px',
          boxShadow: '0 0 30px rgba(192, 57, 43, 0.4)'
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#e74c3c', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px' }}>
            ⚔️ Active Conflicts
          </h3>
          {worldState.activeConflicts.map(conflict => {
            const attackerK = worldData.kingdoms.find(k => k.id === conflict.attackerId);
            const defenderK = worldData.kingdoms.find(k => k.id === conflict.defenderId);
            const attackerState = worldState.kingdoms[conflict.attackerId];
            const defenderState = worldState.kingdoms[conflict.defenderId];
            
            return (
              <div key={conflict.id} style={{
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: attackerK?.color || '#fff', fontWeight: 'bold' }}>
                    {attackerK?.name} ({attackerState?.military.strength})
                  </span>
                  <span style={{ color: '#888', fontSize: '12px' }}>VS</span>
                  <span style={{ color: defenderK?.color || '#fff', fontWeight: 'bold' }}>
                    {defenderK?.name} ({defenderState?.military.strength})
                  </span>
                </div>
                
                <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '8px' }}>
                  Status: <span style={{ 
                    color: conflict.status === 'ATTACKER_WINNING' ? '#27ae60' : 
                           conflict.status === 'DEFENDER_WINNING' ? '#3498db' : '#f39c12'
                  }}>{conflict.status}</span>
                  {' | '} Rounds: {conflict.rounds} {' | '} Cells: {conflict.contestedCellIds.length}
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => handleBattleRound(conflict.id)}
                    style={{
                      padding: '6px 12px', fontSize: '11px', cursor: 'pointer',
                      backgroundColor: '#8e44ad', color: '#fff', border: 'none', borderRadius: '4px'
                    }}
                  >
                    🎲 Battle Round
                  </button>
                  <button 
                    onClick={() => handleForceResolve(conflict.id, 'ATTACKER_VICTORY')}
                    style={{
                      padding: '6px 12px', fontSize: '11px', cursor: 'pointer',
                      backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px'
                    }}
                  >
                    ✓ Attacker Wins
                  </button>
                  <button 
                    onClick={() => handleForceResolve(conflict.id, 'DEFENDER_VICTORY')}
                    style={{
                      padding: '6px 12px', fontSize: '11px', cursor: 'pointer',
                      backgroundColor: '#3498db', color: '#fff', border: 'none', borderRadius: '4px'
                    }}
                  >
                    ✓ Defender Wins
                  </button>
                  <button 
                    onClick={() => handleForceResolve(conflict.id, 'RETREAT')}
                    style={{
                      padding: '6px 12px', fontSize: '11px', cursor: 'pointer',
                      backgroundColor: '#7f8c8d', color: '#fff', border: 'none', borderRadius: '4px'
                    }}
                  >
                    ↩ Retreat Both
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="side-panel story-log-container">
        <StoryLog logs={logs} />
      </div>

      <div className="map-area">
        {viewMode === 'CITY' && selectedLocation ? (
          <CityMap 
            cityName={selectedLocation.name} 
            cityType={selectedLocation.type}
            seed={worldData?.seed ? worldData.seed + selectedLocation.name.length : 0}
            onBack={() => setViewMode('WORLD')}
          />
        ) : (
          <>
            <div className="map-overlay-controls">
              <button 
                 className="action-btn" 
                 style={{ 
                   backgroundColor: warMode ? '#c0392b' : 'rgba(0,0,0,0.6)', 
                   color: '#fff',
                   borderColor: warMode ? '#e74c3c' : '#636e72'
                 }}
                 onClick={() => setWarMode(!warMode)}
               >
                 {warMode ? '⚔️ WAR' : '🕊️ PEACE'}
               </button>

               <button 
                 className="action-btn" 
                 style={{ 
                   backgroundColor: worldState.date.season === 'WINTER' ? '#74b9ff' : 
                                    worldState.date.season === 'AUTUMN' ? '#e67e22' : 
                                    worldState.date.season === 'SUMMER' ? '#fab1a0' : '#2ecc71', 
                   color: worldState.date.season === 'WINTER' || worldState.date.season === 'AUTUMN' ? '#fff' : '#2d3436',
                   borderColor: worldState.date.season === 'WINTER' ? '#0984e3' : 
                                worldState.date.season === 'AUTUMN' ? '#d35400' : '#e17055'
                 }}
                 onClick={simulationActions.advanceSeason}
               >
                 {worldState.date.season === 'WINTER' ? '❄️ WINTER' : 
                  worldState.date.season === 'SUMMER' ? '☀️ SUMMER' : 
                  worldState.date.season === 'AUTUMN' ? '🍂 AUTUMN' : '🌱 SPRING'}
               </button>

               <button 
                 className="action-btn" 
                 style={{ 
                   backgroundColor: worldLore ? '#8e44ad' : 'rgba(0,0,0,0.6)', 
                   color: '#fff', 
                   borderColor: worldLore ? '#9b59b6' : '#636e72',
                   opacity: isGeneratingLore ? 0.6 : 1
                 }}
                 onClick={worldLore ? () => setIsLorePanelOpen(true) : handleGenerateLore}
                 disabled={isGeneratingLore}
               >
                 {isGeneratingLore ? '⏳ Generating...' : worldLore ? '📜 View Lore' : '📜 Generate Lore'}
               </button>
               
               {/* Character Button - only available after lore is generated */}
               {worldLore && !selectedCharacter && (
                 <button
                   style={{
                     padding: '8px 16px',
                     backgroundColor: playableCharacters.length > 0 ? 'rgba(78, 205, 196, 0.2)' : 'rgba(78, 205, 196, 0.3)',
                     border: '1px solid #4ecdc4',
                     borderRadius: '6px',
                     color: '#4ecdc4',
                     cursor: isGeneratingCharacters ? 'wait' : 'pointer',
                     fontSize: '14px',
                     opacity: isGeneratingCharacters ? 0.6 : 1
                   }}
                   onClick={playableCharacters.length > 0 ? () => setIsCharacterPanelOpen(true) : handleGenerateCharacters}
                   disabled={isGeneratingCharacters}
                 >
                   {isGeneratingCharacters ? '⏳ Создание...' : playableCharacters.length > 0 ? '🎭 Выбрать персонажа' : '🎭 Создать персонажей'}
                 </button>
               )}

               {/* Selected Character Display */}
               {selectedCharacter && (
                 <button
                   style={{
                     padding: '8px 16px',
                     backgroundColor: 'rgba(78, 205, 196, 0.3)',
                     border: '1px solid #4ecdc4',
                     borderRadius: '6px',
                     color: '#4ecdc4',
                     cursor: 'pointer',
                     fontSize: '14px'
                   }}
                   onClick={() => setIsCharacterPanelOpen(true)}
                 >
                   🎭 {selectedCharacter.name}
                 </button>
               )}

               {/* Scenario Button - only available after character is selected */}
               {selectedCharacter && (
                 <button
                   style={{
                     padding: '8px 16px',
                     backgroundColor: worldScenario ? 'rgba(230, 184, 0, 0.2)' : 'rgba(230, 184, 0, 0.3)',
                     border: '1px solid #e6b800',
                     borderRadius: '6px',
                     color: '#e6b800',
                     cursor: isGeneratingScenario ? 'wait' : 'pointer',
                     fontSize: '14px',
                     opacity: isGeneratingScenario ? 0.6 : 1
                   }}
                   onClick={() => setIsScenarioPanelOpen(true)}
                   disabled={isGeneratingScenario || !worldScenario}
                 >
                   {isGeneratingScenario ? '⏳ Narrator...' : worldScenario ? '📖 Сценарий' : '⏳ Генерация...'}
                 </button>
               )}
            </div>
            
            {hoveredKingdom && !selectedLocation && !warMode && (
               <div style={{
                 position: 'absolute', top: 20, left: 20,
                 backgroundColor: 'rgba(13, 27, 42, 0.9)', padding: '1rem',
                 borderRadius: '8px', border: `2px solid ${hoveredKingdom.color}`,
                 pointerEvents: 'none', zIndex: 5
               }}>
                 <h3 style={{ margin: 0, color: hoveredKingdom.color }}>{hoveredKingdom.name}</h3>
                 <div style={{ fontSize: '0.8rem', color: '#8fa3b0' }}>
                   {hoveredKingdom.geography.dominantBiome} | {hoveredKingdom.geography.climateZone}
                 </div>
                 {/* Show dynamic stats on hover */}
                 <div style={{ fontSize: '0.8rem', color: '#ccc', marginTop: '0.5rem' }}>
                    Strength: {worldState.kingdoms[hoveredKingdom.id]?.military.strength ?? '?'} <br/>
                    Gold: {worldState.kingdoms[hoveredKingdom.id]?.resources.gold ?? '?'}
                 </div>
               </div>
            )}

            <WorldMap 
              worldData={worldData}
              selectedPOI={selectedLocation}
              onLocationSelect={handleLocationSelect}
              onKingdomHover={setHoveredKingdom}
              warMode={warMode}
              season={worldState.date.season}
              onWarAction={handleWarAction}
              activeConflicts={worldState.activeConflicts}
              startingLocation={startingLocation}
              playerLocation={isGameStarted ? currentPlayerLocation : null}
              showTravelPaths={shouldShowTravelPaths}
              travelPaths={travelPaths}
              onTravelSelect={handleTravelSelect}
              travelQuestTarget={questTargetLocation}
            />
            
            {/* START BUTTON - compact, elegant design */}
            {worldScenario && !isGameStarted && startingLocation && (() => {
              const isCorrectCity = selectedLocation?.id === startingLocation.id;
              const canStart = isCorrectCity && !isGeneratingScene;
              
              return (
                <div style={{
                  position: 'absolute',
                  bottom: 24,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {/* Hint when wrong city */}
                  {!isCorrectCity && (
                    <div style={{
                      backgroundColor: 'rgba(10, 10, 15, 0.9)',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: '1px solid #30363d',
                      fontSize: '12px',
                      color: '#7d8590',
                      backdropFilter: 'blur(4px)'
                    }}>
                      📍 Выберите <span style={{ color: '#4ecdc4' }}>{startingLocation.name}</span> на карте
                    </div>
                  )}
                  
                  {/* Main button */}
                  <button
                    onClick={canStart ? handleStartGame : undefined}
                    disabled={!canStart}
                    style={{
                      padding: canStart ? '12px 32px' : '10px 24px',
                      fontSize: canStart ? '15px' : '13px',
                      fontWeight: 600,
                      backgroundColor: canStart 
                        ? (isGeneratingScene ? 'rgba(35, 134, 54, 0.5)' : '#238636')
                        : 'rgba(10, 10, 15, 0.8)',
                      color: canStart ? '#fff' : '#484f58',
                      border: canStart ? 'none' : '1px solid #30363d',
                      borderRadius: '8px',
                      cursor: !canStart ? 'default' : isGeneratingScene ? 'wait' : 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backdropFilter: 'blur(4px)'
                    }}
                  >
                    {isGeneratingScene ? (
                      <>
                        <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                        Генерация...
                      </>
                    ) : canStart ? (
                      <>
                        <span>▶</span>
                        Начать историю
                      </>
                    ) : (
                      <>
                        {selectedCharacter?.name || 'Персонаж не выбран'}
                      </>
                    )}
                  </button>
                </div>
              );
            })()}
            
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>

            {/* PLAYER STATS BAR - visible during game */}
            {isGameStarted && selectedCharacter && playerState && (
              <PlayerStatsBar
                playerState={playerState}
                characterName={selectedCharacter.name}
                currentLocation={currentPlayerLocation?.name || startingLocation?.name}
                lastEffects={lastAppliedEffects}
              />
            )}
            
            {/* TRAVEL QUEST PANEL - shows when there's an active travel quest */}
            {isGameStarted && travelState && travelState.travelQuest && !currentScene && (
              <div style={{
                position: 'absolute',
                top: 80,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 50,
                backgroundColor: 'rgba(10, 10, 15, 0.95)',
                border: '2px solid #f1c40f',
                borderRadius: '12px',
                padding: '16px 24px',
                maxWidth: '400px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  marginBottom: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>⭐</span>
                  <span style={{ 
                    color: '#f1c40f', 
                    fontSize: '14px', 
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Квест: Путешествие
                  </span>
                </div>
                <div style={{ 
                  color: '#e0e0e0', 
                  fontSize: '15px', 
                  lineHeight: 1.5,
                  marginBottom: '12px'
                }}>
                  {travelState.travelQuest.reason}
                </div>
                <div style={{ 
                  color: '#4ecdc4', 
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>📍</span>
                  Нажмите на <strong>{questTargetLocation?.name || 'город назначения'}</strong> на карте
                </div>
              </div>
            )}
            
            {/* TRAVEL CONFIRMATION - shows when destination is selected */}
            {isGameStarted && travelState && selectedTravelDestination && selectedRoute && !currentScene && (
              <div style={{
                position: 'absolute',
                bottom: 100,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 50,
                backgroundColor: 'rgba(10, 10, 15, 0.95)',
                border: '2px solid #4ecdc4',
                borderRadius: '12px',
                padding: '20px 28px',
                minWidth: '320px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
              }}>
                {/* Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px'
                }}>
                  <div style={{ 
                    color: '#4ecdc4', 
                    fontSize: '18px', 
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>🚶</span> {selectedRoute.targetName}
                  </div>
                  <button
                    onClick={() => setSelectedTravelDestination(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#666',
                      cursor: 'pointer',
                      fontSize: '20px',
                      padding: '4px'
                    }}
                  >
                    ×
                  </button>
                </div>
                
                {/* Route info */}
                <div style={{ 
                  display: 'flex', 
                  gap: '20px',
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>Путь</div>
                    <div style={{ color: '#fff', fontSize: '16px', fontWeight: 500 }}>
                      {selectedRoute.distance} {selectedRoute.distance === 1 ? 'день' : 'дн.'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>Стоимость</div>
                    <div style={{ 
                      color: playerState.stats.gold >= selectedRoute.cost ? '#f1c40f' : '#e74c3c', 
                      fontSize: '16px', 
                      fontWeight: 500 
                    }}>
                      {selectedRoute.cost} 💰
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>Опасность</div>
                    <div style={{ 
                      color: selectedRoute.danger === 'safe' ? '#4ecdc4' : 
                             selectedRoute.danger === 'risky' ? '#f39c12' : '#e74c3c',
                      fontSize: '16px', 
                      fontWeight: 500 
                    }}>
                      {selectedRoute.danger === 'safe' ? '🛡️ Безопасно' : 
                       selectedRoute.danger === 'risky' ? '⚠️ Рискованно' : '💀 Опасно'}
                    </div>
                  </div>
                </div>
                
                {/* Action button */}
                <button
                  onClick={handleStartTravel}
                  disabled={playerState.stats.gold < selectedRoute.cost || isGeneratingScene}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    backgroundColor: playerState.stats.gold >= selectedRoute.cost 
                      ? '#238636' 
                      : 'rgba(231, 76, 60, 0.3)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    cursor: playerState.stats.gold >= selectedRoute.cost ? 'pointer' : 'not-allowed',
                    fontSize: '16px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    transition: 'all 0.2s ease',
                    opacity: isGeneratingScene ? 0.5 : 1
                  }}
                >
                  {isGeneratingScene ? (
                    <>⏳ Отправляемся...</>
                  ) : playerState.stats.gold < selectedRoute.cost ? (
                    <>❌ Недостаточно золота</>
                  ) : (
                    <>🚶 Отправиться в путь</>
                  )}
                </button>
                
                {/* Gold warning */}
                {playerState.stats.gold < selectedRoute.cost && (
                  <div style={{ 
                    color: '#e74c3c', 
                    fontSize: '12px', 
                    textAlign: 'center',
                    marginTop: '8px'
                  }}>
                    Нужно: {selectedRoute.cost} 💰 | У вас: {playerState.stats.gold} 💰
                  </div>
                )}
              </div>
            )}

            {/* SCENE VIEW - modal window over the map */}
            {isGameStarted && currentScene && selectedCharacter && (
              <SceneView
                scene={currentScene}
                characterName={selectedCharacter.name}
                onChoice={handleSceneChoice}
                isLoading={isGeneratingScene}
                playerState={playerState}
                lastEffects={lastAppliedEffects}
              />
            )}
          </>
        )}
      </div>

      <div className="side-panel">
        <LocationCard 
          location={selectedLocation} 
          kingdom={selectedKingdom} 
          kingdomLore={selectedKingdom ? worldLore?.kingdoms.find(k => k.id === selectedKingdom.id) : undefined}
          isStartingLocation={selectedLocation?.id === startingLocation?.id}
          canEnter={isGameStarted && selectedLocation?.id === startingLocation?.id}
          onEnterCity={handleEnterCity}
        />
        {selectedLocation && (
            <div style={{ padding: '1rem', fontSize: '0.8rem', color: '#888' }}>
                Status: {worldState.locations[selectedLocation.id]?.condition} <br/>
                Defense: {worldState.locations[selectedLocation.id]?.defense}
            </div>
        )}
      </div>

      <StatusBar 
        year={worldState.date.year} 
        gold={currentKingdomState?.resources.gold ?? 0} 
        mana={currentKingdomState?.resources.mana ?? 0} 
      />
    </div>
  );
};

export default GameInterface;
