import type { POI, ClimateZone, Kingdom, BiomeType } from '../types/world';

// Import capital images - 4 variants per climate
import NorthCapitalA from '../assets/capital/north-capital-a.jpeg';
import NorthCapitalB from '../assets/capital/north-capital-b.jpeg';
import NorthCapitalC from '../assets/capital/north-capital-c.jpeg';
import NorthCapitalD from '../assets/capital/north-capital-d.jpeg';

import CentralCapitalA from '../assets/capital/central-capital-a.jpeg';
import CentralCapitalB from '../assets/capital/central-capital-b.jpeg';
import CentralCapitalC from '../assets/capital/central-capital-c.jpeg';
import CentralCapitalD from '../assets/capital/central-capital-d.jpeg';

import SouthCapitalA from '../assets/capital/south-capital-a.jpeg';
import SouthCapitalB from '../assets/capital/south-capital-b.jpeg';
import SouthCapitalC from '../assets/capital/south-capital-c.jpeg';
import SouthCapitalD from '../assets/capital/south-capital-d.jpeg';

// Import all town images (34 total)
// NORTH towns (11)
import NorthTownCastle from '../assets/town/north-town-castle.jpeg';
import NorthTownCoast from '../assets/town/north-town-coast.jpeg';
import NorthTownFishing from '../assets/town/north-town-fishing.jpeg';
import NorthTownForestVillage from '../assets/town/north-town-forest-village.jpeg';
import NorthTownForest from '../assets/town/north-town-forest.jpeg';
import NorthTownHillsB from '../assets/town/north-town-hills-b.jpeg';
import NorthTownHills from '../assets/town/north-town-hills.jpeg';
import NorthTownMining from '../assets/town/north-town-mining.jpeg';
import NorthTownBuffaloB from '../assets/town/north-town-plane-buffalos-breeding-b.jpeg';
import NorthTownBuffalo from '../assets/town/north-town-plane-buffalos-breeding.jpeg';
import NorthTownYurts from '../assets/town/north-town-yurts.jpeg';

// CENTRAL towns (12)
import CentralTownAncient from '../assets/town/central-town-ancient.jpeg';
import CentralTownForestB from '../assets/town/central-town-forest-b.jpeg';
import CentralTownForest from '../assets/town/central-town-forest.jpeg';
import CentralTownMarket from '../assets/town/central-town-market.jpeg';
import CentralTownPlaneVillageB from '../assets/town/central-town-plane-village-b.jpeg';
import CentralTownPlaneVillage from '../assets/town/central-town-plane-village.jpeg';
import CentralTownTradePlaneB from '../assets/town/central-town-trade-plane-b.jpeg';
import CentralTownTradePlane from '../assets/town/central-town-trade-plane.jpeg';
import CentralTownTrade from '../assets/town/central-town-trade.jpeg';
import CentralTownVillage from '../assets/town/central-town-village.jpeg';
import CentralTownWoodForest from '../assets/town/central-town-wood-forest.jpeg';

// SOUTH towns (11)
import SouthTownArid from '../assets/town/Arid_village_perched_202512060117.jpeg';
import SouthTownCanyon from '../assets/town/south-town-canyon.jpeg';
import SouthTownCastle from '../assets/town/south-town-castle.jpeg';
import SouthTownCoast from '../assets/town/south-town-coast.jpeg';
import SouthTownDesert from '../assets/town/south-town-desert.jpeg';
import SouthTownForest from '../assets/town/south-town-forest.jpeg';
import SouthTownHills from '../assets/town/south-town-hills.jpeg';
import SouthTownJungleB from '../assets/town/south-town-jungle-village-b.jpeg';
import SouthTownJungle from '../assets/town/south-town-jungle-village.jpeg';
import SouthTownMarket from '../assets/town/south-town-market.jpeg';
import SouthTownSavannahB from '../assets/town/south-town-savannah-village-b.jpeg';
import SouthTownSavannah from '../assets/town/south-town-savannah-village.jpeg';

// Capital images by climate zone (4 variants each)
const CAPITAL_IMAGES: Record<ClimateZone, string[]> = {
  NORTH: [NorthCapitalA, NorthCapitalB, NorthCapitalC, NorthCapitalD],
  CENTRAL: [CentralCapitalA, CentralCapitalB, CentralCapitalC, CentralCapitalD],
  SOUTH: [SouthCapitalA, SouthCapitalB, SouthCapitalC, SouthCapitalD]
};

