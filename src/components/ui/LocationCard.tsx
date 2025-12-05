import React from 'react';
import type { POI, Kingdom } from '../../types/world';

interface LocationCardProps {
  location: POI | null;
  kingdom: Kingdom | null;
  onAction: (action: string) => void;
}

const LocationCard: React.FC<LocationCardProps> = ({ location, kingdom, onAction }) => {
  if (!location || !kingdom) {
    return (
      <div className="panel-empty-state">
        <h3>Select a Location</h3>
        <p>Click on a city or capital on the map to view details.</p>
      </div>
    );
  }

  // Mock image based on biome or type
  const getMockImage = () => {
    if (location.type === 'capital') return 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?q=80&w=600&auto=format&fit=crop'; // Castle
    return 'https://images.unsplash.com/photo-1533154683836-6b72027c5519?q=80&w=600&auto=format&fit=crop'; // Village/Town
  };

  return (
    <div className="location-card">
      <div className="location-header" style={{ borderBottom: `2px solid ${kingdom.color}` }}>
        <h2>{location.name}</h2>
        <span className="location-type">{location.type.toUpperCase()}</span>
      </div>
      
      <div className="location-image-container">
        <img src={getMockImage()} alt={location.name} className="location-image" />
        <div className="location-badge" style={{ backgroundColor: kingdom.color }}>
          {kingdom.name}
        </div>
      </div>

      <div className="location-content">
        <p className="location-desc">
          {location.description || `A bustling ${location.type} situated in the ${kingdom.geography.dominantBiome.toLowerCase()} lands of ${kingdom.name}. Known for its trade and ancient history.`}
        </p>

        <div className="location-stats">
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
            <span>{kingdom.geography.dominantBiome}</span>
          </div>
        </div>

        <div className="location-actions">
          <button className="action-btn primary" onClick={() => onAction('explore')}>
            🧭 Explore
          </button>
          <button className="action-btn" onClick={() => onAction('talk')}>
            💬 Speak to Locals
          </button>
          <button className="action-btn danger" onClick={() => onAction('attack')}>
            ⚔️ Raid
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationCard;

