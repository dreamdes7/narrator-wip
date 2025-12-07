// ============ AGENT SYSTEM TYPES ============
// Типы для взаимодействия агентов и отладки

import type { PlayableCharacter } from '../services/llmService';

// ============ PLAYER STATE ============
// Динамическое состояние игрока

export interface PlayerStats {
  gold: number;
  reputation: number;      // -100 to 100 (общая репутация в мире)
  influence: number;       // 0-100 (политическое влияние)
  health: number;          // 0-100
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  type: 'weapon' | 'armor' | 'consumable' | 'key' | 'document' | 'treasure';
  quantity: number;
}

export interface NPCRelationship {
  npcId: string;
  npcName: string;
  relation: number;        // -100 to 100
  status: 'ally' | 'neutral' | 'rival' | 'enemy' | 'dead';
  lastInteraction?: string;
}

export interface StoryFlag {
  id: string;
  value: boolean | string | number;
  setAt: number;           // scene number when set
}

export interface PlayerState {
  stats: PlayerStats;
  inventory: InventoryItem[];
  relationships: NPCRelationship[];
  flags: StoryFlag[];
  currentLocationId?: string;
  visitedLocations: string[];
}

// Создать начальное состояние игрока
export const createInitialPlayerState = (startingGold: number = 50): PlayerState => ({
  stats: {
    gold: startingGold,
    reputation: 0,
    influence: 10,
    health: 100
  },
  inventory: [],
  relationships: [],
  flags: [],
  visitedLocations: []
});

// Лог применённого эффекта (для UI)
export interface AppliedEffect {
  description: string;
  type: 'positive' | 'negative' | 'neutral';
  icon: string;
}

// Роли агентов в системе
export type AgentRole = 'GOLEM' | 'CHARACTER_GENERATOR' | 'NARRATOR' | 'SHOWRUNNER' | 'DIRECTOR';

// ============ STORY DIRECTOR ============
// Агент, управляющий сценарным движком

// Текущее состояние истории (отслеживается Director)
export interface StoryState {
  currentAct: 1 | 2 | 3;
  actProgress: number;          // 0-100% прогресс внутри акта
  scenesInCurrentAct: number;
  
  // Milestones - ключевые точки сюжета
  milestones: {
    id: string;
    name: string;
    act: 1 | 2 | 3;
    reached: boolean;
    reachedAtScene?: number;
  }[];
  
  // Текущий фокус истории
  currentFocus: string;         // На чём сейчас концентрируется история
  
  // Сводка произошедшего
  storySummary: string;         // Краткое описание всего что произошло
  lastSceneSummary: string;     // Что произошло в последней сцене
  
  // Состояние завершения
  isClimax: boolean;
  isEpilogue: boolean;
  isComplete: boolean;
}

// Директива от Director к Showrunner
export interface DirectorDirective {
  // Темп повествования
  pacing: 'slow_down' | 'maintain' | 'build_tension' | 'climax' | 'resolution';
  
  // На чём сфокусироваться
  focus: string;                // "confrontation with villain", "gathering allies", etc.
  
  // Какой акт/beat сейчас
  currentBeat: string;          // "setup", "rising_action", "midpoint", "crisis", "climax", "resolution"
  
  // Конкретные инструкции
  mustInclude?: string[];       // Что ДОЛЖНО быть в сцене
  shouldAvoid?: string[];       // Чего избегать
  
  // Milestone hint
  targetMilestone?: string;     // К какому milestone вести
  
  // Сигнал завершения
  shouldEnd?: boolean;          // Пора заканчивать историю?
  endType?: 'victory' | 'defeat' | 'bittersweet' | 'cliffhanger';
}

// Контекст для Director
export interface DirectorContext {
  // Сценарий от Narrator
  scenario: {
    title: string;
    premise: string;
    acts: { actNumber: number; title: string; description: string; keyEvents: string[] }[];
    heroDramaturgy: {
      incitingIncident: string;
      moralDilemma: string;
      stakes: string;
    };
  };
  
  // Текущее состояние истории
  currentStoryState: StoryState;
  
  // Последняя сцена и выбор игрока
  lastScene: {
    description: string;
    location: string;
    choices: string[];
  };
  playerChoice: string;
  
  // Состояние игрока (для учёта последствий)
  playerState: {
    gold: number;
    reputation: number;
    relationships: string[];
  };
  
  // Счётчик сцен
  totalScenes: number;
}

// Результат работы Director
export interface DirectorAnalysis {
  // Обновлённое состояние истории
  updatedStoryState: StoryState;
  
  // Директива для Showrunner
  directive: DirectorDirective;
  
  // Мета-информация
  reasoning: string;            // Почему Director принял такое решение
}

// Лог взаимодействия с агентом
export interface AgentCallLog {
  id: string;
  timestamp: number;
  agent: AgentRole;
  model: string;
  
  // Входные данные
  systemPrompt: string;
  userPrompt: string;
  
