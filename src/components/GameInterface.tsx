import React, { useState } from 'react';
import WorldMap from './WorldMap';
import LocationCard from './ui/LocationCard';
import StoryLog, { type LogEntry } from './ui/StoryLog';
import StatusBar from './ui/StatusBar';
import './ui/GameUI.css';
import type { POI, Kingdom } from '../types/world';
import { narrator, type NarrativeResponse } from '../services/narrator';

// Modal Component for Major Events
const EventModal: React.FC<{ 
  isOpen: boolean; 
  content: NarrativeResponse | null; 
  onChoice: (action: string) => void; 
}> = ({ isOpen, content, onChoice }) => {
  if (!isOpen || !content) return null;

  return (
    <div className="event-modal-overlay">
      <div className="event-modal">
        <div className="event-modal-header">
          <h2>Event</h2>
        </div>
        <div className="event-modal-content">
          {/* Parse bold text simply */}
          {content.text.split(/(\*\*.*?\*\*)/g).map((part, i) => 
            part.startsWith('**') && part.endsWith('**') 
              ? <strong key={i} style={{ color: '#c9ada7' }}>{part.slice(2, -2)}</strong> 
              : part
          )}
        </div>
        {content.choices && (
          <div className="event-modal-choices">
            {content.choices.map((choice, idx) => (
              <button 
                key={idx} 
                className="choice-btn"
                onClick={() => onChoice(choice.action)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        )}
        {!content.choices && (
           <div className="event-modal-choices">
             <button className="choice-btn" onClick={() => onChoice('close')}>Continue</button>
           </div>
        )}
      </div>
    </div>
  );
};

const GameInterface: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<POI | null>(null);
  const [selectedKingdom, setSelectedKingdom] = useState<Kingdom | null>(null);
  const [hoveredKingdom, setHoveredKingdom] = useState<Kingdom | null>(null);
  
  const [warMode, setWarMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [season, setSeason] = useState<'SUMMER' | 'WINTER'>('SUMMER');
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<NarrativeResponse | null>(null);
  
  const [year] = useState(452);
  const [gold, setGold] = useState(150);
  const [mana, setMana] = useState(50);
  
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, type: 'system', text: 'Welcome, Traveler. The world of **Ethereal** awaits.', timestamp: 'Year 452' }
  ]);

  const addLog = (type: LogEntry['type'], text: string) => {
    setLogs(prev => [...prev, {
      id: Date.now(),
      type,
      text,
      timestamp: `Year ${year}`
    }]);
  };

  // --- Interaction with Narrator Service ---
  const triggerNarrative = async (action: string) => {
    setIsGenerating(true);
    
    // 1. Add initial log indicating action
    if (action !== 'close') {
        addLog('system', `Attempting to ${action}...`);
    }

    // 2. Call AI (Mock for now)
    try {
      const response = await narrator.generateStory(action, {
        location: selectedLocation,
        kingdom: selectedKingdom,
        year,
        recentHistory: []
      });

      setIsGenerating(false);

      // 3. Handle Response
      if (response.effects) {
        if (response.effects.gold) setGold(g => g + response.effects!.gold!);
        if (response.effects.mana) setMana(m => m + response.effects!.mana!);
      }

      // If there are choices, show modal. If just text, show in log.
      if (response.choices && response.choices.length > 0) {
        setCurrentEvent(response);
        setModalOpen(true);
      } else {
        // Just a log update
        setModalOpen(false); // Close if open
        addLog('narrative', response.text);
      }

    } catch (error) {
      console.error(error);
      setIsGenerating(false);
    }
  };

  const handleLocationSelect = (location: POI | null, kingdom: Kingdom | null) => {
    setSelectedLocation(location);
    setSelectedKingdom(kingdom);
  };

  const handleAction = (action: string) => {
    if (!selectedLocation) return;
    triggerNarrative(action);
  };

  const handleModalChoice = (action: string) => {
    if (action === 'close') {
      setModalOpen(false);
      setCurrentEvent(null);
    } else {
      // Continue the story with the chosen action
      triggerNarrative(action);
    }
  };

  return (
    <div className="game-interface">
      {/* Event Modal */}
      <EventModal 
        isOpen={modalOpen} 
        content={currentEvent} 
        onChoice={handleModalChoice} 
      />

      {/* Left Panel */}
      <div className="side-panel story-log-container">
        <StoryLog logs={logs} />
      </div>

      {/* Center: Map */}
      <div className="map-area">
        <div className="map-overlay-controls">
           <button 
             className="action-btn" 
             style={{ 
               backgroundColor: warMode ? '#c0392b' : 'rgba(0,0,0,0.6)', 
               color: '#fff',
               borderColor: warMode ? '#e74c3c' : '#636e72',
               fontSize: '0.8rem',
               padding: '0.5rem 1rem'
             }}
             onClick={() => setWarMode(!warMode)}
           >
             {warMode ? '⚔️ WAR' : '🕊️ PEACE'}
           </button>

           <button 
             className="action-btn" 
             style={{ 
               backgroundColor: season === 'WINTER' ? '#74b9ff' : '#fab1a0', 
               color: season === 'WINTER' ? '#fff' : '#2d3436',
               borderColor: season === 'WINTER' ? '#0984e3' : '#e17055',
               fontSize: '0.8rem',
               padding: '0.5rem 1rem'
             }}
             onClick={() => setSeason(season === 'SUMMER' ? 'WINTER' : 'SUMMER')}
           >
             {season === 'WINTER' ? '❄️ WINTER' : '☀️ SUMMER'}
           </button>
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
               {hoveredKingdom.geography.dominantBiome}
             </div>
           </div>
        )}

        <WorldMap 
          selectedPOI={selectedLocation}
          onLocationSelect={handleLocationSelect}
          onKingdomHover={setHoveredKingdom}
          warMode={warMode}
          season={season}
          onWarAction={(action) => {
             addLog('combat', `Conquest reported in sector ${action.cellId}.`);
          }}
        />
      </div>

      {/* Right Panel */}
      <div className="side-panel">
        <LocationCard 
          location={selectedLocation} 
          kingdom={selectedKingdom} 
          onAction={handleAction} 
        />
      </div>

      {/* Bottom */}
      <StatusBar year={year} gold={gold} mana={mana} />
      
      {/* Loading Indicator */}
      {isGenerating && (
        <div style={{
          position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)', padding: '0.5rem 1.5rem', borderRadius: '20px',
          color: '#c9ada7', border: '1px solid #c9ada7', zIndex: 50
        }}>
          Writing destiny...
        </div>
      )}
    </div>
  );
};

export default GameInterface;
