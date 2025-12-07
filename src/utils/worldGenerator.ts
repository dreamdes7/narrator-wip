import * as d3 from 'd3';
import { createNoise2D } from 'simplex-noise';
import polygonClipping from 'polygon-clipping';
import type { 
  WorldData, WorldGenConfig, Kingdom, POI, Point2D, BiomeType, 
  WorldDataJSON, DistantLand, CellData, ClimateZone
} from '../types/world';

// --- Name Banks ---
const KINGDOM_NAMES_NORTH = [
  "Frostmere", "Winterhold", "Starkhaven", "Icevein", "Glaciera", "Northgard"
];

const KINGDOM_NAMES_SOUTH = [
  "Sunspire", "Sandstone", "Oasis", "Dunehaven", "Solara", "Vermilion", "Goldcoast"
];

const KINGDOM_NAMES_CENTRAL = [
  "Eldoria", "Mythralis", "Shadowfen", "Auroria", "Ironvale", "Thornwood", "Ravenmoor", "Highgarden", "Riverrun"
];

const CITY_NAMES = [
  "Ravenshollow", "Ironforge", "Moonhaven", "Thornwick", "Crystalspire",
  "Dragonmere", "Willowdale", "Stonebridge", "Mistwood", "Goldcrest",
  "Silverkeep", "Ashford", "Blackwater", "Redcliff", "Greendale",
  "Frostfall", "Emberhearth", "Windshear", "Oakheart", "Starfall",
  "Duskhollow", "Brightwater", "Shadowmere", "Thunderpeak", "Silentwood"
];

// Climate-appropriate color palettes
const KINGDOM_COLORS_NORTH = [
  { fill: "#a8d5e5", border: "#5a9ab8" },  // Ice blue
  { fill: "#b8c5d6", border: "#7a8fa6" },  // Steel grey
  { fill: "#c4d4e0", border: "#8ba3b8" },  // Frost
  { fill: "#9fb8c7", border: "#6890a5" },  // Slate blue
  { fill: "#d1dfe8", border: "#9ab5c7" },  // Pale winter
];

const KINGDOM_COLORS_CENTRAL = [
  { fill: "#a5a58d", border: "#6b705c" },  // Olive
  { fill: "#b7b7a4", border: "#7f7f6f" },  // Sage
  { fill: "#c9ada7", border: "#9a8c98" },  // Dusty rose
  { fill: "#caffbf", border: "#80b268" },  // Spring green
  { fill: "#b5838d", border: "#6d6875" },  // Mauve
  { fill: "#a8c5a0", border: "#6b8e63" },  // Forest
];

const KINGDOM_COLORS_SOUTH = [
  { fill: "#f4d58d", border: "#c9a227" },  // Golden sand
  { fill: "#ddbea9", border: "#a5a58d" },  // Desert tan
  { fill: "#ffd6a5", border: "#d4a373" },  // Amber
  { fill: "#e8c49a", border: "#b8956a" },  // Terracotta light
  { fill: "#f0c987", border: "#c9a54a" },  // Sunlit gold
];

// --- Internal Cell Type ---
interface Cell {
  index: number;
  center: Point2D;
  polygon: [number, number][];
  height: number;
  isWater: boolean;
  biome: BiomeType;
  kingdomId: number | null;
  neighbors: number[];
}

// --- Continent Shape Parameters ---
interface ContinentShape {
  centerX: number;
  centerY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  peninsulas: { angle: number; length: number; width: number }[];
}

// --- Helper: Get Climate Zone by Latitude ---
function getClimateZone(y: number, height: number): ClimateZone {
    if (y < height * 0.35) return 'NORTH';
    if (y > height * 0.70) return 'SOUTH';
    return 'CENTRAL';
}