// Town image metadata - each image has climate, biome compatibility, and keywords
export interface TownImageMeta {
  id: string;           // Unique identifier matching filename
  src: string;          // Actual image import
  climate: ClimateZone;
  biomes: BiomeType[];  // Compatible biomes
  keywords: string[];   // Keywords for LLM matching (specialty, features)
  coastal?: boolean;    // Is this a coastal image?
}

// All town images with metadata
export const TOWN_IMAGE_CATALOG: TownImageMeta[] = [
  // NORTH (11 images)
  { id: 'north-town-castle', src: NorthTownCastle, climate: 'NORTH', biomes: ['HILLS', 'PLAINS', 'SNOW'], keywords: ['fortress', 'military', 'defense', 'stronghold', 'castle'] },
  { id: 'north-town-coast', src: NorthTownCoast, climate: 'NORTH', biomes: ['PLAINS'], keywords: ['port', 'harbor', 'shipping', 'naval'], coastal: true },
  { id: 'north-town-fishing', src: NorthTownFishing, climate: 'NORTH', biomes: ['PLAINS'], keywords: ['fishing', 'fishermen', 'boats', 'seafood', 'whaling'], coastal: true },
  { id: 'north-town-forest-village', src: NorthTownForestVillage, climate: 'NORTH', biomes: ['FOREST'], keywords: ['lumber', 'woodcutting', 'logging', 'timber', 'hunters', 'village'] },
  { id: 'north-town-forest', src: NorthTownForest, climate: 'NORTH', biomes: ['FOREST'], keywords: ['forest', 'woodland', 'hunters', 'furs', 'trappers'] },
  { id: 'north-town-hills-b', src: NorthTownHillsB, climate: 'NORTH', biomes: ['HILLS'], keywords: ['hills', 'highlands', 'sheep', 'herding', 'pastoral'] },
  { id: 'north-town-hills', src: NorthTownHills, climate: 'NORTH', biomes: ['HILLS', 'SNOW'], keywords: ['hills', 'mountain', 'stone', 'quarry', 'masonry'] },
  { id: 'north-town-mining', src: NorthTownMining, climate: 'NORTH', biomes: ['HILLS', 'SNOW'], keywords: ['mining', 'ore', 'iron', 'metals', 'smithing', 'forge'] },
  { id: 'north-town-plane-buffalos-breeding-b', src: NorthTownBuffaloB, climate: 'NORTH', biomes: ['PLAINS'], keywords: ['buffalo', 'breeding', 'livestock', 'cattle', 'herding', 'ranching'] },
  { id: 'north-town-plane-buffalos-breeding', src: NorthTownBuffalo, climate: 'NORTH', biomes: ['PLAINS'], keywords: ['buffalo', 'breeding', 'livestock', 'cattle', 'herding', 'plains'] },
  { id: 'north-town-yurts', src: NorthTownYurts, climate: 'NORTH', biomes: ['PLAINS', 'SNOW'], keywords: ['nomads', 'yurts', 'tents', 'travelers', 'horses', 'steppes'] },

  // CENTRAL (12 images)
  { id: 'central-town-ancient', src: CentralTownAncient, climate: 'CENTRAL', biomes: ['HILLS', 'PLAINS'], keywords: ['ancient', 'ruins', 'historic', 'scholars', 'library', 'temple'] },
  { id: 'central-town-forest-b', src: CentralTownForestB, climate: 'CENTRAL', biomes: ['FOREST'], keywords: ['forest', 'woodland', 'logging', 'lumber', 'woodworkers'] },
  { id: 'central-town-forest', src: CentralTownForest, climate: 'CENTRAL', biomes: ['FOREST'], keywords: ['forest', 'hunters', 'game', 'wildlife', 'rangers'] },
  { id: 'central-town-market', src: CentralTownMarket, climate: 'CENTRAL', biomes: ['PLAINS'], keywords: ['market', 'trade', 'merchants', 'bazaar', 'commerce', 'goods'] },
  { id: 'central-town-plane-village-b', src: CentralTownPlaneVillageB, climate: 'CENTRAL', biomes: ['PLAINS'], keywords: ['village', 'farming', 'agriculture', 'crops', 'wheat', 'peaceful'] },
  { id: 'central-town-plane-village', src: CentralTownPlaneVillage, climate: 'CENTRAL', biomes: ['PLAINS'], keywords: ['village', 'farming', 'fields', 'harvest', 'rural', 'peasants'] },
  { id: 'central-town-trade-plane-b', src: CentralTownTradePlaneB, climate: 'CENTRAL', biomes: ['PLAINS'], keywords: ['trade', 'caravans', 'crossroads', 'travelers', 'inn', 'roads'] },
  { id: 'central-town-trade-plane', src: CentralTownTradePlane, climate: 'CENTRAL', biomes: ['PLAINS'], keywords: ['trade', 'merchants', 'wagons', 'commerce', 'marketplace'] },
  { id: 'central-town-trade', src: CentralTownTrade, climate: 'CENTRAL', biomes: ['PLAINS'], keywords: ['trade', 'port', 'shipping', 'docks', 'riverside'], coastal: true },
  { id: 'central-town-village', src: CentralTownVillage, climate: 'CENTRAL', biomes: ['PLAINS', 'HILLS'], keywords: ['village', 'community', 'craftsmen', 'artisans', 'workshops'] },
  { id: 'central-town-wood-forest', src: CentralTownWoodForest, climate: 'CENTRAL', biomes: ['FOREST'], keywords: ['lumber', 'sawmill', 'timber', 'woodworking', 'carpenters', 'forest'] },

  // SOUTH (12 images)
  { id: 'south-town-arid', src: SouthTownArid, climate: 'SOUTH', biomes: ['PLAINS', 'HILLS'], keywords: ['arid', 'desert', 'cliff', 'perched', 'remote', 'isolated'] },
  { id: 'south-town-canyon', src: SouthTownCanyon, climate: 'SOUTH', biomes: ['HILLS'], keywords: ['canyon', 'gorge', 'cliff', 'carved', 'ancient', 'hidden'] },
  { id: 'south-town-castle', src: SouthTownCastle, climate: 'SOUTH', biomes: ['HILLS', 'PLAINS'], keywords: ['castle', 'fortress', 'palace', 'military', 'walls', 'defense'] },
  { id: 'south-town-coast', src: SouthTownCoast, climate: 'SOUTH', biomes: ['PLAINS'], keywords: ['coast', 'port', 'harbor', 'ships', 'sailors', 'maritime'], coastal: true },
  { id: 'south-town-desert', src: SouthTownDesert, climate: 'SOUTH', biomes: ['PLAINS'], keywords: ['desert', 'oasis', 'sand', 'caravans', 'spices', 'exotic'] },
  { id: 'south-town-forest', src: SouthTownForest, climate: 'SOUTH', biomes: ['FOREST'], keywords: ['forest', 'tropical', 'herbs', 'medicine', 'healers'] },
  { id: 'south-town-hills', src: SouthTownHills, climate: 'SOUTH', biomes: ['HILLS'], keywords: ['hills', 'terraces', 'vineyards', 'wine', 'grapes', 'orchards'] },
  { id: 'south-town-jungle-b', src: SouthTownJungleB, climate: 'SOUTH', biomes: ['FOREST'], keywords: ['jungle', 'tropical', 'exotic', 'wildlife', 'explorers'] },
  { id: 'south-town-jungle', src: SouthTownJungle, climate: 'SOUTH', biomes: ['FOREST'], keywords: ['jungle', 'rainforest', 'humid', 'dense', 'mysterious'] },
  { id: 'south-town-market', src: SouthTownMarket, climate: 'SOUTH', biomes: ['PLAINS'], keywords: ['market', 'bazaar', 'spices', 'silks', 'merchants', 'exotic'] },
  { id: 'south-town-savannah-b', src: SouthTownSavannahB, climate: 'SOUTH', biomes: ['PLAINS'], keywords: ['savannah', 'grassland', 'herding', 'cattle', 'pastoral'] },
  { id: 'south-town-savannah', src: SouthTownSavannah, climate: 'SOUTH', biomes: ['PLAINS'], keywords: ['savannah', 'plains', 'wildlife', 'hunting', 'tribes'] },
];