  // Структурированный контекст (то, что передаётся в промпт)
  context: Record<string, any>;
  
  // Выходные данные
  rawResponse?: string;
  parsedResponse?: any;
  
  // Метаданные
  durationMs?: number;
  tokenEstimate?: number;
  error?: string;
  status: 'pending' | 'success' | 'error';
}

// ============ NARRATOR CONTEXT ============
// Контекст, который Narrator получает для генерации сценария
// ВАЖНО: Narrator сам создаёт драматургию (hook, dilemma, flaw) для персонажа!

export interface NarratorContext {
  // ГЕРОЙ: Только описание персонажа (драматургию создаёт Narrator)
  hero: {
    character: PlayableCharacter;
    // Эти поля заполняются NARRATOR'ом, не CHARACTER_GENERATOR'ом:
    hook: string;           // Narrator создаст
    moralDilemma: string;   // Narrator создаст
    flaw: string;           // Narrator создаст
  };
  
  // МИР: Данные от Golem (генератора мира)
  world: {
    name: string;
    era: string;
    description: string;
    kingdoms: {
      id: number;
      name: string;
      culture: string;
      traits: string[];
      ruler: string;
      personality: string;
      relations: string;
    }[];
    legends: string[];
    majorEvents: string[];
  };
  
  // СТАРТОВАЯ ЛОКАЦИЯ
  startingLocation: {
    kingdomId: number;
    kingdomName: string;
    position: string;       // знать/простолюдин/изгнанник
  };
  
  // АКТЁРЫ ВТОРОГО ПЛАНА: Невыбранные персонажи (используются как NPC)
  supportingCast: {
    characters: PlayableCharacter[];
    instruction: string;    // Как их использовать
  };
  
  // МЕТА
  timeline: string;         // Сезон, год
  tone: string[];           // Желаемый тон истории (epic, personal stakes, etc.)
}

// Инструкции для Narrator по использованию supporting cast
export const SUPPORTING_CAST_INSTRUCTIONS = {
  RIVAL: "Сделай этого персонажа соперником героя - их цели конфликтуют",
  ALLY: "Сделай этого персонажа временным союзником - но у него свои мотивы",
  WILDCARD: "Этот персонаж непредсказуем - может стать как другом, так и врагом",
  OBSERVER: "Этот персонаж наблюдает издалека и появится в критический момент"
};

// ============ SHOWRUNNER CONTEXT ============
// Контекст для агента Showrunner - генератора сцен

export interface ShowrunnerContext {
  // Сценарий от Narrator (общая структура истории)
  scenario: {
    title: string;
    premise: string;
    tone: string;
    heroDramaturgy: {
      incitingIncident: string;
      moralDilemma: string;
      stakes: string;
    };
    currentAct: number;
    actDescription: string;
  };
  
  // Герой
  hero: {
    name: string;
    title: string;
    personality: string;
    background: string;
    ambition: string;
    playstyle: string;
  };
  
  // Текущая локация (откуда берём контекст)
  location: {
    id?: string;               // POI.id
    name: string;
    type: string;              // capital, city, village, etc.
    description?: string;
    specialty?: string;
    mood?: string;
  };
  
  // Государство (политический контекст)
  kingdom: {
    id?: number;               // Kingdom.id
    name: string;
    culture: string;
    ruler: string;
    rulerPersonality: string;
    currentTensions?: string;
  };
  
  // История сцен (для continuity)
  previousScenes?: {
    summary: string;
    lastChoice?: string;
  }[];
  
  // Состояние игрока (для генерации релевантных эффектов)
  playerState?: {
    gold: number;
    reputation: number;
    influence: number;
    inventory: string[];      // Названия предметов
    relationships: string[];  // "NpcName: ally/enemy/neutral"
    flags: string[];          // Активные флаги
  };
  
  // ========= TRAVEL CONTEXT =========
  // Информация о путешествиях и квестах
  travel?: {
    currentLocationId: string;
    currentKingdomId: number;
    visitedLocations: string[];          // Названия посещённых локаций
    unlockedLocations: string[];         // Доступные для путешествия
    
    // Доступные маршруты из текущей локации
    availableRoutes?: {
      locationId: string;
      locationName: string;
      distance: number;
      cost: number;
      danger: 'safe' | 'risky' | 'dangerous';
      requiresUnlock?: boolean;
    }[];
    
    // Активный квест на перемещение
    travelQuest?: {
      targetLocationId: string;
      targetLocationName: string;
      reason: string;
      deadline?: number;
    };
    
    // Если игрок сейчас в пути
    inTransit?: {
      fromName: string;
      toName: string;
      daysRemaining: number;
      totalDays: number;
    };
  };
  
  // Активные квесты
  activeQuests?: {
    id: string;
    title: string;
    currentObjective: string;
    type: string;
  }[];
  
  // Мета
  sceneNumber: number;
  isFirstScene: boolean;
  
  // Тип сцены который нужно сгенерировать
  sceneType?: 'normal' | 'travel' | 'arrival' | 'departure';
}