// --- Main Generator ---
export function generateWorld(config: WorldGenConfig): WorldData {
  const { width, height, numKingdoms, numPoints, numCitiesPerKingdom } = config;
  const seed = config.seed ?? Math.floor(Math.random() * 1000000);
  
  let rngState = seed;
  const random = () => {
    rngState = (rngState * 1664525 + 1013904223) % 4294967296;
    return rngState / 4294967296;
  };

  const noise2D = createNoise2D(() => random());
  const continentShape = generateContinentShape(width, height, random);

  // 1. Generate & Relax Points
  let points: [number, number][] = Array.from({ length: numPoints }, () => [
    random() * width,
    random() * height
  ]);

  for (let i = 0; i < 2; i++) {
    const delaunay = d3.Delaunay.from(points);
    const voronoi = delaunay.voronoi([0, 0, width, height]);
    points = points.map((_, idx) => {
      const polygon = voronoi.cellPolygon(idx);
      if (!polygon) return points[idx];
      const centroid = d3.polygonCentroid(polygon);
      return [centroid[0], centroid[1]];
    });
  }

  const delaunay = d3.Delaunay.from(points);
  const voronoi = delaunay.voronoi([0, 0, width, height]);

  const cells: Cell[] = [];
  const landIndices: number[] = [];

  // 2. Terrain Generation
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    
    const elevation = calculateElevation(x, y, continentShape, noise2D, width, height);
    const isWater = elevation < 0.25;

    // Biome Logic based on Latitude AND Noise
    let biome: BiomeType = 'OCEAN';
    
    // Normalize Y for latitude logic (0 at top/north, 1 at bottom/south)
    const normalizedY = y / height;
    
    if (isWater) {
       if (elevation < 0.20) biome = 'OCEAN';
       else if (elevation < 0.25) biome = 'SHALLOW';
    } else {
       if (elevation < 0.30) biome = 'BEACH';
       else if (elevation > 0.58) biome = 'HILLS';    // Highlands/foothills
       else {
           // Climate-based biomes
           if (normalizedY < 0.25) {
               // Far North - snowy
               if (elevation > 0.45) biome = 'SNOW';
               else if (elevation > 0.38) biome = 'FOREST'; // Taiga
               else biome = 'PLAIN'; // Tundra plains
           } else if (normalizedY > 0.75) {
               // Far South - arid
               if (elevation > 0.48) biome = 'HILLS'; // Desert hills
               else biome = 'PLAIN'; // Savanna/desert
           } else {
               // Central temperate
               if (elevation > 0.50) biome = 'FOREST';
               else if (elevation > 0.40) biome = random() > 0.5 ? 'FOREST' : 'PLAIN'; // Mixed
               else biome = 'PLAIN';
           }
       }
    }

    const cellPolygon = voronoi.cellPolygon(i);
    const polygon: [number, number][] = cellPolygon ? cellPolygon.map(p => [p[0], p[1]]) : [];

    cells.push({
      index: i,
      center: { x: points[i][0], y: points[i][1] },
      polygon,
      height: elevation,
      isWater,
      biome,
      kingdomId: null,
      neighbors: Array.from(voronoi.neighbors(i))
    });

    if (!isWater) landIndices.push(i);
  }

  // 3. Kingdom Assignment
  const capitalIndices: number[] = [];
  
  for (let k = 0; k < numKingdoms; k++) {
    let bestIdx = -1;
    let maxMinDist = -1;

    for (let attempt = 0; attempt < 50; attempt++) {
      const rndIdx = landIndices[Math.floor(random() * landIndices.length)];
      if (capitalIndices.includes(rndIdx)) continue;
      if (cells[rndIdx].biome === 'BEACH' || cells[rndIdx].biome === 'MOUNTAIN' || cells[rndIdx].biome === 'OCEAN') continue;

      let minDist = Infinity;
      for (const capIdx of capitalIndices) {
        const dx = cells[capIdx].center.x - cells[rndIdx].center.x;
        const dy = cells[capIdx].center.y - cells[rndIdx].center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) minDist = dist;
      }
      if (capitalIndices.length === 0) minDist = Infinity;
      if (minDist > maxMinDist) {
        maxMinDist = minDist;
        bestIdx = rndIdx;
      }
    }

    if (bestIdx === -1) {
      bestIdx = landIndices[Math.floor(random() * landIndices.length)];
    }

    capitalIndices.push(bestIdx);
    cells[bestIdx].kingdomId = k;
  }

  let queue = capitalIndices.map((idx, k) => ({ idx, kId: k }));
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  while (queue.length > 0) {
    const rI = Math.floor(random() * queue.length);
    const { idx, kId } = queue[rI];
    queue.splice(rI, 1);

    const cell = cells[idx];
    for (const nIdx of cell.neighbors) {
      const neighbor = cells[nIdx];
      if (!neighbor.isWater && neighbor.kingdomId === null) {
        neighbor.kingdomId = kId;
        queue.push({ idx: nIdx, kId });
      }
    }
  }

  // Calculate continent bounds
  let continentMinX = Infinity, continentMinY = Infinity;
  let continentMaxX = -Infinity, continentMaxY = -Infinity;
  let totalLandArea = 0;
  let landCentroidX = 0, landCentroidY = 0;
  let landCellCount = 0;

  for (const cell of cells) {
    if (!cell.isWater) {
      continentMinX = Math.min(continentMinX, cell.center.x);
      continentMinY = Math.min(continentMinY, cell.center.y);
      continentMaxX = Math.max(continentMaxX, cell.center.x);
      continentMaxY = Math.max(continentMaxY, cell.center.y);
      landCentroidX += cell.center.x;
      landCentroidY += cell.center.y;
      landCellCount++;
    }
  }

  const actualContinentCenterX = landCentroidX / (landCellCount || 1);
  const actualContinentCenterY = landCentroidY / (landCellCount || 1);

  // 4. Build Kingdoms
  const kingdoms: Kingdom[] = [];
  let cityNameIdx = 0;

  for (let k = 0; k < numKingdoms; k++) {
    const kingdomCellIds = cells.filter(c => c.kingdomId === k).map(c => c.index);
    const kingdomCells = cells.filter(c => c.kingdomId === k && c.polygon.length >= 3);
    if (kingdomCells.length === 0) continue;

    const svgPath = computeKingdomPath(kingdomCellIds, cells);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let centroidX = 0, centroidY = 0;
    const biomeCounts: Partial<Record<BiomeType, number>> = {};

    for (const cell of kingdomCells) {
      minX = Math.min(minX, cell.center.x);
      minY = Math.min(minY, cell.center.y);
      maxX = Math.max(maxX, cell.center.x);
      maxY = Math.max(maxY, cell.center.y);
      centroidX += cell.center.x;
      centroidY += cell.center.y;
      biomeCounts[cell.biome] = (biomeCounts[cell.biome] || 0) + 1;
    }

    centroidX /= kingdomCells.length;
    centroidY /= kingdomCells.length;
    const area = kingdomCells.length;
    totalLandArea += area;

    let dominantBiome: BiomeType = 'PLAIN';
    let maxCount = 0;
    for (const [biome, count] of Object.entries(biomeCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantBiome = biome as BiomeType;
      }
    }

    // --- Determine Climate Zone ---
    const climateZone = getClimateZone(centroidY, height);

    // --- Select Name based on Climate ---
    let name = "";
    if (climateZone === 'NORTH') {
        name = KINGDOM_NAMES_NORTH[Math.floor(random() * KINGDOM_NAMES_NORTH.length)];
    } else if (climateZone === 'SOUTH') {
        name = KINGDOM_NAMES_SOUTH[Math.floor(random() * KINGDOM_NAMES_SOUTH.length)];
    } else {
        name = KINGDOM_NAMES_CENTRAL[Math.floor(random() * KINGDOM_NAMES_CENTRAL.length)];
    }
    // Fallback if random picks collide
    if (kingdoms.some(k => k.name === name)) {
        name = name + " II";
    }

    // Analyze neighbors
    const neighborSet = new Set<number>();
    let hasCoast = false;
    for (const cell of kingdomCells) {
      for (const nIdx of cell.neighbors) {
        const neighbor = cells[nIdx];
        if (neighbor.kingdomId !== null && neighbor.kingdomId !== k) {
          neighborSet.add(neighbor.kingdomId);
        }
        if (neighbor.isWater) hasCoast = true;
      }
    }

    const capitalCell = cells[capitalIndices[k]];
    const capital: POI = {
      id: `capital-${k}`,
      name: name,
      type: 'capital',
      position: { x: Math.round(capitalCell.center.x), y: Math.round(capitalCell.center.y) },
      kingdomId: k,
      description: `The grand capital of ${name}`,
      climate: getClimateZone(capitalCell.center.y, height),
      biome: capitalCell.biome
    };

    const cities: POI[] = [];
    const sortedByDist = [...kingdomCells]
      // Allow cities everywhere except high peaks (MOUNTAIN) and water edges (BEACH)
      // HILLS, FOREST, PLAIN, SNOW are all valid for settlements
      .filter(c => c.index !== capitalIndices[k] && c.biome !== 'MOUNTAIN' && c.biome !== 'BEACH' && c.biome !== 'OCEAN' && c.biome !== 'SHALLOW')
      .sort((a, b) => {
        const dA = Math.sqrt((a.center.x - capitalCell.center.x) ** 2 + (a.center.y - capitalCell.center.y) ** 2);
        const dB = Math.sqrt((b.center.x - capitalCell.center.x) ** 2 + (b.center.y - capitalCell.center.y) ** 2);
        return dB - dA;
      });

    for (let i = 0; i < numCitiesPerKingdom && sortedByDist.length > 0; i++) {
      const step = Math.max(1, Math.floor(sortedByDist.length / (numCitiesPerKingdom + 1)));
      const cityCell = sortedByDist[Math.min(i * step, sortedByDist.length - 1)];
      if (cityCell) {
        cities.push({
          id: `city-${k}-${i}`,
          name: CITY_NAMES[cityNameIdx++ % CITY_NAMES.length],
          type: 'city',
          position: { x: Math.round(cityCell.center.x), y: Math.round(cityCell.center.y) },
          kingdomId: k,
          climate: getClimateZone(cityCell.center.y, height),
          biome: cityCell.biome
        });
      }
    }

    // Select color palette based on climate zone
    const colorPalette = climateZone === 'NORTH' ? KINGDOM_COLORS_NORTH :
                         climateZone === 'SOUTH' ? KINGDOM_COLORS_SOUTH :
                         KINGDOM_COLORS_CENTRAL;
    const colorIndex = Math.floor(random() * colorPalette.length);

    kingdoms.push({
      id: k,
      name,
      color: colorPalette[colorIndex].fill,
      borderColor: colorPalette[colorIndex].border,
      capital,
      cities,
      geography: {
        centroid: { x: Math.round(centroidX), y: Math.round(centroidY) },
        bounds: {
          minX: Math.round(minX), minY: Math.round(minY),
          maxX: Math.round(maxX), maxY: Math.round(maxY),
          width: Math.round(maxX - minX), height: Math.round(maxY - minY)
        },
        area,
        neighboringKingdoms: Array.from(neighborSet),
        hasCoastline: hasCoast,
        dominantBiome,
        climateZone 
      },
      svgPath,
      cellIds: kingdomCellIds
    });
  }

  // 5. Distant Lands - INCREASED DISTANCE
  const distantLands = generateDistantLands(
    width, height, 
    actualContinentCenterX, actualContinentCenterY,
    continentMaxX - continentMinX,
    continentMaxY - continentMinY,
    random, noise2D
  );

  // 6. Rendering Paths
  const landCells = cells.filter(c => !c.isWater && c.polygon.length >= 3);
  let coastlineMerged: polygonClipping.MultiPolygon = [];
  if (landCells.length > 0) {
    coastlineMerged = [[landCells[0].polygon]];
    for (let i = 1; i < landCells.length; i++) {
      try {
        coastlineMerged = polygonClipping.union(coastlineMerged, [[landCells[i].polygon]]);
      } catch { /* skip */ }
    }
  }
  const coastlinePath = multiPolygonToSVGPath(coastlineMerged);

  const biomePaths: { biome: BiomeType; path: string }[] = [];
  const biomeGroups: Partial<Record<BiomeType, Cell[]>> = {};
  cells.forEach(c => {
    if (!biomeGroups[c.biome]) biomeGroups[c.biome] = [];
    biomeGroups[c.biome]!.push(c);
  });

  for (const biome of ['HILLS', 'FOREST', 'SNOW'] as BiomeType[]) {
    const validCells = (biomeGroups[biome] || []).filter(c => c.polygon.length >= 3);
    if (validCells.length > 0) {
      let merged: polygonClipping.MultiPolygon = [[validCells[0].polygon]];
      for (let i = 1; i < validCells.length; i++) {
        try {
          merged = polygonClipping.union(merged, [[validCells[i].polygon]]);
        } catch { /* skip */ }
      }
      biomePaths.push({ biome, path: multiPolygonToSVGPath(merged) });
    }
  }

  // Convert cells to CellData for export
  const exportCells: CellData[] = cells.map(c => ({
    id: c.index,
    center: c.center,
    polygon: c.polygon,
    isWater: c.isWater,
    biome: c.biome,
    kingdomId: c.kingdomId,
    neighbors: c.neighbors
  }));

  return {
    seed,
    width,
    height,
    viewportWidth: width,
    viewportHeight: height,
    kingdoms,
    cells: exportCells,
    distantLands,
    geography: {
      totalLandArea,
      continentBounds: {
        minX: Math.round(continentMinX), minY: Math.round(continentMinY),
        maxX: Math.round(continentMaxX), maxY: Math.round(continentMaxY),
        width: Math.round(continentMaxX - continentMinX), height: Math.round(continentMaxY - continentMinY)
      },
      continentCentroid: {
        x: Math.round(actualContinentCenterX),
        y: Math.round(actualContinentCenterY)
      }
    },
    coastlinePath,
    biomePaths
  };
}