/**
 * Get list of available town images for LLM prompt
 * Returns simplified info for the prompt
 */
export const getTownImageListForPrompt = (): { id: string; climate: ClimateZone; keywords: string[] }[] => {
  return TOWN_IMAGE_CATALOG.map(img => ({
    id: img.id,
    climate: img.climate,
    keywords: img.keywords
  }));
};

// Store current assignments
let capitalAssignments: Map<number, string> = new Map();
let cityAssignments: Map<string, { imageId: string; src: string }> = new Map();
let globalUsedCapitalImages: Set<string> = new Set();
let globalUsedCityImages: Set<string> = new Set();

/**
 * Shuffle array deterministically based on seed
 */
const shuffleArray = <T>(array: T[], seed: number): T[] => {
  const result = [...array];
  let currentSeed = seed;
  
  const random = () => {
    currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
    return currentSeed / 4294967296;
  };
  
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
};

/**
 * Score how well an image matches a city's context
 */
const scoreImageMatch = (
  image: TownImageMeta,
  climate: ClimateZone,
  biome: BiomeType,
  isCoastal: boolean,
  specialtyKeywords?: string[]
): number => {
  let score = 0;
  
  // Climate match is required
  if (image.climate !== climate) return -1000;
  
  // Biome match
  if (image.biomes.includes(biome)) score += 50;
  
  // Coastal match
  if (isCoastal && image.coastal) score += 30;
  if (!isCoastal && image.coastal) score -= 20;
  
  // Keyword matching from specialty
  if (specialtyKeywords && specialtyKeywords.length > 0) {
    const lowerKeywords = specialtyKeywords.map(k => k.toLowerCase());
    for (const keyword of image.keywords) {
      if (lowerKeywords.some(k => k.includes(keyword) || keyword.includes(k))) {
        score += 25;
      }
    }
  }
  
  return score;
};

