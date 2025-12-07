import React, { useMemo, useState } from 'react';
import { generateCityLayout, type CityLayout, type DistrictType, type CityDistrict } from '../utils/cityGenerator';

interface CityMapProps {
  cityName: string;
  cityType: string; // 'capital' | 'city' | 'fortress' | 'ruin'
  seed: number;
  onBack: () => void;
}

const CityMap: React.FC<CityMapProps> = ({ cityName, cityType, seed, onBack }) => {
  const layout = useMemo(() => {
    return generateCityLayout(seed, cityName, cityType);
  }, [seed, cityName, cityType]);

  const [hoveredDistrict, setHoveredDistrict] = useState<CityDistrict | null>(null);

  const getPath = (points: [number, number][]) => {
    return points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
      .join(' ') + 'Z';
  };

  // Маппинг типов на цвета и паттерны
  const getDistrictStyle = (type: DistrictType) => {
    switch(type) {
      case 'CASTLE': case 'KEEP': return { fill: '#f1c40f', stroke: '#f39c12', pattern: null };
      case 'NOBLE': return { fill: '#9b59b6', stroke: '#8e44ad', pattern: 'pattern-cross' };
      case 'TEMPLE': return { fill: '#8e44ad', stroke: '#9b59b6', pattern: 'pattern-temple' }; 
      case 'MARKET': case 'PLAZA': return { fill: '#e67e22', stroke: '#d35400', pattern: 'pattern-dots' };
      case 'CRAFTSMAN': return { fill: '#3498db', stroke: '#2980b9', pattern: 'pattern-grid' };
      case 'MILITARY': return { fill: '#c0392b', stroke: '#e74c3c', pattern: 'pattern-lines' };
      case 'SLUMS': return { fill: '#5d4037', stroke: '#4e342e', pattern: 'pattern-noise' }; 
      case 'COTTAGES': return { fill: '#795548', stroke: '#5d4037', pattern: 'pattern-grid' };
      case 'FARM': case 'FIELDS': return { fill: '#27ae60', stroke: '#2ecc71', pattern: 'pattern-fields' };
      case 'RUINS': return { fill: '#7f8c8d', stroke: '#95a5a6', pattern: 'pattern-noise' };
      default: return { fill: '#95a5a6', stroke: '#7f8c8d', pattern: null };
    }
  };

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      backgroundColor: '#0b0c10', 
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      {/* UI Overlay */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
        <button onClick={onBack} style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#c5c6c7',
            border: '1px solid #45a29e',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}>
          ← На карту мира
        </button>
      </div>

      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, textAlign: 'right' }}>
        <h1 style={{ color: '#66fcf1', margin: 0, fontSize: '24px', textTransform: 'uppercase', letterSpacing: '2px', textShadow: '0 0 10px rgba(102, 252, 241, 0.5)' }}>
          {cityName}
        </h1>
        <div style={{ color: '#45a29e', fontSize: '12px', textTransform: 'uppercase' }}>
          {layout.type} TYPE
        </div>
      </div>

      {/* Tooltip */}
      {hoveredDistrict && (
        <div style={{
          position: 'absolute',
          bottom: 30,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(11, 12, 16, 0.9)',
          border: `1px solid ${hoveredDistrict.color}`,
          padding: '12px 20px',
          borderRadius: '8px',
          zIndex: 20,
          pointerEvents: 'none',
          boxShadow: `0 0 20px ${hoveredDistrict.color}40`
        }}>
          <div style={{ color: hoveredDistrict.color, fontWeight: 'bold', marginBottom: '4px', fontSize: '16px' }}>
            {hoveredDistrict.name}
          </div>
          <div style={{ color: '#888', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {hoveredDistrict.type}
          </div>
        </div>
      )}

      {/* SVG Map */}
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} style={{ width: '90%', height: '90%', maxWidth: '80vh', maxHeight: '80vh', filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))' }}>
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          
          {/* --- PATTERNS --- */}
          <pattern id="pattern-fields" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="20" stroke="#2ecc71" strokeWidth="2" opacity="0.3" />
          </pattern>
          
          <pattern id="pattern-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="8" height="8" fill="currentColor" fillOpacity="0.2" />
          </pattern>

          <pattern id="pattern-cross" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect x="2" y="2" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
            <line x1="2" y1="2" x2="18" y2="18" stroke="currentColor" strokeWidth="1" opacity="0.4" />
            <line x1="18" y1="2" x2="2" y2="18" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          </pattern>

          <pattern id="pattern-dots" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="4" r="1.5" fill="currentColor" fillOpacity="0.4" />
          </pattern>

          <pattern id="pattern-lines" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
            <line x1="0" y1="0" x2="10" y2="0" stroke="currentColor" strokeWidth="4" opacity="0.3" />
          </pattern>

          <pattern id="pattern-noise" width="10" height="10" patternUnits="userSpaceOnUse">
             <rect x="1" y="1" width="2" height="2" fill="currentColor" opacity="0.5"/>
             <rect x="5" y="4" width="2" height="2" fill="currentColor" opacity="0.5"/>
             <rect x="8" y="2" width="1" height="1" fill="currentColor" opacity="0.5"/>
             <rect x="2" y="7" width="2" height="2" fill="currentColor" opacity="0.5"/>
          </pattern>
        </defs>

        {/* Districts */}
        {layout.districts.map(district => {
          const style = getDistrictStyle(district.type);
          const isHovered = hoveredDistrict?.id === district.id;
          
          return (
            <g key={district.id} 
               style={{ cursor: 'pointer', color: style.fill }} 
               onMouseEnter={() => setHoveredDistrict(district)}
               onMouseLeave={() => setHoveredDistrict(null)}
            >
              {/* Base Fill */}
              <path
                d={getPath(district.polygon)}
                fill={style.fill}
                fillOpacity={isHovered ? 0.4 : 0.15}
                stroke="none"
              />
              
              {/* Pattern Overlay */}
              {style.pattern && (
                <path
                  d={getPath(district.polygon)}
                  fill={`url(#${style.pattern})`}
                  stroke="none"
                  style={{ pointerEvents: 'none' }} 
                />
              )}

              {/* Outline */}
              <path
                d={getPath(district.polygon)}
                fill="none"
                stroke={style.stroke}
                strokeWidth={isHovered ? 3 : 1.5}
                style={{ transition: 'all 0.2s ease' }}
              />
            </g>
          );
        })}

        {/* Walls */}
        {layout.walls.length > 0 && (
          <path
            d={getPath(layout.walls)}
            fill="none"
            stroke="#fff"
            strokeWidth="4"
            strokeOpacity="0.6"
            strokeLinejoin="round"
            filter="url(#glow)"
          />
        )}

        {/* Center Marker */}
        <circle cx={layout.width / 2} cy={layout.height / 2} r={6} fill="#fff" filter="url(#glow)" />
      </svg>
    </div>
  );
};

export default CityMap;
