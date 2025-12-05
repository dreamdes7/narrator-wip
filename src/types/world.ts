// --- World Data Types (JSON-serializable) ---

export interface Point2D {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export type BiomeType = 'OCEAN' | 'SHALLOW' | 'BEACH' | 'PLAIN' | 'FOREST' | 'MOUNTAIN' | 'SNOW';

export interface POI {
  id: string;
  name: string;
  type: 'capital' | 'city' | 'fortress' | 'ruin' | 'dungeon';
  position: Point2D;
  kingdomId: number;
  description?: string;
}

export interface KingdomGeography {
  centroid: Point2D;
  bounds: BoundingBox;
  area: number;
  neighboringKingdoms: number[];
  hasCoastline: boolean;
  dominantBiome: BiomeType;
}

export interface Kingdom {
  id: number;
  name: string;
  color: string;
  borderColor: string;
  capital: POI;
  cities: POI[];
  geography: KingdomGeography;
  // Runtime
  svgPath?: string;
  cellIds: number[];
}

// Simplified cell for war mechanics
export interface CellData {
  id: number;
  center: Point2D;
  polygon: [number, number][];
  isWater: boolean;
  biome: BiomeType;
  kingdomId: number | null;
  neighbors: number[];
}

export interface DistantLand {
  id: string;
  path: string;
  position: Point2D;
}

export interface WorldGeography {
  totalLandArea: number;
  continentBounds: BoundingBox;
  continentCentroid: Point2D;
}

export interface WorldData {
  seed: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  kingdoms: Kingdom[];
  cells: CellData[]; // For war mechanics
  distantLands: DistantLand[];
  geography: WorldGeography;
  coastlinePath?: string;
  biomePaths?: { biome: BiomeType; path: string }[];
}

export interface WorldDataJSON {
  seed: number;
  width: number;
  height: number;
  geography: WorldGeography;
  kingdoms: {
    id: number;
    name: string;
    color: string;
    capital: POI;
    cities: POI[];
    geography: KingdomGeography;
  }[];
}

// --- Generation Config ---
export interface WorldGenConfig {
  width: number;
  height: number;
  numKingdoms: number;
  numPoints: number;
  numCitiesPerKingdom: number;
  seed?: number;
}

export const DEFAULT_WORLD_CONFIG: WorldGenConfig = {
  width: 1400,
  height: 1100,
  numKingdoms: 5,
  numPoints: 2000, // Reduced for performance with war mode
  numCitiesPerKingdom: 3,
};