/**
 * Find best matching image for a city
 */
const findBestImage = (
  climate: ClimateZone,
  biome: BiomeType,
  isCoastal: boolean,
  specialty?: string,
  excludeIds?: Set<string>
): TownImageMeta | null => {
  const specialtyKeywords = specialty ? specialty.toLowerCase().split(/[\s,]+/) : [];
  
  const candidates = TOWN_IMAGE_CATALOG
    .filter(img => !excludeIds?.has(img.id))
    .map(img => ({
      image: img,
      score: scoreImageMatch(img, climate, biome, isCoastal, specialtyKeywords)
    }))
    .filter(c => c.score > -1000)
    .sort((a, b) => b.score - a.score);
  
  return candidates[0]?.image || null;
};

/**
 * Initialize image assignments for a new world
 */
export const initializeImageAssignments = (kingdoms: Kingdom[], worldSeed?: number): void => {
  capitalAssignments.clear();
  cityAssignments.clear();
  globalUsedCapitalImages.clear();
  globalUsedCityImages.clear();
  
  const seed = worldSeed ?? Date.now();
  
  // --- Assign Capital Images ---
  const kingdomsByClimate: Record<ClimateZone, Kingdom[]> = { NORTH: [], CENTRAL: [], SOUTH: [] };
  kingdoms.forEach(k => kingdomsByClimate[k.geography.climateZone].push(k));
  
  Object.entries(kingdomsByClimate).forEach(([climate, ks]) => {
    const availableImages = shuffleArray(CAPITAL_IMAGES[climate as ClimateZone], seed);
    
    ks.forEach((kingdom, index) => {
      let assignedImage: string | null = null;
      
      for (let i = 0; i < availableImages.length; i++) {
        const candidateIndex = (index + i) % availableImages.length;
        const candidate = availableImages[candidateIndex];
        
        if (!globalUsedCapitalImages.has(candidate)) {
          assignedImage = candidate;
          globalUsedCapitalImages.add(candidate);
          break;
        }
      }
      
      if (!assignedImage) {
        assignedImage = availableImages[index % availableImages.length];
      }
      
      capitalAssignments.set(kingdom.id, assignedImage);
    });
  });
  
  // --- Assign City Images ---
  const allCities: { city: POI; kingdom: Kingdom }[] = [];
  kingdoms.forEach(kingdom => {
    kingdom.cities.forEach(city => {
      allCities.push({ city, kingdom });
    });
  });
  
  // Shuffle for variety
  const shuffledCities = shuffleArray(allCities, seed);
  
  shuffledCities.forEach(({ city, kingdom }) => {
    const climate = city.climate || kingdom.geography.climateZone;
    const biome = city.biome || 'PLAINS';
    const isCoastal = kingdom.geography.hasCoastline;
    
    const bestImage = findBestImage(climate, biome, isCoastal, undefined, globalUsedCityImages);
    
    if (bestImage) {
      globalUsedCityImages.add(bestImage.id);
      cityAssignments.set(city.id, { imageId: bestImage.id, src: bestImage.src });
    } else {
      // Fallback: find any unused image from matching climate
      const fallback = TOWN_IMAGE_CATALOG.find(img => 
        img.climate === climate && !globalUsedCityImages.has(img.id)
      ) || TOWN_IMAGE_CATALOG.find(img => img.climate === climate);
      
      if (fallback) {
        globalUsedCityImages.add(fallback.id);
        cityAssignments.set(city.id, { imageId: fallback.id, src: fallback.src });
      }
    }
  });
  
  console.log('City image assignments:', Array.from(cityAssignments.entries()).map(([id, data]) => `${id}: ${data.imageId}`));
};

