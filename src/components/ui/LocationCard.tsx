import React from 'react';
import type { POI, Kingdom, ClimateZone } from '../../types/world';
import { getLocationImage, hasLocationImage } from '../../utils/locationImages';
import type { KingdomLore, CityLore } from '../../services/llmService';

interface LocationCardProps {
  location: POI | null;
  kingdom: Kingdom | null;
  kingdomLore?: KingdomLore;
  isStartingLocation?: boolean;  // Показывает что это стартовая точка игрока
  canEnter?: boolean; // Может ли игрок войти в этот город (только текущая локация)
  onEnterCity?: () => void; // Callback to enter city view
}

const LocationCard: React.FC<LocationCardProps> = ({ location, kingdom, kingdomLore, isStartingLocation, canEnter, onEnterCity }) => {
  // Find city-specific lore
  const getCityLore = (): CityLore | undefined => {
    if (!kingdomLore || !location) return undefined;
    
    if (location.type === 'capital') {
      return kingdomLore.capital;
    }
    return kingdomLore.cities?.find(c => c.id === location.id || c.name === location.name);
  };
  
  const cityLore = getCityLore();
  if (!location || !kingdom) {
    return (
      <div className="panel-empty-state">
        <h3>Select a Location</h3>
        <p>Click on a city or capital on the map to view details.</p>
      </div>
    );
  }

  // Get climate: for capitals use kingdom's climate, for cities use geographic climate
  const climate: ClimateZone = location.type === 'capital' 
    ? kingdom.geography.climateZone  // Capital uses kingdom's cultural climate
    : (location.climate || kingdom.geography.climateZone); // Cities use geographic climate
  
  // Get actual image or fallback to placeholder
  // Now passing kingdom instead of climate for proper capital image lookup
  const getImage = (): string => {
    const actualImage = getLocationImage(location, kingdom);
    console.log(`LocationCard getImage for ${location.name} (${location.type}):`, actualImage ? 'found' : 'fallback');
    if (actualImage) return actualImage;
    
    // Fallback placeholders
    if (location.type === 'capital') {
      return 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?q=80&w=600&auto=format&fit=crop';
    }
    return 'https://images.unsplash.com/photo-1533154683836-6b72027c5519?q=80&w=600&auto=format&fit=crop';
  };

  const hasCustomImage = hasLocationImage(location, kingdom);
  const imageSrc = getImage();

  // Climate-based flavor text
  const getClimateDescription = (): string => {
    switch (climate) {
      case 'NORTH':
        return 'harsh frozen lands';
      case 'SOUTH':
        return 'sun-scorched territories';
      default:
        return 'temperate heartlands';
    }
  };

  return (
    <div className="location-card">
      <div className="location-header" style={{ borderBottom: `2px solid ${kingdom.color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>{location.name}</h2>
          {isStartingLocation && (
            <span style={{ 
              fontSize: '9px', 
              padding: '2px 6px', 
              borderRadius: '3px',
              backgroundColor: '#238636',
              color: '#fff',
              fontWeight: 500
            }}>
              ▶ СТАРТ
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
          <span className="location-type">{location.type.toUpperCase()}</span>
          <span style={{ 
            fontSize: '10px', 
            padding: '2px 6px', 
            borderRadius: '4px',
            backgroundColor: climate === 'NORTH' ? '#74b9ff' : climate === 'SOUTH' ? '#fdcb6e' : '#81ecec',
            color: '#2d3436'
          }}>
            {climate}
          </span>
        </div>
      </div>
      
      <div className="location-image-container">
        <img 
          src={imageSrc} 
          alt={location.name} 
          className="location-image" 
          style={{
            filter: hasCustomImage ? 'none' : 'sepia(0.3) brightness(0.9)',
            objectFit: 'cover',
            width: '100%',
            height: '100%'
          }}
          onError={(e) => {
            console.error(`Failed to load image for ${location.name}:`, imageSrc);
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1533154683836-6b72027c5519?q=80&w=600&auto=format&fit=crop';
          }}
        />
        <div className="location-badge" style={{ backgroundColor: kingdom.color }}>
          {kingdom.name}
        </div>
        {!hasCustomImage && (
          <div style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            fontSize: '9px',
            color: '#fff',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            Placeholder
          </div>
        )}
      </div>

      <div className="location-content">
        {/* City-specific description from lore */}
        <p className="location-desc">
          {cityLore?.description || 
            location.description || 
            `A ${location.type === 'capital' ? 'grand capital' : 'bustling settlement'} in the ${getClimateDescription()} of ${kingdom.name}. ` +
            `Known for its ${location.biome.toLowerCase()} surroundings and ancient heritage.`
          }
        </p>
        
        {/* City specialty & landmark */}
        {cityLore && (
          <div style={{ marginTop: '12px', fontSize: '14px', lineHeight: 1.6 }}>
            {cityLore.specialty && (
              <div style={{ color: '#c9ada7', marginBottom: '6px' }}>
                <strong>Известен:</strong> {cityLore.specialty}
              </div>
            )}
            {cityLore.landmark && (
              <div style={{ color: '#b0b0b0', fontStyle: 'italic' }}>
                "{cityLore.landmark}"
              </div>
            )}
          </div>
        )}
        
        {/* City mood badge */}
        {cityLore?.mood && (
          <div style={{ 
            marginTop: '10px', 
            display: 'inline-block',
            padding: '5px 12px', 
            backgroundColor: 'rgba(201, 173, 167, 0.15)',
            borderRadius: '12px',
            fontSize: '12px',
            color: '#c9ada7',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            {cityLore.mood}
          </div>
        )}

        {/* Kingdom motto (show only for capitals) */}
        {location.type === 'capital' && kingdomLore?.motto && (
          <div style={{ 
            marginTop: '14px', 
            padding: '10px 14px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderLeft: `3px solid ${kingdom.color}`,
            fontStyle: 'italic',
            color: '#c9ada7',
            fontSize: '15px',
            lineHeight: 1.5
          }}>
            "{kingdomLore.motto}"
          </div>
        )}
        
        {/* Kingdom culture (show for capitals) */}
        {location.type === 'capital' && kingdomLore?.culture && (
          <p style={{ fontSize: '14px', color: '#b0b0b0', marginTop: '12px', lineHeight: 1.6 }}>
            {kingdomLore.culture}
          </p>
        )}
        
        {/* Religion (show for capitals) */}
        {location.type === 'capital' && kingdomLore?.religion && (
          <div style={{ fontSize: '14px', color: '#a0a0a0', marginTop: '8px' }}>
            <span style={{ color: '#b794f6' }}>✦</span> {kingdomLore.religion}
          </div>
        )}
        
        {/* Ruler info (show for capitals) */}
        {location.type === 'capital' && kingdomLore?.initialState && (
          <div className="ruler-info" style={{ 
            marginTop: '14px', 
            padding: '12px', 
            backgroundColor: 'rgba(255,255,255,0.05)', 
            borderRadius: '8px',
            borderLeft: `3px solid ${kingdom.color}`
          }}>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {kingdomLore.initialState.rulerTitle || 'Правитель'}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#e0e0e0' }}>{kingdomLore.initialState.rulerName}</div>
            <div style={{ 
              fontSize: '12px', 
              marginTop: '6px',
              padding: '4px 10px',
              display: 'inline-block',
              backgroundColor: 
                kingdomLore.initialState.rulerPersonality === 'Aggressive' ? 'rgba(231, 76, 60, 0.3)' :
                kingdomLore.initialState.rulerPersonality === 'Defensive' ? 'rgba(52, 152, 219, 0.3)' :
                kingdomLore.initialState.rulerPersonality === 'Diplomatic' ? 'rgba(46, 204, 113, 0.3)' :
                kingdomLore.initialState.rulerPersonality === 'Expansionist' ? 'rgba(155, 89, 182, 0.3)' :
                'rgba(149, 165, 166, 0.3)',
              borderRadius: '4px',
              color: '#e0e0e0'
            }}>
              {kingdomLore.initialState.rulerPersonality}
            </div>
          </div>
        )}
        
        {/* Traits (show for all locations) */}
        {kingdomLore?.traits && kingdomLore.traits.length > 0 && (
          <div className="kingdom-traits" style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {kingdomLore.traits.map((trait, i) => (
              <span key={i} style={{
                fontSize: '12px',
                padding: '4px 10px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#d0d0d0'
              }}>
                {trait}
              </span>
            ))}
          </div>
        )}

        <div className="location-stats" style={{ marginTop: '12px' }}>
          <div className="stat-row">
            <span>Population</span>
            <span>{location.type === 'capital' ? '25,000+' : '2,000+'}</span>
          </div>
          <div className="stat-row">
            <span>Defense</span>
            <span>{location.type === 'capital' ? 'High' : 'Medium'}</span>
          </div>
          <div className="stat-row">
            <span>Biome</span>
            <span>{location.biome}</span>
          </div>
          <div className="stat-row">
            <span>Climate</span>
            <span>{climate}</span>
          </div>
        </div>

        {/* Enter City Button */}
        {onEnterCity && (
          <button 
            onClick={canEnter ? onEnterCity : undefined}
            disabled={!canEnter}
            style={{
              width: '100%',
              marginTop: '16px',
              padding: '10px 16px',
              backgroundColor: canEnter ? '#238636' : '#21262d',
              border: canEnter ? 'none' : '1px solid #30363d',
              borderRadius: '6px',
              color: canEnter ? '#fff' : '#7d8590',
              cursor: canEnter ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (canEnter) e.currentTarget.style.backgroundColor = '#2ea043';
            }}
            onMouseLeave={(e) => {
              if (canEnter) e.currentTarget.style.backgroundColor = '#238636';
            }}
          >
            🏛️ {canEnter ? 'Исследовать город' : 'Начните игру'}
          </button>
        )}

      </div>
    </div>
  );
};

export default LocationCard;
