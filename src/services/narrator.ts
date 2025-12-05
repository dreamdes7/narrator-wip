import type { Kingdom, POI } from '../types/world';

// Тип ответа от ИИ
export interface NarrativeResponse {
  text: string;
  choices?: { label: string; action: string }[]; // Динамические выборы
  effects?: { gold?: number; mana?: number }; // Игровые эффекты
}

// Контекст, который мы отправляем ИИ
interface NarrativeContext {
  location: POI | null;
  kingdom: Kingdom | null;
  year: number;
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

    // --- МОКИ ГЕНЕРАЦИИ (В будущем это делает нейронка) ---
    
    if (action === 'explore') {
      const scenarios = [
        `You wander through the winding streets of **${locName}**. The air smells of ${biome === 'FOREST' ? 'pine needles and rain' : 'dust and spices'}. A hooded figure beckons you into a shadowy alley.`,
        `While exploring the outskirts of **${locName}**, you discover ruins dating back to the Age of Silence. Strange runes glow faintly on the stones.`,
        `The market of **${locName}** is bustling today. Merchants from **${kingdomName}** are shouting prices for rare artifacts found in the ${biome.toLowerCase()}.`
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
      return {
        text: `An old keeper of **${locName}** looks at you with weary eyes. "These lands of **${kingdomName}** have seen too much war," they whisper. "Tell me, traveler, do you bring peace or ruin?"`,
        choices: [
          { label: "I bring peace", action: "reply_peace" },
          { label: "I serve my own interests", action: "reply_neutral" }
        ]
      };
    }

    if (action === 'attack') {
      return {
        text: `You order your troops to siege **${locName}**! The defenders of **${kingdomName}** rally at the walls. Arrows fly like angry hornets. The battle for the ${biome.toLowerCase()} has begun!`,
        effects: { mana: -10, gold: 50 }
      };
    }

    if (action === 'investigate') {
      return {
        text: "You step closer. The runes flare up with blinding light! You feel a surge of ancient power coursing through your veins.",
        effects: { mana: 20 }
      };
    }

    return {
      text: `Nothing significant happens in **${locName}** this time. The world moves on.`,
    };
  }
}

export const narrator = new NarratorService();