/**
 * Update city image based on LLM-generated specialty
 * Call this after lore generation to refine image assignments
 * Maintains uniqueness - won't assign an image already used by another city
 * If no better match found, keeps current assignment
 */
export const updateCityImageFromLore = (
  cityId: string,
  climate: ClimateZone,
  biome: BiomeType,
  isCoastal: boolean,
  specialty: string
): void => {
  // Get current assignment
  const currentAssignment = cityAssignments.get(cityId);
  
  // If city already has an image, only update if we find a BETTER match
  // Build set of used images EXCLUDING current city's image
  const usedExcludingCurrent = new Set(globalUsedCityImages);
  if (currentAssignment) {
    usedExcludingCurrent.delete(currentAssignment.imageId);
  }
  
  // Find best matching image that's not already used
  const bestImage = findBestImage(climate, biome, isCoastal, specialty, usedExcludingCurrent);
  
  // Only update if we found a better image AND it's different from current
  if (bestImage && bestImage.id !== currentAssignment?.imageId) {
    // Remove old image from used set
    if (currentAssignment) {
      globalUsedCityImages.delete(currentAssignment.imageId);
    }
    
    // Assign new image
    globalUsedCityImages.add(bestImage.id);
    cityAssignments.set(cityId, { imageId: bestImage.id, src: bestImage.src });
    console.log(`Updated city ${cityId} image to ${bestImage.id} based on specialty: ${specialty}`);
  } else if (!currentAssignment && bestImage) {
    // City had no image, assign the best match
    globalUsedCityImages.add(bestImage.id);
    cityAssignments.set(cityId, { imageId: bestImage.id, src: bestImage.src });
    console.log(`Assigned city ${cityId} image to ${bestImage.id}`);
  }
  // If no bestImage and no currentAssignment - city will show placeholder
};

/**
 * Get capital image for a kingdom
 */
export const getCapitalImageByKingdomId = (kingdomId: number): string | null => {
  return capitalAssignments.get(kingdomId) || null;
};

/**
 * Get city image by city ID
 */
export const getCityImageById = (cityId: string): string | null => {
  return cityAssignments.get(cityId)?.src || null;
};

/**
 * Get city image metadata by city ID
 */
export const getCityImageMeta = (cityId: string): { imageId: string; src: string } | null => {
  return cityAssignments.get(cityId) || null;
};

/**
 * Get image URL for a POI
 */
export const getLocationImage = (poi: POI, kingdom: Kingdom | null): string | null => {
  if (poi.type === 'capital' && kingdom) {
    const capitalImg = getCapitalImageByKingdomId(kingdom.id);
    console.log(`getLocationImage capital ${poi.name} (kingdom ${kingdom.id}):`, capitalImg ? 'found' : 'NOT FOUND', `(assignments: ${capitalAssignments.size})`);
    return capitalImg;
  }
  if (poi.type === 'city') {
    const cityImg = getCityImageById(poi.id);
    console.log(`getLocationImage city ${poi.name}:`, cityImg ? 'found' : 'NOT FOUND');
    return cityImg;
  }
  return null;
};

/**
 * Check if we have an image for this POI
 */
export const hasLocationImage = (poi: POI, kingdom: Kingdom | null): boolean => {
  if (poi.type === 'capital' && kingdom) {
    const has = capitalAssignments.has(kingdom.id);
    console.log(`hasLocationImage capital ${poi.name}: ${has} (capitalAssignments size: ${capitalAssignments.size})`);
    return has;
  }
  if (poi.type === 'city') {
    const has = cityAssignments.has(poi.id);
    console.log(`hasLocationImage city ${poi.name}: ${has} (cityAssignments size: ${cityAssignments.size})`);
    return has;
  }
  return false;
};

/**
 * Debug: Get current assignment counts
 */
export const getAssignmentCounts = () => ({
  capitals: capitalAssignments.size,
  cities: cityAssignments.size,
  usedCapitals: globalUsedCapitalImages.size,
  usedCities: globalUsedCityImages.size
});