// ============ SCENE EFFECTS ============
// Эффекты, которые выбор игрока оказывает на мир

export interface SceneEffect {
  type: 'stat' | 'item' | 'relationship' | 'flag' | 'location' | 'travel' | 'quest';
  
  // Для stat: изменение характеристик
  stat?: {
    target: 'player' | 'kingdom' | string; // string = NPC id
    attribute: string;  // 'gold', 'reputation', 'health', 'influence'
    change: number;     // +10, -5, etc.
  };
  
  // Для item: добавление/удаление предмета
  item?: {
    action: 'add' | 'remove';
    itemId: string;
    itemName: string;
  };
  
  // Для relationship: изменение отношений с NPC
  relationship?: {
    npcId: string;
    npcName: string;
    change: number;     // -100 to +100
    newStatus?: 'ally' | 'neutral' | 'enemy' | 'dead';
  };
  
  // Для flag: установка флага для сюжета
  flag?: {
    flagId: string;
    value: boolean | string;
  };
  
  // Для location: разблокировка/изменение локации
  location?: {
    locationId: string;
    action: 'unlock' | 'lock' | 'change_mood';
    newMood?: string;
  };
  
  // Для travel: перемещение игрока или разблокировка маршрута
  travel?: {
    action: 'move' | 'unlock_route' | 'require_travel';
    targetLocationId: string;
    targetLocationName?: string;
    reason?: string;                // Причина для require_travel
    deadline?: number;              // К какой сцене нужно добраться (для require_travel)
  };
  
  // Для quest: добавление/обновление квеста
  quest?: {
    action: 'add' | 'update' | 'complete' | 'fail';
    questId: string;
    title?: string;
    description?: string;
    type?: 'main' | 'travel' | 'fetch' | 'talk' | 'explore';
    objectives?: {
      id: string;
      description: string;
      type: 'travel' | 'item' | 'talk' | 'choice' | 'custom';
      target?: string;
    }[];
    rewards?: {
      gold?: number;
      reputation?: number;
      unlockLocations?: string[];
    };
  };
}

// Выбор игрока в сцене
export interface SceneChoice {
  id: string;
  text: string;
  tone: 'aggressive' | 'diplomatic' | 'cunning' | 'noble' | 'cautious' | 'travel';
  consequence?: string;      // Hint for player (UI)
  effects?: SceneEffect[];   // Actual effects on game state
  nextLocation?: string;     // If choice moves player to new location
  
  // Для travel выборов
  travelTo?: {
    locationId: string;
    locationName: string;
    distance: number;        // Дни в пути
    cost: number;            // Стоимость
    danger: 'safe' | 'risky' | 'dangerous';
  };
  
  // Требования для этого выбора
  requirements?: {
    minGold?: number;
    minReputation?: number;
    requiredItems?: string[];
    requiredFlags?: string[];
    unlockedLocation?: string;   // Должна быть разблокирована локация
  };
}

// Сцена - выход агента Showrunner
export interface Scene {
  id: string;
  sceneNumber: number;
  
  // Локация
  location: string;
  locationId?: string;        // POI.id для привязки к карте
  kingdomId?: number;         // Kingdom.id
  timeOfDay?: string;
  
  // Нарратив
  description: string;
  
  // Диалоги
  dialogue?: {
    speaker: string;
    text: string;
  }[];
  
  // Выборы
  choices: SceneChoice[];
  
  // Для сцен типа "в пути"
  isTravel?: boolean;
  travelFrom?: string;
  travelTo?: string;
  travelProgress?: number;    // 0-100%
  
  // Возможности путешествия (если сцена предлагает перемещение)
  travelOptions?: {
    locationId: string;
    locationName: string;
    distance: number;
    cost: number;
    danger: 'safe' | 'risky' | 'dangerous';
    description?: string;
    isLocked?: boolean;
    lockReason?: string;      // "Требуется квест" или "Недостаточно золота"
  }[];
  
  // Активный квест в этой сцене
  activeQuest?: {
    id: string;
    title: string;
    currentObjective: string;
  };
  
  // Мета (опционально)
  tension?: number;
  tags?: string[];
}

// ============ DEBUG STORE ============
// Хранилище для всех логов агентов

export interface AgentDebugStore {
  logs: AgentCallLog[];
  currentPhase: 'IDLE' | 'GENERATING_LORE' | 'GENERATING_CHARACTERS' | 'GENERATING_SCENARIO' | 'GENERATING_DIRECTIVE' | 'GENERATING_SCENE';
  totalCalls: number;
  totalDurationMs: number;
}

// Создать пустое хранилище
export const createEmptyDebugStore = (): AgentDebugStore => ({
  logs: [],
  currentPhase: 'IDLE',
  totalCalls: 0,
  totalDurationMs: 0
});

// Утилита для создания ID лога
export const createLogId = (agent: AgentRole): string => {
  return `${agent}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
