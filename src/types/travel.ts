// ============ TRAVEL & QUEST SYSTEM ============
// Типы для интеграции агентов с интерактивным миром

import type { POI, ClimateZone, BiomeType } from './world';

// ============ МАРШРУТЫ ============

export type TravelDanger = 'safe' | 'risky' | 'dangerous';

export interface TravelRoute {
  fromId: string;           // POI.id откуда
  toId: string;             // POI.id куда
  distance: number;         // Дни в пути (1-5)
  cost: number;             // Стоимость в золоте
  danger: TravelDanger;     // Опасность пути
  terrain: BiomeType[];     // Через какие биомы проходит путь
  description?: string;     // Описание маршрута
  isUnlocked: boolean;      // Разблокирован ли путь
  requiresQuest?: string;   // ID квеста для разблокировки
}

// ============ КВЕСТЫ ============

export type QuestType = 
  | 'main'        // Основной сюжет
  | 'travel'      // Квест на перемещение
  | 'fetch'       // Принести предмет
  | 'talk'        // Поговорить с NPC
  | 'explore';    // Исследовать локацию

export type QuestStatus = 'active' | 'completed' | 'failed' | 'hidden';

export interface QuestObjective {
  id: string;
  description: string;
  type: 'travel' | 'item' | 'talk' | 'choice' | 'custom';
  target?: string;          // locationId, itemId, npcId, или flagId
  completed: boolean;
  optional?: boolean;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  status: QuestStatus;
  
  // Цели
  objectives: QuestObjective[];
  
  // Привязка к сценарию
  actNumber?: 1 | 2 | 3;          // К какому акту относится
  fromScene?: number;              // В какой сцене получен
  
  // Ограничения
  deadline?: number;               // До какой сцены нужно выполнить
  
  // Награды
  rewards?: {
    gold?: number;
    reputation?: number;
    influence?: number;
    items?: string[];
    unlockLocations?: string[];    // Разблокировать локации
    unlockRoutes?: string[];       // Разблокировать маршруты (toId)
  };
  
  // Последствия провала
  failureConsequences?: {
    reputation?: number;
    flags?: string[];
  };
  
  // Метаданные
  giver?: string;                  // NPC который дал квест
  isFromScenario: boolean;         // Создан Narrator'ом или динамически
}

// ============ TRAVEL STATE ============

export interface TravelState {
  // Текущая позиция
  currentLocationId: string;
  currentKingdomId: number;
  
  // Доступные локации
  unlockedLocations: string[];     // Можно посетить
  visitedLocations: string[];      // Уже посетили
  
  // Разблокированные маршруты (помимо базовых внутри королевства)
  unlockedRoutes: string[];        // toId локаций
  
  // Активное путешествие
  traveling?: {
    fromId: string;
    toId: string;
    daysRemaining: number;
    totalDays: number;
    route: TravelRoute;
    startedAt: number;             // sceneNumber
  };
  
  // Квест на обязательное перемещение
  travelQuest?: {
    targetLocationId: string;
    reason: string;
    deadline?: number;             // К какой сцене нужно дойти
    questId: string;
  };
}

// ============ GAME STATE (объединённое состояние) ============

export interface GameState {
  // Путешествия
  travel: TravelState;
  
  // Квесты
  quests: Quest[];
  activeQuestId?: string;          // Текущий отслеживаемый квест
  
  // События мира (изменения из-за действий игрока)
  worldEvents: {
    id: string;
    type: 'location_mood_change' | 'npc_moved' | 'location_unlocked' | 'route_opened';
    targetId: string;
    data: Record<string, any>;
    sceneNumber: number;
  }[];
}

// ============ СОЗДАНИЕ НАЧАЛЬНОГО СОСТОЯНИЯ ============

export const createInitialTravelState = (
  startingLocationId: string,
  startingKingdomId: number,
  kingdomLocations: string[]        // Все локации стартового королевства
): TravelState => ({
  currentLocationId: startingLocationId,
  currentKingdomId: startingKingdomId,
  unlockedLocations: kingdomLocations,   // Стартовое королевство доступно
  visitedLocations: [startingLocationId],
  unlockedRoutes: kingdomLocations,      // Маршруты внутри королевства открыты
  traveling: undefined,
  travelQuest: undefined
});

export const createInitialGameState = (
  startingLocationId: string,
  startingKingdomId: number,
  kingdomLocations: string[]
): GameState => ({
  travel: createInitialTravelState(startingLocationId, startingKingdomId, kingdomLocations),
  quests: [],
  activeQuestId: undefined,
  worldEvents: []
});

// ============ УТИЛИТЫ ============

// Проверить, можно ли путешествовать в локацию
export const canTravelTo = (
  state: TravelState, 
  targetLocationId: string
): boolean => {
  // Уже там
  if (state.currentLocationId === targetLocationId) return false;
  
  // Сейчас в пути
  if (state.traveling) return false;
  
  // Локация разблокирована
  return state.unlockedLocations.includes(targetLocationId);
};

// Проверить, достаточно ли ресурсов для путешествия
export const canAffordTravel = (
  gold: number,
  route: TravelRoute
): boolean => {
  return gold >= route.cost;
};

// Получить статус квеста по ID
export const getQuestById = (
  quests: Quest[],
  questId: string
): Quest | undefined => {
  return quests.find(q => q.id === questId);
};

// Получить активные квесты
export const getActiveQuests = (quests: Quest[]): Quest[] => {
  return quests.filter(q => q.status === 'active');
};

// Проверить, выполнен ли квест
export const isQuestComplete = (quest: Quest): boolean => {
  return quest.objectives
    .filter(o => !o.optional)
    .every(o => o.completed);
};

// Обновить прогресс квеста (для travel objective)
export const updateTravelObjective = (
  quest: Quest,
  arrivedLocationId: string
): Quest => {
  return {
    ...quest,
    objectives: quest.objectives.map(obj => {
      if (obj.type === 'travel' && obj.target === arrivedLocationId && !obj.completed) {
        return { ...obj, completed: true };
      }
      return obj;
    })
  };
};

