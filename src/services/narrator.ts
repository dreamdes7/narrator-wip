import type { Kingdom, POI } from '../types/world';
import type { WorldState } from '../types/simulation';

// Тип ответа от ИИ
export interface NarrativeResponse {
  text: string;
  choices?: { label: string; action: string }[]; // Динамические выборы
  effects?: { 
      gold?: number; 
      mana?: number;
      military?: number;
      reputation?: number;
      locationDamage?: number; // Урон локации
  };
}

// Контекст, который мы отправляем ИИ
interface NarrativeContext {
  location: POI | null;
  kingdom: Kingdom | null;
  worldState: WorldState | null; // Полное состояние мира
  recentHistory: string[];
}

// Имитация задержки для эффекта "мышления"
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class NarratorService {
  // В будущем здесь будет вызов API к LLM
  async generateStory(action: string, context: NarrativeContext): Promise<NarrativeResponse> {
    await delay(800); // Имитация задержки сети

    const locName = context.location?.name || "the wilderness";
    const kingdomName = context.kingdom?.name || "neutral lands";
    const biome = context.kingdom?.geography.dominantBiome || "PLAIN";
    // Climate is tied to LOCATION geography, not owner!
    const climate = context.location?.climate || context.kingdom?.geography.climateZone || "CENTRAL";
    
    // Получаем динамические данные
    const season = context.worldState?.date.season || 'SUMMER';
    const kingdomState = context.kingdom && context.worldState 
        ? context.worldState.kingdoms[context.kingdom.id] 
        : null;
    const locationState = context.location && context.worldState
        ? context.worldState.locations[context.location.id]
        : null;

    const isWar = context.worldState?.globalFlags.includes('WAR_MODE') || false;
    const isRuined = locationState?.condition === 'RUINED';

    // --- Flavor Text Helpers ---
    const getClimateFlavor = () => {
        if (climate === 'NORTH') return "The freezing winds of the North bite at your skin.";
        if (climate === 'SOUTH') return "The sun beats down relentlessly on the golden sands.";
        return "A gentle breeze blows across the fertile plains.";
    };

    // --- МОКИ ГЕНЕРАЦИИ (С учетом состояния) ---
    
    if (action === 'explore') {
      if (isRuined) {
         return {
             text: `You walk through the charred remains of **${locName}**. The war has taken its toll here. Scavengers pick through the rubble.`,
             choices: [
                 { label: "Scavenge for supplies", action: "scavenge" },
                 { label: "Leave this sad place", action: "leave" }
             ]
         };
      }

      const scenarios = [
        `It is ${season} in **${locName}**. ${getClimateFlavor()} The air smells of ${biome === 'FOREST' ? 'pine needles' : 'dust'}. ` +
        (kingdomState ? `Soldiers of **${kingdomState.ruler.name}** patrol the streets.` : ''),
        
        `While exploring the outskirts of **${locName}**, you find an ancient shrine. ` +
        (season === 'WINTER' ? 'It is covered in frost.' : 'Vines are growing over it.'),
      ];

      return {
        text: scenarios[Math.floor(Math.random() * scenarios.length)],
        choices: [
          { label: "Investigate closer", action: "investigate" },
          { label: "Ignore and leave", action: "leave" }
        ],
        effects: { gold: Math.floor(Math.random() * 10) }
      };
    }

    if (action === 'talk') {
      const mood = kingdomState?.resources.food && kingdomState.resources.food < 500 ? 'hungry and desperate' : 'content';
      const greeting = climate === 'NORTH' ? '"Winter is coming,"' : climate === 'SOUTH' ? '"Sun guide you,"' : '"Good day,"';
      
      return {
        text: `An old keeper of **${locName}** looks at you. The people here seem ${mood}. ${greeting} they whisper. "Traveler, in this ${season}, supplies are scarce."`,
        choices: [
          { label: "Offer gold (10g)", action: "give_gold" },
          { label: "Ask for rumors", action: "ask_rumors" }
        ]
      };
    }

    if (action === 'attack') {
      return {
        text: `You order your troops to siege **${locName}**! The defenders of **${kingdomName}** (Strength: ${kingdomState?.military.strength || 'Unknown'}) rally at the walls.`,
        effects: { mana: -10, gold: 50, military: -20, locationDamage: 10 }
      };
    }

    if (action === 'investigate') {
      return {
        text: "You step closer. The runes flare up with blinding light! You feel a surge of ancient power coursing through your veins.",
        effects: { mana: 20 }
      };
    }

    return {
      text: `Nothing significant happens in **${locName}**. The world moves on.`,
    };
  }
}

export const narrator = new NarratorService();
