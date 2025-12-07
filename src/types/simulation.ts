import type { BiomeType } from './world';

export type Season = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';

export type CityCondition = 'INTACT' | 'DAMAGED' | 'BESIEGED' | 'RUINED';

export interface KingdomState {
  id: number; // Ссылка на Kingdom.id из world.ts
  ruler: {
    name: string;
    personality: string; // 'Aggressive', 'Diplomatic', etc.
  };
  resources: {
    gold: number;
    mana: number;
    food: number;
  };
  military: {
    strength: number; // Общая сила армии
    readiness: number; // 0-100%
  };
  diplomacy: {
    enemies: number[]; // ID враждебных королевств
    allies: number[]; // ID союзных королевств
  };
}

export interface LocationState {
  id: string; // Ссылка на POI.id из world.ts
  kingdomId: number; // Текущий владелец (может меняться при захвате)
  condition: CityCondition;
  population: number;
  defense: number; // Текущие очки защиты
  modifiers: string[]; // Например: ['PLAGUE', 'FESTIVAL', 'DROUGHT']
}

// Active conflict between kingdoms
export type ConflictStatus = 'PENDING' | 'ATTACKER_WINNING' | 'DEFENDER_WINNING' | 'STALEMATE' | 'RESOLVED';

export interface ActiveConflict {
  id: string;
  attackerId: number;
  defenderId: number;
  contestedCellIds: number[]; // Cells being fought over
  startTimestamp: number;
  status: ConflictStatus;
  attackerStrength: number; // Snapshot at conflict start
  defenderStrength: number;
  rounds: number; // How many resolution attempts
  pendingResolution?: 'ATTACKER_VICTORY' | 'DEFENDER_VICTORY' | 'RETREAT'; // For LLM to set
}

export interface WorldState {
  date: {
    year: number;
    season: Season;
    day: number;
  };
  kingdoms: Record<number, KingdomState>; // Быстрый доступ по ID
  locations: Record<string, LocationState>; // Быстрый доступ по ID
  activeConflicts: ActiveConflict[]; // Current battles
  globalFlags: string[]; // Глобальные теги, например 'AGE_OF_WAR'
}

// Контекст для передачи в LLM
export interface NarrativeContextFull {
  staticWorld: any; // Ссылка на геометрию
  dynamicState: WorldState;
  targetLocationId?: string;
  targetKingdomId?: number;
}

