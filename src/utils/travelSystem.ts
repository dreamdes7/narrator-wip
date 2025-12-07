// ============ TRAVEL SYSTEM ============
// Утилиты для расчёта маршрутов и управления путешествиями

import type { WorldData, POI, Kingdom, Point2D, BiomeType } from '../types/world';
import type { TravelRoute, TravelState, TravelDanger, Quest, GameState } from '../types/travel';

// ============ РАСЧЁТ РАССТОЯНИЯ ============

const distance2D = (a: Point2D, b: Point2D): number => {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
};

// Перевод расстояния в дни пути (нормализация на размер карты)
const distanceToDays = (dist: number, worldWidth: number): number => {
  // Максимальное расстояние ~ диагональ карты
  const maxDist = Math.sqrt(worldWidth ** 2 + worldWidth ** 2);
  // Нормализуем: 1-5 дней
  const normalized = (dist / maxDist) * 5;
  return Math.max(1, Math.min(5, Math.round(normalized)));
};

// Стоимость путешествия зависит от расстояния и опасности
const calculateTravelCost = (days: number, danger: TravelDanger): number => {
  const baseCost = days * 10;
  const dangerMultiplier = danger === 'safe' ? 1 : danger === 'risky' ? 1.5 : 2;
  return Math.round(baseCost * dangerMultiplier);
};

// Определить опасность пути на основе биомов
const calculateDanger = (
  fromBiome: BiomeType,
  toBiome: BiomeType,
  crossesKingdomBorder: boolean
): TravelDanger => {
  const dangerousBiomes: BiomeType[] = ['MOUNTAIN', 'SNOW'];
  const riskyBiomes: BiomeType[] = ['FOREST', 'HILLS'];
  
  let dangerScore = 0;
  
  if (dangerousBiomes.includes(fromBiome) || dangerousBiomes.includes(toBiome)) {
    dangerScore += 2;
  }
  if (riskyBiomes.includes(fromBiome) || riskyBiomes.includes(toBiome)) {
    dangerScore += 1;
  }
  if (crossesKingdomBorder) {
    dangerScore += 1;
  }
  
  if (dangerScore >= 3) return 'dangerous';
  if (dangerScore >= 1) return 'risky';
  return 'safe';
};

// ============ ГЕНЕРАЦИЯ МАРШРУТОВ ============

/**
 * Создать маршрут между двумя локациями
 */
export const createRoute = (
  from: POI,
  to: POI,
  worldData: WorldData,
  isSameKingdom: boolean
): TravelRoute => {
  const dist = distance2D(from.position, to.position);
  const days = distanceToDays(dist, worldData.width);
  const danger = calculateDanger(from.biome, to.biome, !isSameKingdom);
  const cost = calculateTravelCost(days, danger);
  
  return {
    fromId: from.id,
    toId: to.id,
    distance: days,
    cost,
    danger,
    terrain: [from.biome, to.biome].filter((v, i, a) => a.indexOf(v) === i) as BiomeType[],
    isUnlocked: isSameKingdom, // Маршруты внутри королевства открыты по умолчанию
    requiresQuest: isSameKingdom ? undefined : 'travel_unlock_' + to.id
  };
};

/**
 * Получить все возможные маршруты из локации
 */
export const getRoutesFromLocation = (
  locationId: string,
  worldData: WorldData,
  travelState: TravelState
): TravelRoute[] => {
  const routes: TravelRoute[] = [];
  
  // Найти текущую локацию
  let currentPOI: POI | undefined;
  let currentKingdom: Kingdom | undefined;
  
  for (const kingdom of worldData.kingdoms) {
    if (kingdom.capital.id === locationId) {
      currentPOI = kingdom.capital;
      currentKingdom = kingdom;
      break;
    }
    const city = kingdom.cities.find(c => c.id === locationId);
    if (city) {
      currentPOI = city;
      currentKingdom = kingdom;
      break;
    }
  }
  
  if (!currentPOI || !currentKingdom) return routes;
  
  // Собрать все локации
  for (const kingdom of worldData.kingdoms) {
    const isSameKingdom = kingdom.id === currentKingdom.id;
    
    // Добавить столицу если это не текущая локация
    if (kingdom.capital.id !== locationId) {
      const route = createRoute(currentPOI, kingdom.capital, worldData, isSameKingdom);
      // Проверить разблокировку
      route.isUnlocked = isSameKingdom || 
        travelState.unlockedLocations.includes(kingdom.capital.id);
      routes.push(route);
    }
    
    // Добавить города
    for (const city of kingdom.cities) {
      if (city.id !== locationId) {
        const route = createRoute(currentPOI, city, worldData, isSameKingdom);
        route.isUnlocked = isSameKingdom || 
          travelState.unlockedLocations.includes(city.id);
        routes.push(route);
      }
    }
  }
  
  // Сортировать: сначала разблокированные, потом по расстоянию
  return routes.sort((a, b) => {
    if (a.isUnlocked !== b.isUnlocked) {
      return a.isUnlocked ? -1 : 1;
    }
    return a.distance - b.distance;
  });
};