// --- Internal Cell to CellData converter ---
interface CellLike {
  polygon: [number, number][];
}

// --- Compute Kingdom Path (exported for war updates) ---
export function computeKingdomPath(cellIds: number[], cells: CellLike[]): string {
  const validCells = cellIds
    .map(id => cells[id])
    .filter(c => c && c.polygon.length >= 3);
  
  if (validCells.length === 0) return '';
  
  let merged: polygonClipping.MultiPolygon = [[validCells[0].polygon]];
  for (let i = 1; i < validCells.length; i++) {
    try {
      merged = polygonClipping.union(merged, [[validCells[i].polygon]]);
    } catch { /* skip */ }
  }
  
  return multiPolygonToSVGPath(merged);
}

// --- Continent Shape Generator ---
function generateContinentShape(width: number, height: number, random: () => number): ContinentShape {
  const offsetX = (random() - 0.5) * width * 0.15;
  const offsetY = (random() - 0.5) * height * 0.15;
  
  const aspectType = random();
  let scaleX: number, scaleY: number;
  
  if (aspectType < 0.3) {
    scaleX = 1.1 + random() * 0.4;
    scaleY = 0.6 + random() * 0.3;
  } else if (aspectType < 0.6) {
    scaleX = 0.6 + random() * 0.3;
    scaleY = 1.1 + random() * 0.4;
  } else {
    const base = 0.85 + random() * 0.3;
    scaleX = base + (random() - 0.5) * 0.2;
    scaleY = base + (random() - 0.5) * 0.2;
  }
  
  const rotation = random() * Math.PI * 2;
  
  const numPeninsulas = 1 + Math.floor(random() * 4);
  const peninsulas: { angle: number; length: number; width: number }[] = [];
  
  for (let i = 0; i < numPeninsulas; i++) {
    peninsulas.push({
      angle: random() * Math.PI * 2,
      length: 0.15 + random() * 0.25,
      width: 0.1 + random() * 0.15
    });
  }
  
  return { centerX: width / 2 + offsetX, centerY: height / 2 + offsetY, scaleX, scaleY, rotation, peninsulas };
}

