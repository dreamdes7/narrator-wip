import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { generateWorld, computeKingdomPath } from '../utils/worldGenerator';
import { DEFAULT_WORLD_CONFIG, type WorldData, type POI, type Kingdom } from '../types/world';
import './ui/Effects.css';

const VIEWPORT_WIDTH = 1000;
const VIEWPORT_HEIGHT = 700;
const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 1100;
const OCEAN_BUFFER = 5000;

interface WorldMapProps {
  onLocationSelect: (location: POI | null, kingdom: Kingdom | null) => void;
  onKingdomHover: (kingdom: Kingdom | null) => void;
  warMode: boolean;
  season: 'SUMMER' | 'WINTER';
  onWarAction?: (action: { type: 'conquest', attackerId: number, defenderId: number, cellId: number }) => void;
  selectedPOI?: POI | null;
}

const WorldMap: React.FC<WorldMapProps> = ({ onLocationSelect, onKingdomHover, warMode, season, onWarAction, selectedPOI }) => {
  const [worldData, setWorldData] = useState<WorldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredPOI, setHoveredPOI] = useState<POI | null>(null);
  const [hoveredKingdom, setHoveredKingdom] = useState<Kingdom | null>(null);
  const [attackerKingdomId, setAttackerKingdomId] = useState<number | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Center constants
  const centerX = WORLD_WIDTH / 2;
  const centerY = WORLD_HEIGHT / 2;

  const handleGenerate = useCallback(() => {
    setLoading(true);
    setAttackerKingdomId(null);
    
    setTimeout(() => {
      const data = generateWorld({
        ...DEFAULT_WORLD_CONFIG,
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
      });
      setWorldData(data);
      setLoading(false);
      
      if (svgRef.current && zoomRef.current) {
        const svg = d3.select(svgRef.current);
        const initialTransform = d3.zoomIdentity
          .translate(-(WORLD_WIDTH - VIEWPORT_WIDTH) / 2, -(WORLD_HEIGHT - VIEWPORT_HEIGHT) / 2);
        svg.call(zoomRef.current.transform, initialTransform);
      }
    }, 50);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 6]) // Increased max zoom and allowed slightly more zoom out
      .translateExtent([[-600, -500], [WORLD_WIDTH + 600, WORLD_HEIGHT + 500]]) // Expanded borders to fit further labels
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomRef.current = zoom;
    svg.on('dblclick.zoom', null);

    return () => { svg.on('.zoom', null); };
  }, []);

  useEffect(() => {
    handleGenerate();
  }, [handleGenerate]);

  useEffect(() => {
    onKingdomHover(hoveredKingdom);
  }, [hoveredKingdom, onKingdomHover]);

  const allPOIs = worldData?.kingdoms.flatMap(k => [k.capital, ...k.cities]) || [];

  const handlePOIClick = (poi: POI) => {
    if (!warMode) {
      const kingdom = worldData?.kingdoms.find(k => k.id === poi.kingdomId) || null;
      onLocationSelect(poi, kingdom);
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
    if (!warMode || attackerKingdomId === null || !worldData || !gRef.current) {
        if (!warMode && !hoveredPOI) {
            onLocationSelect(null, null);
        }
        return;
    }

    const [x, y] = d3.pointer(e, gRef.current);
    let closestCellId = -1;
    let minDist = Infinity;

    for (const cell of worldData.cells) {
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

    const targetCell = worldData.cells[closestCellId];
    const defenderId = targetCell.kingdomId;

    if (defenderId === attackerKingdomId || defenderId === null) return;

    performConquest(closestCellId, attackerKingdomId, defenderId);
  };

  const performConquest = (cellId: number, attackerId: number, defenderId: number) => {
    if (!worldData) return;

    const newCells = [...worldData.cells];
    const newKingdoms = worldData.kingdoms.map(k => ({ ...k, cellIds: [...k.cellIds] }));

    newCells[cellId] = { ...newCells[cellId], kingdomId: attackerId };

    const neighborsToCapture = newCells[cellId].neighbors.filter(nId => {
      const n = newCells[nId];
      return n.kingdomId === defenderId && !n.isWater && Math.random() > 0.5;
    });

    for (const nId of neighborsToCapture) {
      newCells[nId] = { ...newCells[nId], kingdomId: attackerId };
    }

    const attacker = newKingdoms.find(k => k.id === attackerId)!;
    const defender = newKingdoms.find(k => k.id === defenderId)!;

    const capturedIds = [cellId, ...neighborsToCapture];
    attacker.cellIds = [...attacker.cellIds, ...capturedIds];
    defender.cellIds = defender.cellIds.filter(id => !capturedIds.includes(id));

    attacker.svgPath = computeKingdomPath(attacker.cellIds, newCells);
    defender.svgPath = computeKingdomPath(defender.cellIds, newCells);

    if (onWarAction) {
        onWarAction({ type: 'conquest', attackerId, defenderId, cellId });
    }

    setWorldData({
      ...worldData,
      cells: newCells,
      kingdoms: newKingdoms
    });
  };

  const getKingdomByPOI = (poi: POI): Kingdom | undefined => {
    return worldData?.kingdoms.find(k => k.id === poi.kingdomId);
  };

  const getSeasonColor = (baseColor: string) => {
    if (season === 'SUMMER') return baseColor;
    const c = d3.color(baseColor);
    if (!c) return baseColor;
    const hsl = d3.hsl(c);
    hsl.s *= 0.2;
    hsl.l = Math.min(0.9, hsl.l * 1.5);
    return hsl.toString();
  };

  const getOceanColor = () => {
    return season === 'WINTER' ? '#1a2639' : '#0d1b2a';
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
        <div className={`snow-layer ${season === 'WINTER' ? 'active' : ''}`} />
        <div className={`snow-layer layer-2 ${season === 'WINTER' ? 'active' : ''}`} />
        <svg 
          ref={svgRef}
          width="100%" 
          height="100%" 
          style={{ 
              display: 'block', 
              cursor: warMode ? 'crosshair' : 'grab', 
              backgroundColor: getOceanColor(), 
              transition: 'background-color 10s ease-in-out' 
          }}
          onClick={handleMapClick}
        >
          <defs>
              <pattern id="oceanTexture" patternUnits="userSpaceOnUse" width="100" height="100">
                <rect width="100" height="100" fill={getOceanColor()} style={{ transition: 'fill 10s ease-in-out' }}/>
                {/* Detailed Wave Pattern */}
                <path d="M0 20 Q25 10 50 20 T100 20" stroke="#1b3a4b" strokeWidth="0.5" fill="none" opacity={season === 'WINTER' ? 0.3 : 0.1}/>
                <path d="M0 50 Q25 40 50 50 T100 50" stroke="#1b3a4b" strokeWidth="0.5" fill="none" opacity={season === 'WINTER' ? 0.3 : 0.1}/>
                <path d="M0 80 Q25 70 50 80 T100 80" stroke="#1b3a4b" strokeWidth="0.5" fill="none" opacity={season === 'WINTER' ? 0.3 : 0.1}/>
                
                {/* Secondary ripples */}
                <path d="M25 35 Q50 25 75 35" stroke="#4a6fa5" strokeWidth="0.3" fill="none" opacity="0.1"/>
                <path d="M10 65 Q35 55 60 65" stroke="#4a6fa5" strokeWidth="0.3" fill="none" opacity="0.1"/>
                <path d="M60 5 Q85 -5 110 5" stroke="#4a6fa5" strokeWidth="0.3" fill="none" opacity="0.1"/>
              </pattern>
              
              {/* Fog Gradients for World Borders */}
              <linearGradient id="fogNorth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={season === 'WINTER' ? '#0b1622' : '#050a10'} stopOpacity="1" />
                <stop offset="100%" stopColor={season === 'WINTER' ? '#0b1622' : '#050a10'} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="fogSouth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={season === 'WINTER' ? '#0b1622' : '#050a10'} stopOpacity="0" />
                <stop offset="100%" stopColor={season === 'WINTER' ? '#0b1622' : '#050a10'} stopOpacity="1" />
              </linearGradient>
              <linearGradient id="fogWest" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={season === 'WINTER' ? '#0b1622' : '#050a10'} stopOpacity="1" />
                <stop offset="100%" stopColor={season === 'WINTER' ? '#0b1622' : '#050a10'} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="fogEast" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={season === 'WINTER' ? '#0b1622' : '#050a10'} stopOpacity="0" />
                <stop offset="100%" stopColor={season === 'WINTER' ? '#0b1622' : '#050a10'} stopOpacity="1" />
              </linearGradient>

              {/* Summer Mountains */}
              <pattern id="mountainPattern" patternUnits="userSpaceOnUse" width="40" height="30">
                <rect width="40" height="30" fill="transparent"/>
                <path d="M5 30 L20 8 L35 30" fill="#6c757d" opacity="0.25"/>
                <path d="M5 30 L20 10 L35 30" stroke="#495057" strokeWidth="1.5" fill="none" opacity="0.5"/>
                {/* Small snow cap even in summer */}
                <path d="M20 10 L17 15 L23 15 Z" fill="#adb5bd" opacity="0.3"/>
              </pattern>

              {/* Summer Forest - Green trees */}
              <pattern id="forestPatternSummer" patternUnits="userSpaceOnUse" width="20" height="25">
                <rect width="20" height="25" fill="transparent"/>
                <path d="M10 5 L5 20 L15 20 Z" fill="#2d4a22" opacity="0.5"/>
                <path d="M10 8 L6 18 L14 18 Z" fill="#3d5a32" opacity="0.3"/>
              </pattern>

              {/* Winter Forest - Snow-covered trees */}
              <pattern id="forestPatternWinter" patternUnits="userSpaceOnUse" width="20" height="25">
                <rect width="20" height="25" fill="transparent"/>
                {/* Tree trunk visible through snow */}
                <rect x="9" y="16" width="2" height="6" fill="#4a3728" opacity="0.4"/>
                {/* Dark tree silhouette */}
                <path d="M10 5 L5 20 L15 20 Z" fill="#2d3436" opacity="0.5"/>
                {/* Snow caps on trees */}
                <path d="M10 4 L6 12 L14 12 Z" fill="#dfe6e9" opacity="0.7"/>
                <path d="M10 8 L7 14 L13 14 Z" fill="#b2bec3" opacity="0.5"/>
                {/* Snow at base */}
                <ellipse cx="10" cy="22" rx="4" ry="2" fill="#ecf0f1" opacity="0.4"/>
              </pattern>

              {/* Winter Mountains - Snow peaks */}
              <pattern id="mountainPatternWinter" patternUnits="userSpaceOnUse" width="40" height="30">
                <rect width="40" height="30" fill="transparent"/>
                {/* Mountain body */}
                <path d="M5 30 L20 8 L35 30" fill="#636e72" opacity="0.3"/>
                {/* Snow peak */}
                <path d="M20 8 L14 18 L26 18 Z" fill="#ecf0f1" opacity="0.7"/>
                <path d="M20 10 L16 16 L24 16 Z" fill="#fff" opacity="0.5"/>
              </pattern>

              <pattern id="snowPattern" patternUnits="userSpaceOnUse" width="20" height="20">
                <rect width="20" height="20" fill="transparent"/>
                <circle cx="5" cy="5" r="1.5" fill="white" opacity="0.4"/>
              </pattern>

              {/* Ground snow cover pattern */}
              <pattern id="groundSnowPattern" patternUnits="userSpaceOnUse" width="30" height="30">
                <rect width="30" height="30" fill="#ecf0f1" opacity="0.3"/>
                <circle cx="8" cy="12" r="6" fill="#fff" opacity="0.2"/>
                <circle cx="22" cy="8" r="4" fill="#fff" opacity="0.15"/>
                <circle cx="15" cy="22" r="5" fill="#dfe6e9" opacity="0.2"/>
              </pattern>

              {/* Paper Texture for Land */}
              <filter id="paperTexture">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" result="noise"/>
                <feDiffuseLighting in="noise" lightingColor="#fff" surfaceScale="2" result="light">
                  <feDistantLight azimuth="45" elevation="60"/>
                </feDiffuseLighting>
                <feComposite operator="in" in="light" in2="SourceGraphic" result="textured"/>
                <feBlend in="textured" in2="SourceGraphic" mode="multiply"/>
              </filter>

              {/* Paper Texture for Ocean - Smoother, different scale */}
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

              <filter id="dropShadow">
                <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.5"/>
              </filter>
          </defs>

          <g ref={gRef}>
            {/* Ocean Background with Paper Texture */}
            <rect 
                x={-OCEAN_BUFFER} 
                y={-OCEAN_BUFFER} 
                width={WORLD_WIDTH + OCEAN_BUFFER * 2} 
                height={WORLD_HEIGHT + OCEAN_BUFFER * 2} 
                fill={getOceanColor()} 
                filter="url(#oceanPaperTexture)"
                style={{ transition: 'fill 10s ease-in-out' }}
            />

            {worldData?.distantLands?.map((land) => (
                <path key={land.id} d={land.path} fill="#0f2231" stroke="none" opacity="0.7" style={{ pointerEvents: 'none' }}/>
            ))}

            <g style={{ pointerEvents: 'none' }}>
              {/* Edge Warning Markers */}
              <path d={`M-400 ${centerY} L-200 ${centerY}`} stroke="#3d5a6c" strokeWidth="2" strokeDasharray="10 5" opacity="0.3" />
              <path d={`M${WORLD_WIDTH + 200} ${centerY} L${WORLD_WIDTH + 400} ${centerY}`} stroke="#3d5a6c" strokeWidth="2" strokeDasharray="10 5" opacity="0.3" />
              <path d={`M${centerX} -300 L${centerX} -100`} stroke="#3d5a6c" strokeWidth="2" strokeDasharray="10 5" opacity="0.3" />
              <path d={`M${centerX} ${WORLD_HEIGHT + 100} L${centerX} ${WORLD_HEIGHT + 300}`} stroke="#3d5a6c" strokeWidth="2" strokeDasharray="10 5" opacity="0.3" />

              <text x={centerX} y={-200} textAnchor="middle" fill="#3d5a6c" fontSize="32" fontStyle="italic" fontFamily="'Cinzel', serif" opacity="0.5">The Northern Wastes</text>
              <text x={centerX} y={WORLD_HEIGHT + 200} textAnchor="middle" fill="#3d5a6c" fontSize="32" fontStyle="italic" fontFamily="'Cinzel', serif" opacity="0.5">The Southern Abyss</text>
              <text x={-300} y={centerY} textAnchor="middle" fill="#3d5a6c" fontSize="32" fontStyle="italic" fontFamily="'Cinzel', serif" opacity="0.5" transform={`rotate(-90, ${-300}, ${centerY})`}>The Western Void</text>
              <text x={WORLD_WIDTH + 300} y={centerY} textAnchor="middle" fill="#3d5a6c" fontSize="32" fontStyle="italic" fontFamily="'Cinzel', serif" opacity="0.5" transform={`rotate(90, ${WORLD_WIDTH + 300}, ${centerY})`}>The Eastern Expanse</text>
            </g>

            {worldData && (
              <>
                <g filter="url(#paperTexture)">
                  {worldData.kingdoms.map(k => (
                    <path
                      key={`kingdom-${k.id}`}
                      d={k.svgPath || ''}
                      fill={getSeasonColor(k.color)}
                      stroke={warMode && attackerKingdomId === k.id ? '#fff' : 'none'}
                      strokeWidth={warMode && attackerKingdomId === k.id ? 3 : 0}
                      opacity={hoveredKingdom?.id === k.id || attackerKingdomId === k.id ? 1 : 0.9}
                      style={{ transition: 'fill 8s ease-in-out 1s, opacity 0.2s', cursor: warMode ? 'pointer' : 'default' }}
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
                  const getSummerFill = () => {
                    if (biome === 'MOUNTAIN') return 'url(#mountainPattern)';
                    if (biome === 'FOREST') return 'url(#forestPatternSummer)';
                    if (biome === 'SNOW') return 'url(#snowPattern)';
                    return 'transparent';
                  };
                  
                  const getWinterFill = () => {
                    if (biome === 'MOUNTAIN') return 'url(#mountainPatternWinter)';
                    if (biome === 'FOREST') return 'url(#forestPatternWinter)';
                    if (biome === 'SNOW') return 'url(#groundSnowPattern)';
                    if (biome === 'PLAIN') return 'url(#groundSnowPattern)';
                    return 'transparent';
                  };

                  return (
                    <React.Fragment key={`biome-group-${biome}`}>
                      {/* Summer Layer - fades out in winter */}
                      <path
                          d={path}
                          fill={getSummerFill()}
                          opacity={season === 'WINTER' ? 0 : 0.7}
                          stroke="none"
                          style={{ pointerEvents: 'none', transition: 'opacity 6s ease-in-out' }}
                      />
                      {/* Winter Layer - fades in */}
                      <path
                          d={path}
                          fill={getWinterFill()}
                          opacity={season === 'WINTER' ? 0.8 : 0}
                          stroke="none"
                          style={{ pointerEvents: 'none', transition: 'opacity 6s ease-in-out 2s' }}
                      />
                    </React.Fragment>
                  );
                })}

                {worldData.kingdoms.map(k => (
                  <path
                    key={`border-${k.id}`}
                    d={k.svgPath || ''}
                    fill="none"
                    stroke={k.borderColor}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    filter="url(#dropShadow)"
                    style={{ pointerEvents: 'none' }}
                  />
                ))}

                <path d={worldData.coastlinePath || ''} fill="none" stroke="#1b3a4b" strokeWidth={3} opacity={0.8} style={{ pointerEvents: 'none' }}/>
                <path d={worldData.coastlinePath || ''} fill="none" stroke="#5d8aa8" strokeWidth={1} opacity={0.5} style={{ pointerEvents: 'none' }}/>

                {allPOIs.map(poi => {
                  const isCapital = poi.type === 'capital';
                  const isHovered = hoveredPOI?.id === poi.id;
                  const kingdom = getKingdomByPOI(poi);
                  const size = isCapital ? 12 : 8;
                  const { x, y } = poi.position;

                  return (
                    <g 
                      key={poi.id}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredPOI(poi)}
                      onMouseLeave={() => setHoveredPOI(null)}
                      onClick={(e) => { e.stopPropagation(); handlePOIClick(poi); }}
                      filter={isHovered ? "url(#glow)" : undefined}
                    >
                      {isCapital ? (
                        <polygon points={generateStarPoints(x, y, size, size / 2, 8)} fill="#ffd700" stroke="#8b6914" strokeWidth={2}/>
                      ) : (
                        <circle cx={x} cy={y} r={size} fill={kingdom?.color || '#ddd'} stroke="#463f3a" strokeWidth={2}/>
                      )}
                      <text x={x} y={y - size - 6} textAnchor="middle" fill="#f8f9fa" fontSize={isCapital ? 13 : 10} fontWeight={isCapital ? 'bold' : 'normal'}
                        style={{ textShadow: '1px 1px 2px black, -1px -1px 2px black', pointerEvents: 'none', fontFamily: "'Cinzel', serif" }}>
                        {poi.name}
                      </text>
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
                      {/* Pulsing Outer Ring */}
                      <circle r="22" fill="none" stroke={reticleColor} strokeWidth="2" strokeDasharray="4 2" opacity="0.8" style={{ transition: 'stroke 1s ease-in-out' }}>
                         <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="8s" repeatCount="indefinite"/>
                      </circle>
                      {/* Pulsing Inner Circle */}
                      <circle r="26" fill="none" stroke={reticleColor} strokeWidth="1" opacity="0.6" style={{ transition: 'stroke 1s ease-in-out' }}>
                         <animate attributeName="r" values="24;28;24" dur="2s" repeatCount="indefinite"/>
                         <animate attributeName="opacity" values="0.6;0.3;0.6" dur="2s" repeatCount="indefinite"/>
                      </circle>
                      {/* Target Reticle Lines */}
                      <line x1="-30" y1="0" x2="-20" y2="0" stroke={reticleColor} strokeWidth="2" opacity="0.8" style={{ transition: 'stroke 1s ease-in-out' }} />
                      <line x1="20" y1="0" x2="30" y2="0" stroke={reticleColor} strokeWidth="2" opacity="0.8" style={{ transition: 'stroke 1s ease-in-out' }} />
                      <line x1="0" y1="-30" x2="0" y2="-20" stroke={reticleColor} strokeWidth="2" opacity="0.8" style={{ transition: 'stroke 1s ease-in-out' }} />
                      <line x1="0" y1="20" x2="0" y2="30" stroke={reticleColor} strokeWidth="2" opacity="0.8" style={{ transition: 'stroke 1s ease-in-out' }} />
                   </g>
                 );
                })()}
              </>
            )}
            {/* World Boundary Fog - Moves with the map */}
            <g style={{ pointerEvents: 'none' }}>
               {/* North Fog - Starts solid at -600, fades to transparent at 0 */}
               <rect x={-OCEAN_BUFFER} y={-OCEAN_BUFFER} width={WORLD_WIDTH + OCEAN_BUFFER*2} height={OCEAN_BUFFER - 600} fill={season === 'WINTER' ? '#0b1622' : '#050a10'} />
               <rect x={-OCEAN_BUFFER} y={-600} width={WORLD_WIDTH + OCEAN_BUFFER*2} height={600} fill="url(#fogNorth)" />

               {/* South Fog - Starts transparent at WORLD_HEIGHT, becomes solid at +600 */}
               <rect x={-OCEAN_BUFFER} y={WORLD_HEIGHT + 600} width={WORLD_WIDTH + OCEAN_BUFFER*2} height={OCEAN_BUFFER} fill={season === 'WINTER' ? '#0b1622' : '#050a10'} />
               <rect x={-OCEAN_BUFFER} y={WORLD_HEIGHT} width={WORLD_WIDTH + OCEAN_BUFFER*2} height={600} fill="url(#fogSouth)" />

               {/* West Fog - Starts solid at -600, fades to transparent at 0 */}
               <rect x={-OCEAN_BUFFER} y={-OCEAN_BUFFER} width={OCEAN_BUFFER - 600} height={WORLD_HEIGHT + OCEAN_BUFFER*2} fill={season === 'WINTER' ? '#0b1622' : '#050a10'} />
               <rect x={-600} y={-OCEAN_BUFFER} width={600} height={WORLD_HEIGHT + OCEAN_BUFFER*2} fill="url(#fogWest)" />

               {/* East Fog - Starts transparent at WORLD_WIDTH, becomes solid at +600 */}
               <rect x={WORLD_WIDTH + 600} y={-OCEAN_BUFFER} width={OCEAN_BUFFER} height={WORLD_HEIGHT + OCEAN_BUFFER*2} fill={season === 'WINTER' ? '#0b1622' : '#050a10'} />
               <rect x={WORLD_WIDTH} y={-OCEAN_BUFFER} width={600} height={WORLD_HEIGHT + OCEAN_BUFFER*2} fill="url(#fogEast)" />
            </g>
          </g>
          
          <g transform={`translate(${VIEWPORT_WIDTH - 80}, ${80})`} style={{ pointerEvents: 'none' }} opacity="0.8">
            <circle cx="0" cy="0" r="35" fill="rgba(13, 27, 42, 0.8)" stroke="#5d8aa8" strokeWidth="1"/>
            <circle cx="0" cy="0" r="30" fill="none" stroke="#5d8aa8" strokeWidth="0.5"/>
            <path d="M0 -25 L5 -10 L0 -15 L-5 -10 Z" fill="#c9ada7"/>
            <path d="M0 25 L5 10 L0 15 L-5 10 Z" fill="#5d8aa8"/>
            <path d="M25 0 L10 5 L15 0 L10 -5 Z" fill="#5d8aa8"/>
            <path d="M-25 0 L-10 5 L-15 0 L-10 -5 Z" fill="#5d8aa8"/>
            <text x="0" y="-38" textAnchor="middle" fill="#c9ada7" fontSize="10" fontWeight="bold">N</text>
          </g>
          
          {/* World Borders Vignette - Fixed relative to viewport (not zoomed) */}
          {/* Note: SVG masks/gradients inside zoom group scale with map. To make a static vignette, we need it outside the zoom group or handle it via CSS overlay. 
              The CSS overlay already exists at the bottom of the component. I will enhance it. */}
        </svg>

        {/* Enhanced Vignette / Border Effect */}
        <div style={{ 
            position: 'absolute', 
            inset: 0, 
            background: 'radial-gradient(circle at center, transparent 50%, rgba(5, 10, 15, 0.3) 100%)', 
            pointerEvents: 'none',
            zIndex: 5
        }}/>
        
        {/* Ancient border markings - corners */}
        <div style={{ position: 'absolute', top: 20, left: 20, width: 100, height: 100, borderTop: '2px solid #3d5a6c', borderLeft: '2px solid #3d5a6c', opacity: 0.3, pointerEvents: 'none', zIndex: 5 }} />
        <div style={{ position: 'absolute', top: 20, right: 20, width: 100, height: 100, borderTop: '2px solid #3d5a6c', borderRight: '2px solid #3d5a6c', opacity: 0.3, pointerEvents: 'none', zIndex: 5 }} />
        <div style={{ position: 'absolute', bottom: 20, left: 20, width: 100, height: 100, borderBottom: '2px solid #3d5a6c', borderLeft: '2px solid #3d5a6c', opacity: 0.3, pointerEvents: 'none', zIndex: 5 }} />
        <div style={{ position: 'absolute', bottom: 20, right: 20, width: 100, height: 100, borderBottom: '2px solid #3d5a6c', borderRight: '2px solid #3d5a6c', opacity: 0.3, pointerEvents: 'none', zIndex: 5 }} />

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