/**
 * Получить маршруты только в пределах королевства
 */
export const getKingdomRoutes = (
  locationId: string,
  worldData: WorldData
): TravelRoute[] => {
  // Найти королевство текущей локации
  let currentPOI: POI | undefined;
  let currentKingdom: Kingdom | undefined;
  
  for (const kingdom of worldData.kingdoms) {
    if (kingdom.capital.id === locationId) {
      currentPOI = kingdom.capital;
      currentKingdom = kingdom;
      break;
    }
    const city = kingdom.cities.find(c => c.id === locationId);
    if (city) {
      currentPOI = city;
      currentKingdom = kingdom;
      break;
    }
  }
  
  if (!currentPOI || !currentKingdom) return [];
  
  const routes: TravelRoute[] = [];
  
  // Добавить столицу
  if (currentKingdom.capital.id !== locationId) {
    routes.push(createRoute(currentPOI, currentKingdom.capital, worldData, true));
  }
  
  // Добавить города королевства
  for (const city of currentKingdom.cities) {
    if (city.id !== locationId) {
      routes.push(createRoute(currentPOI, city, worldData, true));
    }
  }
  
  return routes.sort((a, b) => a.distance - b.distance);
};

// ============ ИНФОРМАЦИЯ О ЛОКАЦИЯХ ============

/**
 * Получить POI по ID
 */
export const getPOIById = (worldData: WorldData, locationId: string): POI | undefined => {
  for (const kingdom of worldData.kingdoms) {
    if (kingdom.capital.id === locationId) return kingdom.capital;
    const city = kingdom.cities.find(c => c.id === locationId);
    if (city) return city;
  }
  return undefined;
};

/**
 * Получить королевство по ID локации
 */
export const getKingdomByLocationId = (worldData: WorldData, locationId: string): Kingdom | undefined => {
  for (const kingdom of worldData.kingdoms) {
    if (kingdom.capital.id === locationId) return kingdom;
    if (kingdom.cities.some(c => c.id === locationId)) return kingdom;
  }
  return undefined;
};

/**
 * Получить все локации королевства
 */
export const getKingdomLocations = (kingdom: Kingdom): POI[] => {
  return [kingdom.capital, ...kingdom.cities];
};

/**
 * Получить ID всех локаций королевства
 */
export const getKingdomLocationIds = (kingdom: Kingdom): string[] => {
  return [kingdom.capital.id, ...kingdom.cities.map(c => c.id)];
};

// ============ ЛИНИИ ПУТЕЙ ДЛЯ ВИЗУАЛИЗАЦИИ ============

export interface PathLine {
  fromId: string;
  toId: string;
  from: Point2D;
  to: Point2D;
  color: string;
  dashed: boolean;
  danger: TravelDanger;
  distance: number;
  cost: number;
  isLocked: boolean;
}

/**
 * Создать линии путей для отображения на карте
 */
export const createPathLines = (
  locationId: string,
  worldData: WorldData,
  travelState: TravelState,
  showOnlyKingdom: boolean = true
): PathLine[] => {
  const currentPOI = getPOIById(worldData, locationId);
  if (!currentPOI) return [];
  
  const routes = showOnlyKingdom 
    ? getKingdomRoutes(locationId, worldData)
    : getRoutesFromLocation(locationId, worldData, travelState);
  
  return routes.map(route => {
    const targetPOI = getPOIById(worldData, route.toId);
    if (!targetPOI) return null;
    
    const dangerColors = {
      safe: '#4ecdc4',
      risky: '#f39c12',
      dangerous: '#e74c3c'
    };
    
    return {
      fromId: route.fromId,
      toId: route.toId,
      from: currentPOI.position,
      to: targetPOI.position,
      color: dangerColors[route.danger],
      dashed: !route.isUnlocked,
      danger: route.danger,
      distance: route.distance,
      cost: route.cost,
      isLocked: !route.isUnlocked
    };
  }).filter((line): line is PathLine => line !== null);
};