// --- Elevation Calculator ---
function calculateElevation(
  x: number, y: number, 
  shape: ContinentShape, 
  noise2D: (x: number, y: number) => number,
  width: number, height: number
): number {
  let dx = x - shape.centerX;
  let dy = y - shape.centerY;
  
  const cos = Math.cos(-shape.rotation);
  const sin = Math.sin(-shape.rotation);
  const rdx = dx * cos - dy * sin;
  const rdy = dx * sin + dy * cos;
  
  const sdx = rdx / (shape.scaleX * width * 0.35);
  const sdy = rdy / (shape.scaleY * height * 0.35);
  
  let baseDist = Math.sqrt(sdx * sdx + sdy * sdy);
  
  for (const peninsula of shape.peninsulas) {
    const pAngle = Math.atan2(dy, dx);
    const angleDiff = Math.abs(normalizeAngle(pAngle - peninsula.angle));
    
    if (angleDiff < peninsula.width * Math.PI) {
      const influence = 1 - (angleDiff / (peninsula.width * Math.PI));
      const extension = peninsula.length * influence;
      baseDist = baseDist * (1 - extension * 0.8);
    }
  }
  
  const nx = (x / width - 0.5) * 2;
  const ny = (y / height - 0.5) * 2;
  
  const n1 = noise2D(nx * 2, ny * 2);
  const n2 = noise2D(nx * 4, ny * 4) * 0.5;
  const n3 = noise2D(nx * 8, ny * 8) * 0.25;
  const n = (n1 + n2 + n3) / 1.75;
  
  let elevation = (n + 1) / 2;
  const falloff = 1 - Math.pow(Math.min(baseDist, 1.2), 1.8);
  elevation = elevation * Math.max(0, falloff);
  
  const edgeMargin = 50;
  const edgeFalloff = Math.min(x / edgeMargin, y / edgeMargin, (width - x) / edgeMargin, (height - y) / edgeMargin, 1);
  elevation *= Math.max(0, Math.min(1, edgeFalloff));
  
  return elevation;
}

