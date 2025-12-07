import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { computeKingdomPath } from '../utils/worldGenerator';
import { type WorldData, type POI, type Kingdom } from '../types/world';
import type { Season, ActiveConflict } from '../types/simulation';
import './ui/Effects.css';

const VIEWPORT_WIDTH = 1000;
const VIEWPORT_HEIGHT = 700;
const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 1100;
const OCEAN_BUFFER = 5000;
const OCEAN_COLOR = '#0d1b2a';

// Travel path visualization
export interface TravelPath {
  fromId: string;
  toId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  dashed: boolean;
  danger: 'safe' | 'risky' | 'dangerous';
  distance: number;
  cost: number;
  isLocked: boolean;
}

interface WorldMapProps {
  worldData: WorldData | null;
  onLocationSelect: (location: POI | null, kingdom: Kingdom | null) => void;
  onKingdomHover: (kingdom: Kingdom | null) => void;
  warMode: boolean;
  season: Season;
  onWarAction?: (action: { type: 'conquest', attackerId: number, defenderId: number, cellId: number, capturedCellIds: number[] }) => void;
  selectedPOI?: POI | null;
  activeConflicts?: ActiveConflict[]; // Contested cells to highlight
  startingLocation?: POI | null; // Player's starting location (before game starts)
  playerLocation?: POI | null; // Current player location (during game)
  // Travel system
  showTravelPaths?: boolean;          // Show travel routes from current location
  travelPaths?: TravelPath[];         // Available travel routes
  onTravelSelect?: (toLocationId: string) => void;  // Called when user clicks on a destination
  travelQuestTarget?: POI | null;     // Highlighted quest destination
}