// ============ УПРАВЛЕНИЕ СОСТОЯНИЕМ ПУТЕШЕСТВИЯ ============

/**
 * Начать путешествие
 */
export const startTravel = (
  state: TravelState,
  route: TravelRoute,
  currentScene: number
): TravelState => {
  return {
    ...state,
    traveling: {
      fromId: route.fromId,
      toId: route.toId,
      daysRemaining: route.distance,
      totalDays: route.distance,
      route,
      startedAt: currentScene
    }
  };
};

/**
 * Завершить путешествие (прибытие)
 */
export const completeTravel = (state: TravelState): TravelState => {
  if (!state.traveling) return state;
  
  const arrivedAt = state.traveling.toId;
  
  return {
    ...state,
    currentLocationId: arrivedAt,
    visitedLocations: state.visitedLocations.includes(arrivedAt) 
      ? state.visitedLocations 
      : [...state.visitedLocations, arrivedAt],
    traveling: undefined
  };
};

/**
 * Разблокировать локацию
 */
export const unlockLocation = (
  state: TravelState,
  locationId: string
): TravelState => {
  if (state.unlockedLocations.includes(locationId)) return state;
  
  return {
    ...state,
    unlockedLocations: [...state.unlockedLocations, locationId],
    unlockedRoutes: [...state.unlockedRoutes, locationId]
  };
};

/**
 * Установить квест на путешествие
 */
export const setTravelQuest = (
  state: TravelState,
  targetLocationId: string,
  reason: string,
  questId: string,
  deadline?: number
): TravelState => {
  return {
    ...state,
    travelQuest: {
      targetLocationId,
      reason,
      deadline,
      questId
    }
  };
};

/**
 * Очистить квест на путешествие (выполнен/провален)
 */
export const clearTravelQuest = (state: TravelState): TravelState => {
  return {
    ...state,
    travelQuest: undefined
  };
};

// ============ КВЕСТЫ ============

/**
 * Создать квест на путешествие
 */
export const createTravelQuest = (
  targetLocationId: string,
  targetLocationName: string,
  reason: string,
  actNumber: 1 | 2 | 3,
  fromScene: number,
  deadline?: number,
  rewards?: Quest['rewards']
): Quest => {
  return {
    id: `travel_${targetLocationId}_${fromScene}`,
    title: `Путешествие в ${targetLocationName}`,
    description: reason,
    type: 'travel',
    status: 'active',
    objectives: [{
      id: `arrive_${targetLocationId}`,
      description: `Прибыть в ${targetLocationName}`,
      type: 'travel',
      target: targetLocationId,
      completed: false
    }],
    actNumber,
    fromScene,
    deadline,
    rewards: rewards || {
      reputation: 10,
      unlockLocations: [targetLocationId]
    },
    isFromScenario: true
  };
};

/**
 * Проверить и обновить квесты при прибытии в локацию
 */
export const updateQuestsOnArrival = (
  quests: Quest[],
  arrivedLocationId: string
): Quest[] => {
  return quests.map(quest => {
    if (quest.status !== 'active') return quest;
    
    const updatedObjectives = quest.objectives.map(obj => {
      if (obj.type === 'travel' && obj.target === arrivedLocationId && !obj.completed) {
        return { ...obj, completed: true };
      }
      return obj;
    });
    
    // Проверить, все ли обязательные цели выполнены
    const isComplete = updatedObjectives
      .filter(o => !o.optional)
      .every(o => o.completed);
    
    return {
      ...quest,
      objectives: updatedObjectives,
      status: isComplete ? 'completed' : quest.status
    };
  });
};

// ============ ОПИСАНИЯ ДЛЯ UI ============

export const getDangerDescription = (danger: TravelDanger): string => {
  switch (danger) {
    case 'safe': return 'Безопасный путь';
    case 'risky': return 'Рискованный путь';
    case 'dangerous': return 'Опасный путь';
  }
};

export const getDaysDescription = (days: number): string => {
  if (days === 1) return '1 день пути';
  if (days < 5) return `${days} дня пути`;
  return `${days} дней пути`;
};

export const getTravelDescription = (route: TravelRoute): string => {
  return `${getDaysDescription(route.distance)} • ${route.cost} золота • ${getDangerDescription(route.danger)}`;
};