function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

// --- Distant Lands Generator (INCREASED DISTANCE) ---
function generateDistantLands(
  _width: number, _height: number,
  continentCenterX: number, continentCenterY: number,
  continentWidth: number, continentHeight: number,
  random: () => number,
  noise2D: (x: number, y: number) => number
): DistantLand[] {
  const distantLands: DistantLand[] = [];
  
  const continentRadius = Math.max(continentWidth, continentHeight) / 2;
  // INCREASED: minimum 400px from continent edge (was 200)
  const minDistance = continentRadius + 400;
  const maxDistance = continentRadius + 1000;
  
  const numMajorLands = 3 + Math.floor(random() * 3);
  const usedAngles: number[] = [];
  
  for (let i = 0; i < numMajorLands; i++) {
    let angle: number;
    let attempts = 0;
    do {
      angle = random() * Math.PI * 2;
      attempts++;
    } while (
      attempts < 20 && 
      usedAngles.some(a => Math.abs(normalizeAngle(a - angle)) < Math.PI / 4)
    );
    usedAngles.push(angle);
    
    const distance = minDistance + random() * (maxDistance - minDistance);
    
    const cx = continentCenterX + Math.cos(angle) * distance;
    const cy = continentCenterY + Math.sin(angle) * distance;
    
    const sizeMultiplier = 0.5 + random() * 1.5;
    const baseSize = 150 * sizeMultiplier;
    
    const path = generateLandmassPath(cx, cy, baseSize, random, noise2D, 'major');
    
    distantLands.push({
      id: `distant-major-${i}`,
      path,
      position: { x: cx, y: cy }
    });
    
    if (random() > 0.4) {
      const numSatellites = 1 + Math.floor(random() * 3);
      for (let j = 0; j < numSatellites; j++) {
        const satAngle = angle + (random() - 0.5) * Math.PI / 2;
        const satDist = distance + (random() - 0.3) * 200;
        const satX = continentCenterX + Math.cos(satAngle) * satDist;
        const satY = continentCenterY + Math.sin(satAngle) * satDist;
        const satSize = 30 + random() * 60;
        
        const satPath = generateLandmassPath(satX, satY, satSize, random, noise2D, 'island');
        
        distantLands.push({
          id: `distant-island-${i}-${j}`,
          path: satPath,
          position: { x: satX, y: satY }
        });
      }
    }
  }
  
  const numScatteredIslands = 5 + Math.floor(random() * 8);
  for (let i = 0; i < numScatteredIslands; i++) {
    const angle = random() * Math.PI * 2;
    // Scattered islands also further out
    const distance = minDistance * 0.9 + random() * (maxDistance * 1.2 - minDistance * 0.9);
    
    const ix = continentCenterX + Math.cos(angle) * distance;
    const iy = continentCenterY + Math.sin(angle) * distance;
    const iSize = 15 + random() * 40;
    
    const iPath = generateLandmassPath(ix, iy, iSize, random, noise2D, 'tiny');
    
    distantLands.push({
      id: `distant-scatter-${i}`,
      path: iPath,
      position: { x: ix, y: iy }
    });
  }
  
  return distantLands;
}