const WorldMap: React.FC<WorldMapProps> = ({ 
  worldData, 
  onLocationSelect, 
  onKingdomHover, 
  warMode, 
  season, 
  onWarAction, 
  selectedPOI, 
  activeConflicts = [], 
  startingLocation, 
  playerLocation,
  showTravelPaths = false,
  travelPaths = [],
  onTravelSelect,
  travelQuestTarget
}) => {
  const [loading, setLoading] = useState(true);
  const [hoveredPOI, setHoveredPOI] = useState<POI | null>(null);
  const [hoveredKingdom, setHoveredKingdom] = useState<Kingdom | null>(null);
  const [attackerKingdomId, setAttackerKingdomId] = useState<number | null>(null);
  const [hoveredPath, setHoveredPath] = useState<TravelPath | null>(null);
  
  const [localKingdoms, setLocalKingdoms] = useState<Kingdom[]>([]);
  const [localCells, setLocalCells] = useState<any[]>([]);
  
  // War fog - recently captured cells with fade-out effect
  const [warFogCells, setWarFogCells] = useState<Map<number, { timestamp: number, attackerId: number }>>(new Map());

  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const centerX = WORLD_WIDTH / 2;
  const centerY = WORLD_HEIGHT / 2;

  useEffect(() => {
    if (worldData) {
      setLoading(false);
      setLocalKingdoms(worldData.kingdoms);
      setLocalCells(worldData.cells);
    }
  }, [worldData]);

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 6])
      .translateExtent([[-600, -500], [WORLD_WIDTH + 600, WORLD_HEIGHT + 500]])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomRef.current = zoom;
    svg.on('dblclick.zoom', null);

    return () => { svg.on('.zoom', null); };
  }, []);

  useEffect(() => {
    onKingdomHover(hoveredKingdom);
  }, [hoveredKingdom, onKingdomHover]);

  const allPOIs = localKingdoms.flatMap(k => {
      // Filter out capitals that have no associated territory (destroyed kingdoms)
      // Actually we just filter out capitals if the kingdom has 0 cells?
      // Or we rely on GameInterface to hide them?
      // Let's just render what we have.
      return [k.capital, ...k.cities];
  }) || [];

  const handlePOIClick = (poi: POI) => {
    if (!warMode) {
      const kingdom = localKingdoms.find(k => k.id === poi.kingdomId) || null;
      onLocationSelect(poi, kingdom);
      
      // If this is a valid travel target (quest target or in unlocked locations), trigger travel select
      if (onTravelSelect && travelQuestTarget?.id === poi.id) {
        onTravelSelect(poi.id);
      }
    }
  };

  const handleKingdomClick = (kingdom: Kingdom) => {
    if (!warMode) return;
    if (attackerKingdomId === null) {
      setAttackerKingdomId(kingdom.id);
    } else if (attackerKingdomId === kingdom.id) {
      setAttackerKingdomId(null);
    }
  };

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!warMode || attackerKingdomId === null || localCells.length === 0 || !gRef.current) {
        if (!warMode && !hoveredPOI) {
            onLocationSelect(null, null);
        }
        return;
    }

    const [x, y] = d3.pointer(e, gRef.current);
    let closestCellId = -1;
    let minDist = Infinity;

    for (const cell of localCells) {
      if (cell.isWater) continue;
      const dx = cell.center.x - x;
      const dy = cell.center.y - y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        closestCellId = cell.id;
      }
    }

    if (closestCellId === -1 || minDist > 1600) return;

    const targetCell = localCells[closestCellId];
    const defenderId = targetCell.kingdomId;

    if (defenderId === attackerKingdomId || defenderId === null) return;

    performConquest(closestCellId, attackerKingdomId, defenderId);
  };

  const performConquest = (cellId: number, attackerId: number, defenderId: number) => {
    // Calculate which cells would be contested (NOT captured yet!)
    const neighborsToContest = localCells[cellId].neighbors.filter((nId: number) => {
      const n = localCells[nId];
      return n.kingdomId === defenderId && !n.isWater && Math.random() > 0.3;
    });

    const contestedIds = [cellId, ...neighborsToContest];

    // Add to war fog - cells show smoke/battle effect (visual only)
    const now = Date.now();
    setWarFogCells(prev => {
      const newMap = new Map(prev);
      contestedIds.forEach(id => {
        newMap.set(id, { timestamp: now, attackerId });
      });
      return newMap;
    });

    // Clear fog after 8 seconds
    setTimeout(() => {
      setWarFogCells(prev => {
        const newMap = new Map(prev);
        contestedIds.forEach(id => {
          if (newMap.get(id)?.timestamp === now) {
            newMap.delete(id);
          }
        });
        return newMap;
      });
    }, 8000);

    // Notify parent - this creates a CONFLICT, not instant capture
    // Actual territory changes happen in GameInterface.applyConflictResolution
    if (onWarAction) {
        onWarAction({ type: 'conquest', attackerId, defenderId, cellId, capturedCellIds: contestedIds });
    }
  };

  const getKingdomByPOI = (poi: POI): Kingdom | undefined => {
    return localKingdoms.find(k => k.id === poi.kingdomId);
  };

  const getSeasonColor = (baseColor: string) => {
    const c = d3.color(baseColor);
    if (!c) return baseColor;
    const hsl = d3.hsl(c);

    switch (season) {
        case 'SPRING':
            hsl.s *= 0.7; 
            hsl.l = Math.min(0.85, hsl.l * 1.1);
            return hsl.toString();
        case 'SUMMER':
            return baseColor;
        case 'AUTUMN':
            if (hsl.h >= 70 && hsl.h <= 160) {
                hsl.h = 35 + (hsl.h - 70) * 0.2; 
                hsl.s *= 0.8;
                hsl.l *= 0.9;
            } else {
                 hsl.s *= 0.6;
                 hsl.l *= 0.95;
            }
            return hsl.toString();
        case 'WINTER':
            hsl.s *= 0.15;
            hsl.l = Math.min(0.92, hsl.l * 1.6); 
            return d3.interpolateRgb(hsl.toString(), "#e3f2fd")(0.4);
        default:
            return baseColor;
    }
  };
  
  const fogColor = season === 'WINTER' ? '#0b1622' : '#050a10';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
        
        {/* Compass Rose */}
        <div style={{
          position: 'absolute',
          top: 15,
          right: 15,
          width: 70,
          height: 70,
          zIndex: 10,
          pointerEvents: 'none',
          opacity: 0.85
        }}>
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            {/* Outer ring */}
            <circle cx="50" cy="50" r="45" fill="rgba(13, 27, 42, 0.8)" stroke="#4a6fa5" strokeWidth="2"/>
            <circle cx="50" cy="50" r="38" fill="none" stroke="#2d4a5e" strokeWidth="1"/>
            
            {/* Cardinal directions - pointed star */}
            {/* North pointer (prominent) */}
            <polygon points="50,8 45,45 50,38 55,45" fill="#74b9ff" stroke="#4a90d9" strokeWidth="0.5"/>
            {/* South pointer */}
            <polygon points="50,92 45,55 50,62 55,55" fill="#fdcb6e" stroke="#d4a373" strokeWidth="0.5"/>
            {/* East pointer */}
            <polygon points="92,50 55,45 62,50 55,55" fill="#636e72" stroke="#4a5568" strokeWidth="0.5"/>
            {/* West pointer */}
            <polygon points="8,50 45,45 38,50 45,55" fill="#636e72" stroke="#4a5568" strokeWidth="0.5"/>
            
            {/* Intercardinal small points */}
            <polygon points="78,22 55,42 58,45" fill="#4a5568" opacity="0.6"/>
            <polygon points="78,78 55,58 58,55" fill="#4a5568" opacity="0.6"/>
            <polygon points="22,78 42,55 45,58" fill="#4a5568" opacity="0.6"/>
            <polygon points="22,22 42,45 45,42" fill="#4a5568" opacity="0.6"/>
            
            {/* Center decoration */}
            <circle cx="50" cy="50" r="6" fill="#1b3a4b" stroke="#4a6fa5" strokeWidth="1"/>
            <circle cx="50" cy="50" r="2" fill="#74b9ff"/>
            
            {/* Labels */}
            <text x="50" y="22" textAnchor="middle" fill="#74b9ff" fontSize="10" fontFamily="'Cinzel', serif" fontWeight="bold">N</text>
            <text x="50" y="86" textAnchor="middle" fill="#fdcb6e" fontSize="10" fontFamily="'Cinzel', serif" fontWeight="bold">S</text>
            <text x="82" y="54" textAnchor="middle" fill="#9fb3c8" fontSize="9" fontFamily="'Cinzel', serif">E</text>
            <text x="18" y="54" textAnchor="middle" fill="#9fb3c8" fontSize="9" fontFamily="'Cinzel', serif">W</text>
          </svg>
        </div>
        
        <svg 
          ref={svgRef}
          width="100%" 
          height="100%" 
          style={{ 
              display: 'block', 
              cursor: warMode ? 'crosshair' : 'grab', 
              backgroundColor: OCEAN_COLOR,
          }}
          onClick={handleMapClick}
        >
          <defs>
              <pattern id="oceanTexture" patternUnits="userSpaceOnUse" width="100" height="100">
                <rect width="100" height="100" fill={OCEAN_COLOR} />
                <path d="M0 20 Q25 10 50 20 T100 20" stroke="#1b3a4b" strokeWidth="0.5" fill="none" opacity={0.2}/>
                <path d="M0 50 Q25 40 50 50 T100 50" stroke="#1b3a4b" strokeWidth="0.5" fill="none" opacity={0.15}/>
                <path d="M0 80 Q25 70 50 80 T100 80" stroke="#1b3a4b" strokeWidth="0.5" fill="none" opacity={0.15}/>
                <path d="M25 35 Q50 25 75 35" stroke="#4a6fa5" strokeWidth="0.3" fill="none" opacity="0.1"/>
                <path d="M10 65 Q35 55 60 65" stroke="#4a6fa5" strokeWidth="0.3" fill="none" opacity="0.1"/>
              </pattern>
              
              <linearGradient id="fogNorth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fogColor} stopOpacity="1" />
                <stop offset="100%" stopColor={fogColor} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="fogSouth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fogColor} stopOpacity="0" />
                <stop offset="100%" stopColor={fogColor} stopOpacity="1" />
              </linearGradient>
              <linearGradient id="fogWest" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={fogColor} stopOpacity="1" />
                <stop offset="100%" stopColor={fogColor} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="fogEast" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={fogColor} stopOpacity="0" />
                <stop offset="100%" stopColor={fogColor} stopOpacity="1" />
              </linearGradient>

              {/* Mountain pattern - rocky peaks with snow caps */}
              <pattern id="mountainPattern" patternUnits="userSpaceOnUse" width="60" height="45">
                <rect width="60" height="45" fill="#7a8599" opacity="0.4"/>
                {/* Main peak */}
                <path d="M10 45 L30 10 L50 45" fill="#5a6377" />
                <path d="M30 10 L25 20 L35 20 Z" fill="#e8eaed" opacity="0.9"/> {/* Snow cap */}
                {/* Secondary peak */}
                <path d="M35 45 L50 25 L60 45" fill="#6b7689" />
                <path d="M50 25 L47 30 L53 30 Z" fill="#dfe3e8" opacity="0.8"/>
                {/* Rock details */}
                <path d="M20 35 L25 28 L30 35" fill="#4a5568" opacity="0.6"/>
                <path d="M40 40 L45 33 L50 40" fill="#4a5568" opacity="0.5"/>
                {/* Shadows */}
                <path d="M30 10 L35 20 L50 45 L30 45 Z" fill="#3d4555" opacity="0.3"/>
              </pattern>

              {/* Hills pattern - detailed rolling terrain */}
              <pattern id="hillsPattern" patternUnits="userSpaceOnUse" width="120" height="80">
                {/* Base terrain color */}
                <rect width="120" height="80" fill="#8a9668" opacity="0.3"/>
                
                {/* Large background hills - depth layer */}
                <ellipse cx="30" cy="70" rx="40" ry="18" fill="#6d7a52" opacity="0.4"/>
                <ellipse cx="90" cy="65" rx="35" ry="15" fill="#5f6b45" opacity="0.35"/>
                
                {/* Mid-ground hills */}
                <ellipse cx="15" cy="55" rx="28" ry="14" fill="#7a8a5c" opacity="0.5"/>
                <ellipse cx="60" cy="50" rx="32" ry="16" fill="#6b7a4d" opacity="0.45"/>
                <ellipse cx="105" cy="58" rx="25" ry="12" fill="#758560" opacity="0.4"/>
                
                {/* Foreground smaller hills */}
                <ellipse cx="40" cy="35" rx="20" ry="10" fill="#8b9a6b" opacity="0.55"/>
                <ellipse cx="85" cy="40" rx="18" ry="9" fill="#7d8d5f" opacity="0.5"/>
                <ellipse cx="10" cy="30" rx="15" ry="8" fill="#94a574" opacity="0.45"/>
                
                {/* Sunlit highlights on hill tops */}
                <ellipse cx="12" cy="48" rx="12" ry="5" fill="#a8b88a" opacity="0.35"/>
                <ellipse cx="55" cy="43" rx="14" ry="5" fill="#b5c496" opacity="0.3"/>
                <ellipse cx="38" cy="30" rx="10" ry="4" fill="#c2d1a3" opacity="0.35"/>
                <ellipse cx="82" cy="35" rx="9" ry="3" fill="#afc08e" opacity="0.3"/>
                
                {/* Shadow details in valleys */}
                <path d="M0 60 Q15 55 30 60 Q45 65 60 58" stroke="#4a5a38" strokeWidth="1" fill="none" opacity="0.25"/>
                <path d="M55 70 Q75 62 95 68" stroke="#3d4a2d" strokeWidth="0.8" fill="none" opacity="0.2"/>
                
                {/* Grass texture lines */}
                <path d="M5 45 Q12 40 20 45" stroke="#5a6b3d" strokeWidth="0.4" fill="none" opacity="0.3"/>
                <path d="M25 38 Q35 32 45 38" stroke="#4f5f35" strokeWidth="0.4" fill="none" opacity="0.25"/>
                <path d="M70 45 Q80 38 90 44" stroke="#566640" strokeWidth="0.4" fill="none" opacity="0.28"/>
                <path d="M95 52 Q105 46 115 52" stroke="#4a5a38" strokeWidth="0.4" fill="none" opacity="0.22"/>
                
                {/* Small detail dots - rocks/bushes */}
                <circle cx="22" cy="42" r="1.5" fill="#5a6844" opacity="0.4"/>
                <circle cx="48" cy="48" r="1.2" fill="#4d5b3a" opacity="0.35"/>
                <circle cx="75" cy="52" r="1.8" fill="#566440" opacity="0.38"/>
                <circle cx="98" cy="45" r="1.3" fill="#5f6d48" opacity="0.32"/>
                <circle cx="8" cy="62" r="1.5" fill="#4a5838" opacity="0.36"/>
                <circle cx="112" cy="68" r="1.4" fill="#525f3e" opacity="0.3"/>
              </pattern>

              <pattern id="forestPatternSummer" patternUnits="userSpaceOnUse" width="20" height="25">
                <rect width="20" height="25" fill="transparent"/>
                <path d="M10 5 L5 20 L15 20 Z" fill="#2d4a22" opacity="0.5"/>
              </pattern>
              
              <pattern id="forestPatternAutumn" patternUnits="userSpaceOnUse" width="20" height="25">
                <rect width="20" height="25" fill="transparent"/>
                <path d="M10 5 L5 20 L15 20 Z" fill="#d35400" opacity="0.5"/>
                <path d="M10 8 L6 18 L14 18 Z" fill="#e67e22" opacity="0.3"/>
              </pattern>

              <pattern id="forestPatternWinter" patternUnits="userSpaceOnUse" width="20" height="25">
                <rect width="20" height="25" fill="transparent"/>
                <path d="M10 5 L5 20 L15 20 Z" fill="#2d3436" opacity="0.5"/>
                <path d="M10 4 L6 12 L14 12 Z" fill="#dfe6e9" opacity="0.7"/>
              </pattern>
              
              <pattern id="forestPatternSpring" patternUnits="userSpaceOnUse" width="20" height="25">
                <rect width="20" height="25" fill="transparent"/>
                <path d="M10 5 L5 20 L15 20 Z" fill="#6ab04c" opacity="0.5"/>
                <circle cx="8" cy="12" r="1.5" fill="#fab1a0" opacity="0.6" />
              </pattern>

              <filter id="paperTexture">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" result="noise"/>
                <feDiffuseLighting in="noise" lightingColor="#fff" surfaceScale="2" result="light">
                  <feDistantLight azimuth="45" elevation="60"/>
                </feDiffuseLighting>
                <feComposite operator="in" in="light" in2="SourceGraphic" result="textured"/>
                <feBlend in="textured" in2="SourceGraphic" mode="multiply"/>
              </filter>
              
              <filter id="oceanPaperTexture">
                <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" result="noise"/>
                <feDiffuseLighting in="noise" lightingColor="#fff" surfaceScale="1.5" result="light">
                  <feDistantLight azimuth="60" elevation="50"/>
                </feDiffuseLighting>
                <feComposite operator="in" in="light" in2="SourceGraphic" result="textured"/>
                <feBlend in="textured" in2="SourceGraphic" mode="multiply"/>
              </filter>

              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>

              {/* War Fog / Battle Smoke Effect */}
              <filter id="warSmoke" x="-50%" y="-50%" width="200%" height="200%">
                <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" seed="5" result="noise">
                  <animate attributeName="baseFrequency" values="0.015;0.025;0.015" dur="4s" repeatCount="indefinite"/>
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G"/>
              </filter>
              
              <radialGradient id="battleGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff6b35" stopOpacity="0.6"/>
                <stop offset="50%" stopColor="#8b0000" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#2d2d2d" stopOpacity="0.1"/>
              </radialGradient>
              
              <linearGradient id="smokeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4a4a4a" stopOpacity="0.7"/>
                <stop offset="100%" stopColor="#1a1a1a" stopOpacity="0.2"/>
              </linearGradient>
              
               <filter id="dropShadow">
                <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.5"/>
              </filter>

              {/* Climate Zone Gradient - North (cold) to South (warm) */}
              <linearGradient id="climateGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4a90d9" stopOpacity="0.25" />   {/* Arctic blue */}
                <stop offset="25%" stopColor="#4a90d9" stopOpacity="0.12" />
                <stop offset="40%" stopColor="#7cb342" stopOpacity="0.0" />   {/* Temperate - transparent */}
                <stop offset="60%" stopColor="#7cb342" stopOpacity="0.0" />
                <stop offset="75%" stopColor="#f4a460" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#d2691e" stopOpacity="0.20" /> {/* Arid orange */}
              </linearGradient>

              {/* Climate zone labels positioning */}
              <linearGradient id="northLabel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#74b9ff" />
                <stop offset="100%" stopColor="#0984e3" />
              </linearGradient>
              <linearGradient id="southLabel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffeaa7" />
                <stop offset="100%" stopColor="#fdcb6e" />
              </linearGradient>
          </defs>

          <g ref={gRef}>
            <rect 
                x={-OCEAN_BUFFER} 
                y={-OCEAN_BUFFER} 
                width={WORLD_WIDTH + OCEAN_BUFFER * 2} 
                height={WORLD_HEIGHT + OCEAN_BUFFER * 2} 
                fill={OCEAN_COLOR} 
                filter="url(#oceanPaperTexture)"
            />

            {worldData?.distantLands?.map((land) => (
                <path key={land.id} d={land.path} fill="#0f2231" stroke="none" opacity="0.7" style={{ pointerEvents: 'none' }}/>
            ))}

            {worldData && (
              <>
                {/* Weather Overlay - Attached to World Canvas */}
                <foreignObject 
                    x={-OCEAN_BUFFER} 
                    y={-OCEAN_BUFFER} 
                    width={WORLD_WIDTH + OCEAN_BUFFER * 2} 
                    height={WORLD_HEIGHT + OCEAN_BUFFER * 2}
                    style={{ pointerEvents: 'none', zIndex: 50 }}
                >
                    <div className="weather-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <div className={`weather-layer snow ${season === 'WINTER' ? 'active' : ''}`} />
                        <div className={`weather-layer petals ${season === 'SPRING' ? 'active' : ''}`} />
                        <div className={`weather-layer pollen ${season === 'SUMMER' ? 'active' : ''}`} />
                        <div className={`weather-layer leaves ${season === 'AUTUMN' ? 'active' : ''}`} />
                    </div>
                </foreignObject>

                <g filter="url(#paperTexture)">
                  {localKingdoms.map(k => (
                    <path
                      key={`kingdom-${k.id}`}
                      d={k.svgPath || ''}
                      fill={getSeasonColor(k.color)}
                      stroke={warMode && attackerKingdomId === k.id ? '#fff' : 'none'}
                      strokeWidth={warMode && attackerKingdomId === k.id ? 3 : 0}
                      opacity={hoveredKingdom?.id === k.id || attackerKingdomId === k.id ? 1 : 0.9}
                      style={{ transition: 'fill 5s ease-in-out, opacity 0.2s', cursor: warMode ? 'pointer' : 'default' }}
                      onMouseEnter={() => setHoveredKingdom(k)}
                      onMouseLeave={() => setHoveredKingdom(null)}
                      onClick={(e) => {
                        if (warMode && attackerKingdomId === null) {
                          e.stopPropagation();
                          handleKingdomClick(k);
                        }
                      }}
                    />
                  ))}
                </g>

                {worldData.biomePaths?.map(({ biome, path }) => {
                  if (biome === 'FOREST') {
                      // Stacked forest layers for smooth transition
                      return (
                        <g key={`biome-forest-group`} style={{ pointerEvents: 'none' }}>
                            <path d={path} fill="url(#forestPatternSummer)" opacity={season === 'SUMMER' ? 0.6 : 0} style={{ transition: 'opacity 5s ease-in-out' }} />
                            <path d={path} fill="url(#forestPatternAutumn)" opacity={season === 'AUTUMN' ? 0.6 : 0} style={{ transition: 'opacity 5s ease-in-out' }} />
                            <path d={path} fill="url(#forestPatternWinter)" opacity={season === 'WINTER' ? 0.6 : 0} style={{ transition: 'opacity 5s ease-in-out' }} />
                            <path d={path} fill="url(#forestPatternSpring)" opacity={season === 'SPRING' ? 0.6 : 0} style={{ transition: 'opacity 5s ease-in-out' }} />
                        </g>
                      );
                  }

                  if (biome === 'HILLS') {
                       return (
                        <path
                            key={`biome-${biome}`}
                            d={path}
                            fill="url(#hillsPattern)"
                            opacity={0.75}
                            stroke="none"
                            style={{ pointerEvents: 'none' }}
                        />
                      );
                  }

                  // Other biomes (Snow, etc) - keeping simple for now
                  return null;
                })}

                {/* War Fog - Battle smoke on recently captured cells */}
                {warMode && warFogCells.size > 0 && (
                  <g className="war-fog-layer" style={{ pointerEvents: 'none' }}>
                    {Array.from(warFogCells.entries()).map(([cellId, data]) => {
                      const cell = localCells[cellId];
                      if (!cell || !cell.polygon || cell.polygon.length < 3) return null;
                      const pathD = `M ${cell.polygon.map((p: number[]) => `${p[0]},${p[1]}`).join(' L ')} Z`;
                      const age = Date.now() - data.timestamp;
                      const fadeOpacity = Math.max(0, 1 - age / 8000);
                      
                      return (
                        <g key={`war-fog-${cellId}`}>
                          {/* Smoke/fire glow */}
                          <path 
                            d={pathD} 
                            fill="url(#battleGlow)" 
                            opacity={fadeOpacity * 0.7}
                            filter="url(#warSmoke)"
                          />
                          {/* Dark smoke overlay */}
                          <path 
                            d={pathD} 
                            fill="url(#smokeGradient)" 
                            opacity={fadeOpacity * 0.4}
                          />
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Contested Territory - from active conflicts */}
                {activeConflicts.length > 0 && (
                  <g className="contested-territory" style={{ pointerEvents: 'none' }}>
                    {activeConflicts.flatMap(conflict => 
                      conflict.contestedCellIds.map(cellId => {
                        const cell = localCells[cellId];
                        if (!cell || !cell.polygon || cell.polygon.length < 3) return null;
                        const pathD = `M ${cell.polygon.map((p: number[]) => `${p[0]},${p[1]}`).join(' L ')} Z`;
                        
                        return (
                          <path 
                            key={`contested-${conflict.id}-${cellId}`}
                            d={pathD} 
                            fill="none"
                            stroke={conflict.status === 'ATTACKER_WINNING' ? '#27ae60' : 
                                    conflict.status === 'DEFENDER_WINNING' ? '#3498db' : '#e74c3c'}
                            strokeWidth={3}
                            strokeDasharray="8 4"
                            opacity={0.8}
                            style={{ animation: 'contestedPulse 1.5s ease-in-out infinite' }}
                          />
                        );
                      })
                    )}
                  </g>
                )}

                {localKingdoms.map(k => (
                  <path
                    key={`border-${k.id}`}
                    d={k.svgPath || ''}
                    fill="none"
                    stroke={k.borderColor}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    filter="url(#dropShadow)"
                    style={{ pointerEvents: 'none', transition: 'd 0.5s ease-in-out' }}
                  />
                ))}

                <path d={worldData.coastlinePath || ''} fill="none" stroke="#1b3a4b" strokeWidth={3} opacity={0.8} style={{ pointerEvents: 'none' }}/>

                {/* Climate Zone Overlay - subtle tint showing North/Central/South */}
                <rect
                  x={0}
                  y={0}
                  width={WORLD_WIDTH}
                  height={WORLD_HEIGHT}
                  fill="url(#climateGradient)"
                  style={{ pointerEvents: 'none', mixBlendMode: 'multiply' }}
                  clipPath={`path('${worldData.coastlinePath}')`}
                />

                {/* Edge of the World Labels - in the ocean/void areas */}
                <text x={-400} y={WORLD_HEIGHT / 2} textAnchor="middle" fill="#3d5a80" fontSize={28} 
                  fontFamily="'Cinzel', serif" fontStyle="italic" opacity={0.7} 
                  transform={`rotate(-90, -400, ${WORLD_HEIGHT / 2})`}
                  style={{ pointerEvents: 'none', letterSpacing: '4px' }}>
                  THE WESTERN VOID
                </text>
                <text x={WORLD_WIDTH + 400} y={WORLD_HEIGHT / 2} textAnchor="middle" fill="#3d5a80" fontSize={28} 
                  fontFamily="'Cinzel', serif" fontStyle="italic" opacity={0.7}
                  transform={`rotate(90, ${WORLD_WIDTH + 400}, ${WORLD_HEIGHT / 2})`}
                  style={{ pointerEvents: 'none', letterSpacing: '4px' }}>
                  UNCHARTED WATERS
                </text>
                <text x={WORLD_WIDTH / 2} y={-350} textAnchor="middle" fill="#3d5a80" fontSize={28} 
                  fontFamily="'Cinzel', serif" fontStyle="italic" opacity={0.7}
                  style={{ pointerEvents: 'none', letterSpacing: '4px' }}>
                  HERE BE DRAGONS
                </text>
                <text x={WORLD_WIDTH / 2} y={WORLD_HEIGHT + 380} textAnchor="middle" fill="#3d5a80" fontSize={28} 
                  fontFamily="'Cinzel', serif" fontStyle="italic" opacity={0.7}
                  style={{ pointerEvents: 'none', letterSpacing: '4px' }}>
                  THE ENDLESS SEA
                </text>

                {allPOIs.map(poi => {
                  const isCapital = poi.type === 'capital';
                  const isHovered = hoveredPOI?.id === poi.id;
                  const kingdom = getKingdomByPOI(poi);
                  const size = isCapital ? 12 : 8;
                  const { x, y } = poi.position;
                  const isQuestTarget = travelQuestTarget?.id === poi.id;
                  const isPlayerHere = playerLocation?.id === poi.id;

                  // If kingdom is not found (destroyed), show neutral color or specific ruin color
                  const fillColor = kingdom?.color || '#555';

                  return (
                    <g
                      key={poi.id}
                      style={{ cursor: isQuestTarget ? 'pointer' : 'pointer', transition: 'fill 1s ease' }}
                      onMouseEnter={() => setHoveredPOI(poi)}
                      onMouseLeave={() => setHoveredPOI(null)}
                      onClick={(e) => { e.stopPropagation(); handlePOIClick(poi); }}
                      filter={isHovered || isQuestTarget ? "url(#glow)" : undefined}
                    >
                      {/* Quest target pulsing ring */}
                      {isQuestTarget && (
                        <>
                          <circle 
                            cx={x} 
                            cy={y} 
                            r={size + 12} 
                            fill="none" 
                            stroke="#f1c40f" 
                            strokeWidth={2}
                            opacity={0.6}
                            className="quest-pulse"
                          />
                          <circle 
                            cx={x} 
                            cy={y} 
                            r={size + 8} 
                            fill="rgba(241, 196, 15, 0.15)" 
                            stroke="#f1c40f" 
                            strokeWidth={1.5}
                          />
                        </>
                      )}
                      
                      {isCapital ? (
                        <polygon points={generateStarPoints(x, y, size, size / 2, 8)} fill="#ffd700" stroke={isQuestTarget ? '#f1c40f' : '#8b6914'} strokeWidth={isQuestTarget ? 3 : 2}/>
                      ) : (
                        <circle cx={x} cy={y} r={size} fill={fillColor} stroke={isQuestTarget ? '#f1c40f' : '#463f3a'} strokeWidth={isQuestTarget ? 3 : 2} style={{ transition: 'fill 1s ease' }} />
                      )}
                      
                      {/* Quest star icon */}
                      {isQuestTarget && (
                        <text x={x} y={y - size - 18} textAnchor="middle" fontSize="16" fill="#f1c40f" style={{ pointerEvents: 'none' }}>
                          ⭐
                        </text>
                      )}
                      
                      <text x={x} y={y - size - 6} textAnchor="middle" fill={isQuestTarget ? '#f1c40f' : '#f8f9fa'} fontSize={isCapital ? 13 : 10} fontWeight={isCapital || isQuestTarget ? 'bold' : 'normal'}
                        style={{ textShadow: '1px 1px 2px black, -1px -1px 2px black', pointerEvents: 'none', fontFamily: "'Cinzel', serif" }}>
                        {poi.name}
                      </text>
                      
                      {/* Click hint for quest target */}
                      {isQuestTarget && isHovered && (
                        <text x={x} y={y + size + 14} textAnchor="middle" fontSize="10" fill="#f1c40f" style={{ pointerEvents: 'none' }}>
                          Нажмите для путешествия
                        </text>
                      )}
                    </g>
                  );
                })}

                {selectedPOI && (() => {
                   const reticleColor = season === 'WINTER' ? '#00ffff' : '#ffd700';
                   return (
                   <g 
                     transform={`translate(${selectedPOI.position.x}, ${selectedPOI.position.y})`} 
                     style={{ pointerEvents: 'none' }}
                   >
                      <circle r="22" fill="none" stroke={reticleColor} strokeWidth="2" strokeDasharray="4 2" opacity="0.8">
                         <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="8s" repeatCount="indefinite"/>
                      </circle>
                   </g>
                 );
                })()}

                {/* Travel Paths - Routes from current location */}
                {showTravelPaths && travelPaths.length > 0 && (
                  <g className="travel-paths" style={{ pointerEvents: 'none' }}>
                    {travelPaths.map(path => {
                      const isHovered = hoveredPath?.toId === path.toId;
                      const isQuestTarget = travelQuestTarget?.id === path.toId;
                      
                      // Calculate control point for curved line
                      const midX = (path.from.x + path.to.x) / 2;
                      const midY = (path.from.y + path.to.y) / 2;
                      const dx = path.to.x - path.from.x;
                      const dy = path.to.y - path.from.y;
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      // Curve perpendicular to the line
                      const curveOffset = Math.min(dist * 0.15, 50);
                      const perpX = -dy / dist * curveOffset;
                      const perpY = dx / dist * curveOffset;
                      const ctrlX = midX + perpX;
                      const ctrlY = midY + perpY;
                      
                      return (
                        <g key={`path-${path.fromId}-${path.toId}`}>
                          {/* Path glow for quest target */}
                          {isQuestTarget && (
                            <path
                              d={`M ${path.from.x} ${path.from.y} Q ${ctrlX} ${ctrlY} ${path.to.x} ${path.to.y}`}
                              fill="none"
                              stroke="#f1c40f"
                              strokeWidth={8}
                              opacity={0.4}
                              strokeLinecap="round"
                            >
                              <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2s" repeatCount="indefinite"/>
                            </path>
                          )}
                          
                          {/* Main path line */}
                          <path
                            d={`M ${path.from.x} ${path.from.y} Q ${ctrlX} ${ctrlY} ${path.to.x} ${path.to.y}`}
                            fill="none"
                            stroke={isQuestTarget ? '#f1c40f' : path.color}
                            strokeWidth={isHovered ? 4 : 2.5}
                            strokeDasharray={path.dashed || path.isLocked ? '8 4' : 'none'}
                            opacity={path.isLocked ? 0.4 : isHovered ? 1 : 0.7}
                            strokeLinecap="round"
                            style={{ transition: 'all 0.2s ease', pointerEvents: 'stroke', cursor: path.isLocked ? 'not-allowed' : 'pointer' }}
                            onMouseEnter={() => !path.isLocked && setHoveredPath(path)}
                            onMouseLeave={() => setHoveredPath(null)}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!path.isLocked && onTravelSelect) {
                                onTravelSelect(path.toId);
                              }
                            }}
                          />
                          
                          {/* Arrow at destination */}
                          {!path.isLocked && (
                            <g transform={`translate(${path.to.x}, ${path.to.y})`}>
                              <circle 
                                r={isHovered ? 10 : 7} 
                                fill={isQuestTarget ? '#f1c40f' : path.color}
                                opacity={isHovered ? 1 : 0.8}
                                style={{ transition: 'all 0.2s ease', cursor: 'pointer', pointerEvents: 'all' }}
                                onMouseEnter={() => setHoveredPath(path)}
                                onMouseLeave={() => setHoveredPath(null)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onTravelSelect) {
                                    onTravelSelect(path.toId);
                                  }
                                }}
                              />
                              {isQuestTarget && (
                                <text y={-18} textAnchor="middle" fontSize="14" fill="#f1c40f" style={{ pointerEvents: 'none' }}>
                                  ⭐
                                </text>
                              )}
                            </g>
                          )}
                          
                          {/* Lock icon for locked paths */}
                          {path.isLocked && (
                            <g transform={`translate(${midX}, ${midY})`}>
                              <circle r="10" fill="rgba(0,0,0,0.7)" stroke="#666" strokeWidth="1"/>
                              <text y="4" textAnchor="middle" fontSize="12" fill="#888" style={{ pointerEvents: 'none' }}>
                                🔒
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Hovered path tooltip */}
                {hoveredPath && (
                  <g transform={`translate(${(hoveredPath.from.x + hoveredPath.to.x) / 2}, ${(hoveredPath.from.y + hoveredPath.to.y) / 2 - 30})`}
                     style={{ pointerEvents: 'none' }}>
                    <rect 
                      x="-70" y="-24" width="140" height="48" rx="6"
                      fill="rgba(10, 10, 15, 0.95)" 
                      stroke={hoveredPath.color} 
                      strokeWidth="1"
                    />
                    <text y="-6" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="500">
                      {hoveredPath.distance === 1 ? '1 день' : `${hoveredPath.distance} дня`} • {hoveredPath.cost} 💰
                    </text>
                    <text y="12" textAnchor="middle" fill={hoveredPath.color} fontSize="11">
                      {hoveredPath.danger === 'safe' ? '🛡️ Безопасно' : 
                       hoveredPath.danger === 'risky' ? '⚠️ Рискованно' : '☠️ Опасно'}
                    </text>
                  </g>
                )}

                {/* Quest Target Marker - highlighted destination */}
                {travelQuestTarget && !playerLocation && (
                  <g 
                    transform={`translate(${travelQuestTarget.position.x}, ${travelQuestTarget.position.y})`} 
                    style={{ pointerEvents: 'none' }}
                  >
                    {/* Pulsing beacon */}
                    <circle r="45" fill="none" stroke="#f1c40f" strokeWidth="2" opacity="0.4">
                      <animate attributeName="r" values="35;50;35" dur="2.5s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2.5s" repeatCount="indefinite"/>
                    </circle>
                    <circle r="30" fill="rgba(241, 196, 15, 0.15)" stroke="#f1c40f" strokeWidth="2">
                      <animate attributeName="opacity" values="0.4;0.7;0.4" dur="1.5s" repeatCount="indefinite"/>
                    </circle>
                    {/* Quest star */}
                    <text y="4" textAnchor="middle" fontSize="20" fill="#f1c40f" 
                      style={{ textShadow: '0 0 10px rgba(241, 196, 15, 0.8)' }}>
                      ⭐
                    </text>
                    {/* Label */}
                    <text y="55" textAnchor="middle" fill="#f1c40f" fontSize="11" fontWeight="bold"
                      style={{ textShadow: '0 0 6px rgba(0,0,0,0.9), 1px 1px 2px black', fontFamily: "'Cinzel', serif", letterSpacing: '1px' }}>
                      ЦЕЛЬ КВЕСТА
                    </text>
                  </g>
                )}

                {/* Starting Location Marker - BEFORE game starts */}
                {startingLocation && !playerLocation && (
                  <g 
                    transform={`translate(${startingLocation.position.x}, ${startingLocation.position.y})`} 
                    style={{ pointerEvents: 'none' }}
                  >
                    {/* Outer pulsing ring */}
                    <circle r="35" fill="none" stroke="#4ecdc4" strokeWidth="3" opacity="0.6">
                      <animate attributeName="r" values="30;40;30" dur="2s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite"/>
                    </circle>
                    {/* Inner glow */}
                    <circle r="25" fill="rgba(78, 205, 196, 0.2)" stroke="#4ecdc4" strokeWidth="2">
                      <animate attributeName="opacity" values="0.5;0.8;0.5" dur="1.5s" repeatCount="indefinite"/>
                    </circle>
                    {/* "START" text below */}
                    <text y="50" textAnchor="middle" fill="#4ecdc4" fontSize="14" fontWeight="bold"
                      style={{ textShadow: '0 0 8px rgba(78, 205, 196, 0.8), 1px 1px 2px black', fontFamily: "'Cinzel', serif", letterSpacing: '2px' }}>
                      🎮 СТАРТ
                    </text>
                  </g>
                )}

                {/* Player Location Marker - DURING game */}
                {playerLocation && (
                  <g 
                    transform={`translate(${playerLocation.position.x}, ${playerLocation.position.y})`} 
                    style={{ pointerEvents: 'none' }}
                  >
                    {/* Player icon background glow */}
                    <circle r="22" fill="rgba(78, 205, 196, 0.3)">
                      <animate attributeName="r" values="20;26;20" dur="3s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.4;0.2;0.4" dur="3s" repeatCount="indefinite"/>
                    </circle>
                    {/* Player marker - shield shape */}
                    <path 
                      d="M 0 -18 L 14 -8 L 14 8 L 0 18 L -14 8 L -14 -8 Z" 
                      fill="#4ecdc4"
                      stroke="#fff"
                      strokeWidth="2"
                      filter="drop-shadow(0 0 6px rgba(78, 205, 196, 0.8))"
                    >
                      <animate attributeName="opacity" values="1;0.8;1" dur="2s" repeatCount="indefinite"/>
                    </path>
                    {/* Player icon */}
                    <text y="5" textAnchor="middle" fontSize="16" fill="#0a0a0f" fontWeight="bold"
                      style={{ textShadow: 'none' }}>
                      ⚔
                    </text>
                    {/* Location name label */}
                    <rect x="-45" y="24" width="90" height="20" rx="4" 
                      fill="rgba(10, 10, 15, 0.85)" stroke="#4ecdc4" strokeWidth="1"/>
                    <text y="38" textAnchor="middle" fill="#4ecdc4" fontSize="10" fontWeight="500"
                      style={{ fontFamily: "'Cinzel', serif" }}>
                      {playerLocation.name.length > 12 ? playerLocation.name.substring(0, 11) + '…' : playerLocation.name}
                    </text>
                  </g>
                )}
              </>
            )}
            
            <g style={{ pointerEvents: 'none' }}>
               <rect x={-OCEAN_BUFFER} y={-OCEAN_BUFFER} width={WORLD_WIDTH + OCEAN_BUFFER*2} height={OCEAN_BUFFER - 600} fill={fogColor} />
               <rect x={-OCEAN_BUFFER} y={-600} width={WORLD_WIDTH + OCEAN_BUFFER*2} height={600} fill="url(#fogNorth)" />

               <rect x={-OCEAN_BUFFER} y={WORLD_HEIGHT + 600} width={WORLD_WIDTH + OCEAN_BUFFER*2} height={OCEAN_BUFFER} fill={fogColor} />
               <rect x={-OCEAN_BUFFER} y={WORLD_HEIGHT} width={WORLD_WIDTH + OCEAN_BUFFER*2} height={600} fill="url(#fogSouth)" />

               <rect x={-OCEAN_BUFFER} y={-OCEAN_BUFFER} width={OCEAN_BUFFER - 600} height={WORLD_HEIGHT + OCEAN_BUFFER*2} fill={fogColor} />
               <rect x={-600} y={-OCEAN_BUFFER} width={600} height={WORLD_HEIGHT + OCEAN_BUFFER*2} fill="url(#fogWest)" />

               <rect x={WORLD_WIDTH + 600} y={-OCEAN_BUFFER} width={OCEAN_BUFFER} height={WORLD_HEIGHT + OCEAN_BUFFER*2} fill={fogColor} />
               <rect x={WORLD_WIDTH} y={-OCEAN_BUFFER} width={600} height={WORLD_HEIGHT + OCEAN_BUFFER*2} fill="url(#fogEast)" />
            </g>
          </g>
        </svg>

        <div style={{ 
            position: 'absolute', 
            inset: 0, 
            background: 'radial-gradient(circle at center, transparent 50%, rgba(5, 10, 15, 0.3) 100%)', 
            pointerEvents: 'none',
            zIndex: 5
        }}/>
        
        {loading && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: '#0d1b2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5d8aa8', fontSize: '1.5rem', fontFamily: "'Cinzel', serif", zIndex: 10 }}>
            Charting Unknown Waters...
          </div>
        )}
    </div>
  );
};

function generateStarPoints(cx: number, cy: number, outerR: number, innerR: number, numPoints: number): string {
  const points: string[] = [];
  for (let i = 0; i < numPoints * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / numPoints) * i - Math.PI / 2;
    points.push(`${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`);
  }
  return points.join(' ');
}

export default WorldMap;