function generateLandmassPath(
  cx: number, cy: number, 
  baseRadius: number, 
  random: () => number,
  noise2D: (x: number, y: number) => number,
  type: 'major' | 'island' | 'tiny'
): string {
  const points: [number, number][] = [];
  const steps = type === 'major' ? 24 : type === 'island' ? 16 : 10;
  
  const elongation = type === 'major' ? 0.6 + random() * 0.8 : 0.8 + random() * 0.4;
  const elongAngle = random() * Math.PI;
  
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    
    const cos = Math.cos(theta - elongAngle);
    const sin = Math.sin(theta - elongAngle);
    const stretchedR = baseRadius * Math.sqrt(
      1 / (cos * cos / (elongation * elongation) + sin * sin)
    );
    
    const noiseVal = noise2D(cx / 200 + Math.cos(theta) * 2, cy / 200 + Math.sin(theta) * 2);
    const variation = type === 'major' ? 0.3 : type === 'island' ? 0.25 : 0.2;
    const r = stretchedR * (1 + noiseVal * variation);
    
    points.push([cx + Math.cos(theta) * r, cy + Math.sin(theta) * r]);
  }
  
  const lineGen = d3.line().curve(d3.curveBasisClosed);
  return lineGen(points) || '';
}

function multiPolygonToSVGPath(mp: polygonClipping.MultiPolygon): string {
  return mp.map(poly => {
    return poly.map((ring) => {
      return `M ${ring.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L ')} Z`;
    }).join(' ');
  }).join(' ');
}

export function worldToJSON(world: WorldData): WorldDataJSON {
  return {
    seed: world.seed,
    width: world.width,
    height: world.height,
    geography: world.geography,
    kingdoms: world.kingdoms.map(k => ({
      id: k.id,
      name: k.name,
      color: k.color,
      capital: k.capital,
      cities: k.cities,
      geography: k.geography
    }))
  };
}
