import type { WorldData } from '../types/world';
import type { WorldState } from '../types/simulation';
import { getTownImageListForPrompt } from '../utils/locationImages';
import { getAvatarsPromptDescription, getAvatarIdsByArchetype } from '../utils/characterAssets';
import type { 
  AgentCallLog, 
  AgentRole, 
  NarratorContext,
  AgentDebugStore,
  ShowrunnerContext,
  Scene,
  PlayerState,
  DirectorContext,
  DirectorAnalysis,
  StoryState,
  DirectorDirective
} from '../types/agents';
import { createLogId, createEmptyDebugStore } from '../types/agents';

// API Configuration
// Используем прокси через Vite dev server для обхода CORS
const API_CONFIG = {
  baseUrl: '/api/llm',  // Проксируется на https://ai.megallm.io/v1
  apiKey: import.meta.env.VITE_MEGA_LLM_API_KEY,
  model: 'gemini-2.5-flash'  // For lore generation
};

const NARRATOR_MODEL = 'gemini-2.5-flash';  // For scenario generation
const CHARACTER_AGENT_MODEL = 'gemini-2.5-flash';  // For character generation
const SHOWRUNNER_MODEL = 'gemini-2.5-flash';  // For scene generation
const DIRECTOR_MODEL = 'gemini-2.5-flash';  // For story direction

// ============ AGENT DEBUG SYSTEM ============
// Глобальное хранилище для отладки агентов

let debugStore: AgentDebugStore = createEmptyDebugStore();
const debugListeners: Set<(store: AgentDebugStore) => void> = new Set();

export const getAgentDebugStore = (): AgentDebugStore => debugStore;

export const subscribeToDebugStore = (listener: (store: AgentDebugStore) => void) => {
  debugListeners.add(listener);
  return () => debugListeners.delete(listener);
};

const notifyDebugListeners = () => {
  debugListeners.forEach(listener => listener(debugStore));
};

const addDebugLog = (log: AgentCallLog) => {
  debugStore = {
    ...debugStore,
    logs: [...debugStore.logs, log],
    totalCalls: debugStore.totalCalls + 1,
    totalDurationMs: debugStore.totalDurationMs + (log.durationMs || 0)
  };
  notifyDebugListeners();
};

const updateDebugLog = (id: string, updates: Partial<AgentCallLog>) => {
  debugStore = {
    ...debugStore,
    logs: debugStore.logs.map(log => 
      log.id === id ? { ...log, ...updates } : log
    )
  };
  if (updates.durationMs) {
    debugStore.totalDurationMs += updates.durationMs;
  }
  notifyDebugListeners();
};

const setDebugPhase = (phase: AgentDebugStore['currentPhase']) => {
  debugStore = { ...debugStore, currentPhase: phase };
  notifyDebugListeners();
};

export const clearDebugStore = () => {
  debugStore = createEmptyDebugStore();
  notifyDebugListeners();
};

// Types
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

// Lore for individual cities/capitals
export interface CityLore {
  id: string;           // matches POI.id
  name: string;
  description: string;  // 1-2 sentences about the city
  specialty: string;    // What this city is known for (trade, military, religion, etc.)
  landmark: string;     // A notable location/building in the city
  mood: string;         // General atmosphere (bustling, somber, festive, etc.)
}

export interface KingdomLore {
  id: number;
  name: string;
  motto: string;        // Kingdom's words/motto (e.g., "Winter is Coming")
  culture: string;      // 2-3 sentences about culture
  history: string;      // 2-3 sentences about history  
  religion: string;     // What they worship/believe
  traits: string[];
  relations: string;
  // Capital and cities with individual lore
  capital: CityLore;
  cities: CityLore[];
  // Initial state values set by LLM
  initialState: {
    rulerName: string;
    rulerTitle: string; // King, Queen, High Lord, Archon, etc.
    rulerPersonality: 'Aggressive' | 'Diplomatic' | 'Balanced' | 'Defensive' | 'Expansionist';
    militaryStrength: number;
    gold: number;
    mana: number;
    food: number;
  };
}

export interface WorldLore {
  worldName: string;
  worldDescription: string;
  era: string;
  majorEvents: string[];
  kingdoms: KingdomLore[];
  legends: string[];
}

// Helper to create world context for LLM
const createWorldContext = (worldData: WorldData, worldState: WorldState): string => {
  const kingdomsInfo = worldData.kingdoms.map(k => {
    const state = worldState.kingdoms[k.id];
    return {
      id: k.id,
      name: k.name,
      climate: k.geography.climateZone,
      biome: k.geography.dominantBiome,
      hasCoastline: k.geography.hasCoastline,
      neighbors: k.geography.neighboringKingdoms.map(nId => 
        worldData.kingdoms.find(kk => kk.id === nId)?.name || 'Unknown'
      ),
      // Capital info
      capital: {
        id: k.capital.id,
        name: k.capital.name,
        biome: k.capital.biome,
        climate: k.capital.climate
      },
      // Cities info
      cities: k.cities.map(c => ({
        id: c.id,
        name: c.name,
        biome: c.biome,
        climate: c.climate
      })),
      militaryStrength: state?.military.strength || 0,
      resources: state?.resources || { gold: 0, mana: 0, food: 0 }
    };
  });

  return JSON.stringify({
    worldSeed: worldData.seed,
    currentYear: worldState.date.year,
    currentSeason: worldState.date.season,
    totalKingdoms: worldData.kingdoms.length,
    kingdoms: kingdomsInfo,
    activeConflicts: worldState.activeConflicts.length
  }, null, 2);
};

// Main LLM call function with debug logging
interface CallLLMOptions {
  agent: AgentRole;
  context?: Record<string, any>;
}

async function callLLM(
  messages: ChatMessage[], 
  overrideModel?: string,
  debugOptions?: CallLLMOptions
): Promise<string> {
  const startTime = Date.now();
  const model = overrideModel || API_CONFIG.model;
  
  // Create debug log entry if debug options provided
  let logId: string | undefined;
  if (debugOptions) {
    logId = createLogId(debugOptions.agent);
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    const userPrompt = messages.find(m => m.role === 'user')?.content || '';
    
    addDebugLog({
      id: logId,
      timestamp: startTime,
      agent: debugOptions.agent,
      model,
      systemPrompt,
      userPrompt,
      context: debugOptions.context || {},
      status: 'pending'
    });
  }
  
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.8,
        max_tokens: 8000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = `LLM API error: ${response.status} - ${errorText}`;
      
      if (logId) {
        updateDebugLog(logId, {
          status: 'error',
          error,
          durationMs: Date.now() - startTime
        });
      }
      
      throw new Error(error);
    }

    const data: LLMResponse = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    // Update debug log with success
    if (logId) {
      updateDebugLog(logId, {
        status: 'success',
        rawResponse: content,
        durationMs: Date.now() - startTime,
        tokenEstimate: Math.ceil((content.length + messages.reduce((acc, m) => acc + m.content.length, 0)) / 4)
      });
    }
    
    return content;
  } catch (error) {
    console.error('LLM call failed:', error);
    
    if (logId) {
      updateDebugLog(logId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime
      });
    }
    
    throw error;
  }
}

// Generate world lore based on current state
export async function generateWorldLore(worldData: WorldData, worldState: WorldState): Promise<WorldLore> {
  setDebugPhase('GENERATING_LORE');
  const worldContext = createWorldContext(worldData, worldState);
  
  // Get available town images for specialty matching
  const townImages = getTownImageListForPrompt();
  const imagesByClimate = {
    NORTH: townImages.filter(i => i.climate === 'NORTH').map(i => `${i.id}: ${i.keywords.join(', ')}`),
    CENTRAL: townImages.filter(i => i.climate === 'CENTRAL').map(i => `${i.id}: ${i.keywords.join(', ')}`),
    SOUTH: townImages.filter(i => i.climate === 'SOUTH').map(i => `${i.id}: ${i.keywords.join(', ')}`)
  };

  const systemPrompt = `Ты мастер-создатель фэнтези миров. Пишешь атмосферные описания как древний летописец.
Каждое королевство должно быть уникальным в зависимости от климата и географии.
ВСЕГДА отвечай ТОЛЬКО валидным JSON - без markdown, без пояснений.`;

  const userPrompt = `Создай детальный лор для этого мира НА РУССКОМ ЯЗЫКЕ:

${worldContext}

ДОСТУПНЫЕ ИЗОБРАЖЕНИЯ ГОРОДОВ (используй эти ключевые слова для поля "specialty"):

Северный климат (NORTH):
${imagesByClimate.NORTH.join('\n')}

Центральный климат (CENTRAL):
${imagesByClimate.CENTRAL.join('\n')}

Южный климат (SOUTH):
${imagesByClimate.SOUTH.join('\n')}

Сгенерируй JSON СТРОГО по этой структуре (ВСЕ ТЕКСТЫ НА РУССКОМ):
{
  "worldName": "Эпическое название континента",
  "worldDescription": "2-3 предложения описывающих характер континента",
  "era": "Название текущей эпохи (напр. Эпоха Раздора)",
  "majorEvents": [
    "Историческое событие 1 (одно предложение)",
    "Историческое событие 2 (одно предложение)", 
    "Историческое событие 3 (одно предложение)"
  ],
  "kingdoms": [
    {
      "id": <id королевства из данных>,
      "name": "<ТОЧНОЕ имя из данных>",
      "motto": "Девиз королевства (2-5 слов)",
      "culture": "2-3 предложения о народе, обычаях, образе жизни",
      "history": "2-3 предложения об истории королевства, основании, ключевых событиях",
      "religion": "Во что верят или кому поклоняются (1 предложение)",
      "traits": ["черта1", "черта2", "черта3"],
      "relations": "1-2 предложения об отношениях с соседями",
      "capital": {
        "id": "<id столицы из данных>",
        "name": "<имя столицы из данных>",
        "description": "2 предложения о столице",
        "specialty": "ИСПОЛЬЗУЙ КЛЮЧЕВЫЕ СЛОВА ИЗ СПИСКА ВЫШЕ по климату города",
        "landmark": "Известное здание или место",
        "mood": "Одно слово - атмосфера (оживлённый/древний/воинственный/мистический)"
      },
      "cities": [
        {
          "id": "<id города из данных>",
          "name": "<имя города из данных>",
          "description": "1-2 предложения о городе",
          "specialty": "КЛЮЧЕВЫЕ СЛОВА ИЗ СПИСКА - напр. 'fishing', 'mining', 'buffalo breeding', 'lumber'",
          "landmark": "Примечательное место",
          "mood": "Одно слово - атмосфера"
        }
      ],
      "initialState": {
        "rulerName": "Полное имя правителя",
        "rulerTitle": "Король/Королева/Верховный Лорд/Архонт/Ярл/и т.д.",
        "rulerPersonality": "Aggressive|Diplomatic|Balanced|Defensive|Expansionist",
        "militaryStrength": <400-900>,
        "gold": <600-1800>,
        "mana": <150-700>,
        "food": <600-1400>
      }
    }
  ],
  "legends": [
    "Миф или легенда известная по всему миру",
    "Другая легенда или пророчество"
  ]
}

ВАЖНЫЕ ПРАВИЛА:
- NORTH климат: Скандинавский/Славянский стиль, суровые воины, высокая военная мощь (700-900), мало маны (150-300), титулы типа Ярл/Верховный Король
- SOUTH климат: Средиземноморский/Арабский стиль, мистики, много маны (500-700), титулы типа Архонт/Султан  
- CENTRAL климат: Феодальный/сбалансированный, интриги, титулы типа Король/Герцог
- ДЛЯ КАЖДОГО ГОРОДА: Выбери specialty используя КЛЮЧЕВЫЕ СЛОВА из списка изображений!
  * FOREST биом → lumber, logging, hunters, woodcutting, forest
  * HILLS биом → mining, quarry, hills, terraces
  * PLAINS биом → farming, village, trade, market, buffalo, savannah
  * Прибрежные королевства → fishing, port, harbor, coast
- specialty должен быть УНИКАЛЬНЫМ для каждого города в королевстве!
- Столица должна быть величественнее обычных городов
- Включи ВСЕ города из данных - не пропускай!
- Используй ТОЧНЫЕ id и имена из входных данных
- ОТВЕЧАЙ ТОЛЬКО ВАЛИДНЫМ JSON`;

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    undefined,
    {
      agent: 'GOLEM',
      context: {
        kingdoms: worldData.kingdoms.map(k => ({
          id: k.id,
          name: k.name,
          climate: k.geography.climateZone,
          biome: k.geography.dominantBiome
        })),
        year: worldState.date.year,
        season: worldState.date.season
      }
    }
  );

  // Parse JSON from response (handle potential markdown code blocks)
  let jsonStr = response.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  }
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  try {
    return JSON.parse(jsonStr) as WorldLore;
  } catch (e) {
    console.error('Failed to parse LLM response as JSON:', jsonStr);
    throw new Error('Invalid JSON response from LLM');
  }
}

// Generate narrative for a specific event/action
export async function generateNarrative(
  action: string,
  context: {
    worldData: WorldData;
    worldState: WorldState;
    worldLore?: WorldLore;
    kingdomId?: number;
    locationId?: string;
  }
): Promise<{ text: string; choices?: { label: string; action: string }[] }> {
  const kingdom = context.kingdomId 
    ? context.worldData.kingdoms.find(k => k.id === context.kingdomId)
    : null;
  
  const location = context.locationId
    ? [...context.worldData.kingdoms.flatMap(k => [k.capital, ...k.cities])].find(p => p.id === context.locationId)
    : null;

  const kingdomLore = context.worldLore?.kingdoms.find(k => k.id === context.kingdomId);

  const systemPrompt = `You are a narrator for a fantasy strategy game. 
Write immersive, atmospheric text that responds to player actions.
Keep responses to 2-4 sentences. Be evocative but concise.
If appropriate, offer 2-3 meaningful choices for the player.`;

  const userPrompt = `Action: ${action}

Context:
- Location: ${location?.name || 'Unknown'} (${location?.biome || 'unknown'} terrain)
- Kingdom: ${kingdom?.name || 'Unknown'} 
- Climate: ${kingdom?.geography.climateZone || 'temperate'}
- Culture: ${kingdomLore?.culture || 'unknown culture'}
- Year: ${context.worldState.date.year}, ${context.worldState.date.season}

${kingdomLore ? `Kingdom traits: ${kingdomLore.traits.join(', ')}` : ''}

Write a narrative response. If choices make sense, include them as JSON at the end:
{"choices": [{"label": "Choice text", "action": "action_id"}, ...]}

Otherwise just write the narrative text.`;

  const response = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]);

  // Try to extract choices if present
  const choicesMatch = response.match(/\{"choices":\s*\[.*?\]\}/s);
  if (choicesMatch) {
    const text = response.replace(choicesMatch[0], '').trim();
    try {
      const choicesData = JSON.parse(choicesMatch[0]);
      return { text, choices: choicesData.choices };
    } catch {
      return { text: response };
    }
  }

  return { text: response };
}

// ============ CHARACTER GENERATOR AGENT ============
// Генерирует ТОЛЬКО описания персонажей. Драматургия - задача NARRATOR.

export interface PlayableCharacter {
  id: string;                       // Уникальный ID
  name: string;
  title: string;                    // Рыцарь, купец, шпион, маг...
  avatarId: string;                 // ID аватара из CHARACTER_AVATARS
  portrait: string;                 // Краткое описание внешности
  age: string;                      // Возраст (молодой/средних лет/пожилой)
  background: string;               // История персонажа - кто он, откуда
  personality: string;              // Характер персонажа
  ambition: string;                 // Чего хочет добиться в жизни (общая цель)
  startingKingdom: number;          // В каком королевстве начинает
  startingPosition: string;         // Социальное положение (знать/простолюдин/изгнанник)
  skills: string[];                 // 3 ключевых навыка
  reputation: string;               // Как его воспринимают окружающие
  quirk: string;                    // Особенность характера или привычка
  playstyle: string;                // Стиль игры: боевой/дипломатия/интриги/исследование
}

export interface CharacterGenerationResult {
  characters: PlayableCharacter[];
  sharedWorld: string;              // Общее описание мира для всех персонажей
  timeline: string;                 // Когда происходят события
}

// ============ SCENARIO GENERATOR (NARRATOR AGENT) ============
// Narrator создаёт ВСЮ драматургию для персонажа

// Драматургия героя - создаётся Narrator'ом
export interface HeroDramaturgy {
  incitingIncident: string;         // Что запускает историю
  moralDilemma: string;             // Между чем и чем выбирать
  secretOrFlaw: string;             // Слабость/тайна героя
  stakes: string;                   // Что на кону
  transformation: string;           // Как изменится герой
}

// Связи героя - создаются Narrator'ом
export interface HeroConnections {
  ally: { name: string; who: string; why: string };
  rival: { name: string; who: string; conflict: string };
  mentor: { name: string; who: string; lesson: string };
  loveInterest?: { name: string; who: string; complication: string } | null;
}

export interface NPCharacter {
  name: string;
  role: string;                     // антагонист/союзник/соперник/наставник/предатель
  allegiance: number | 'neutral';   // Принадлежность к королевству
  personality: string;              // Характер
  motivation: string;               // Скрытая мотивация
  firstAppearance: number;          // В каком акте появляется
  potentialBetrayal: boolean;       // Может ли предать
  relationToPlayer: string;         // Отношение к герою
  isFromSupportingCast?: boolean;   // Это персонаж из других героев?
}

export interface ChekhovsGun {
  element: string;                  // Что это
  introduction: string;             // Как вводится
  payoff: string;                   // Как выстреливает
  actIntroduced: number;
  actPayoff: number;
}

export interface SideConflict {
  name: string;
  parties: string[];                // Кто участвует
  nature: string;                   // Суть конфликта
  connectionToMain: string;         // Как связан с основным сюжетом
  resolution: string;               // Возможное разрешение
}

export interface ScenarioAct {
  actNumber: number;
  title: string;
  description: string;
  keyEvents: string[];
  tensions: string[];
  moralChoices: string[];           // Моральные выборы
  revelations: string[];            // Что раскрывается
  cliffhanger?: string;             // Чем заканчивается акт
}

export interface WorldScenario {
  title: string;
  logline: string;                  // Краткое описание
  premise: string;
  tone: string;                     // эпический/трагический/героический
  centralConflict: string;
  moralQuestion: string;
  
  // ДРАМАТУРГИЯ ГЕРОЯ (создаётся Narrator'ом!)
  heroDramaturgy: HeroDramaturgy;
  connections: HeroConnections;
  playerCharacterArc: string;
  
  // NPC
  npcs: NPCharacter[];
  
  // Структура
  acts: ScenarioAct[];
  sideConflicts: SideConflict[];
  chekhovsGuns: ChekhovsGun[];
  
  // Развязка
  climax: string;
  possibleEndings: {
    triumph: string;                // Героическая победа
    bittersweet: string;            // Победа с ценой
    tragic: string;                 // Трагедия
  };
  
  // Мета
  themes: string[];
  warnings: string[];
}

/**
 * Generate 3 playable characters for player to choose from
 */
export async function generatePlayableCharacters(
  _worldData: WorldData,  // Reserved for future use
  worldState: WorldState,
  worldLore: WorldLore
): Promise<CharacterGenerationResult> {
  setDebugPhase('GENERATING_CHARACTERS');
  
  const kingdomsSummary = worldLore.kingdoms.map(k => ({
    id: k.id,
    name: k.name,
    culture: k.culture,
    ruler: k.initialState?.rulerName,
    personality: k.initialState?.rulerPersonality,
    traits: k.traits
  }));

  const worldContext = {
    worldName: worldLore.worldName,
    era: worldLore.era,
    kingdoms: kingdomsSummary,
    legends: worldLore.legends,
    year: worldState.date.year
  };

  // Получаем список доступных аватаров
  const avatarsDescription = getAvatarsPromptDescription();
  const powerAvatarIds = getAvatarIdsByArchetype('power');
  const shadowAvatarIds = getAvatarIdsByArchetype('shadow');
  const outsiderAvatarIds = getAvatarIdsByArchetype('outsider');

  const systemPrompt = `Ты создатель ПОРТРЕТОВ персонажей для фэнтези мира.
Твоя задача - описать КТО эти люди: их прошлое, характер, положение в обществе.
НЕ ПРИДУМЫВАЙ сюжетные крючки, конфликты или драматургию - это задача другого агента.
Пиши НА РУССКОМ ЯЗЫКЕ. Отвечай ТОЛЬКО валидным JSON.

СТИЛЬ ИМЁН (как в "Игре престолов"):
- Реалистичные, произносимые имена: Эддард, Джон, Роберт, Серсея, Тирион, Бриенна
- Фамилии по родовому принципу: Старк, Ланнистер, Болтон, Мартелл
- ИЗБЕГАЙ: вычурных фэнтезийных имён (Зефирион, Ксилорак, Эльдориан)
- ИЗБЕГАЙ: длинных труднопроизносимых имён

ВАЖНО: Для каждого персонажа выбери avatarId из списка доступных. 
Описание внешности (portrait) должно СООТВЕТСТВОВАТЬ выбранному аватару!`;

  const userPrompt = `Создай 3 играбельных персонажа для этого мира:

${JSON.stringify(worldContext, null, 2)}

${avatarsDescription}

Сгенерируй JSON:
{
  "sharedWorld": "Общее описание текущей ситуации в мире (2-3 предложения)",
  "timeline": "Когда происходит история (сезон, год)",
  "characters": [
    {
      "id": "char_1",
      "name": "Имя Фамилия (простое, произносимое)",
      "avatarId": "ID аватара из списка POWER",
      "title": "Роль/профессия",
      "portrait": "Внешность СООТВЕТСТВУЮЩАЯ аватару (2 предложения)",
      "age": "молодой/средних лет/пожилой",
      "background": "Биография (3-4 предложения, ТОЛЬКО ФАКТЫ)",
      "personality": "Характер (2 предложения)",
      "ambition": "Жизненная цель",
      "startingKingdom": <id королевства>,
      "startingPosition": "знать/рыцарь/простолюдин/изгнанник/чужеземец",
      "skills": ["навык1", "навык2", "навык3"],
      "reputation": "Как его воспринимают",
      "quirk": "Особенность характера",
      "playstyle": "боевой/дипломатия/интриги/исследование/торговля"
    }
  ]
}

ПРАВИЛА:
- Персонаж 1 (POWER): avatarId из [${powerAvatarIds.join(', ')}]
- Персонаж 2 (SHADOW): avatarId из [${shadowAvatarIds.join(', ')}]
- Персонаж 3 (OUTSIDER): avatarId из [${outsiderAvatarIds.join(', ')}]

- portrait ДОЛЖЕН описывать человека с выбранного аватара!
- Имена КОРОТКИЕ: Дункан Вейн, Элена Корт, Марк Риверс
- Каждый персонаж в РАЗНЫХ королевствах
- Каждый playstyle УНИКАЛЕН

ВСЕ ТЕКСТЫ НА РУССКОМ`;

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    CHARACTER_AGENT_MODEL,
    {
      agent: 'CHARACTER_GENERATOR',
      context: {
        worldName: worldLore.worldName,
        era: worldLore.era,
        kingdomCount: kingdomsSummary.length,
        kingdoms: kingdomsSummary.map(k => k.name)
      }
    }
  );

  let jsonStr = response.trim();
  if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
  if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
  jsonStr = jsonStr.trim();

  try {
    const result = JSON.parse(jsonStr) as CharacterGenerationResult;
    
    // Update debug log with parsed response
    const lastLog = debugStore.logs.find(l => l.agent === 'CHARACTER_GENERATOR' && l.status === 'success');
    if (lastLog) {
      updateDebugLog(lastLog.id, { parsedResponse: result });
    }
    
    return result;
  } catch (e) {
    console.error('Failed to parse characters JSON:', jsonStr);
    throw new Error('Invalid characters JSON from LLM');
  }
}

/**
 * Generate a dramatic scenario based on world state, lore, selected character AND supporting cast
 * 
 * @param selectedCharacter - Выбранный игроком персонаж (ГЕРОЙ)
 * @param supportingCast - Невыбранные персонажи (АКТЁРЫ ВТОРОГО ПЛАНА)
 */
export async function generateScenario(
  _worldData: WorldData,  // Reserved for future use (e.g., geography queries)
  worldState: WorldState, 
  worldLore: WorldLore,
  selectedCharacter: PlayableCharacter,
  supportingCast: PlayableCharacter[] = []  // Невыбранные герои как NPC
): Promise<WorldScenario> {
  setDebugPhase('GENERATING_SCENARIO');
  
  // ============ КОНТЕКСТ МИРА (от GOLEM) ============
  const worldContext = {
    worldName: worldLore.worldName,
    era: worldLore.era,
    description: worldLore.worldDescription,
    majorEvents: worldLore.majorEvents,
    legends: worldLore.legends,
    kingdoms: worldLore.kingdoms.map(k => ({
      id: k.id,
      name: k.name,
      motto: k.motto,
      culture: k.culture,
      traits: k.traits,
      ruler: k.initialState?.rulerName,
      rulerTitle: k.initialState?.rulerTitle,
      personality: k.initialState?.rulerPersonality,
      military: k.initialState?.militaryStrength,
      relations: k.relations
    })),
    currentYear: worldState.date.year,
    season: worldState.date.season
  };

  // ============ КОНТЕКСТ ГЕРОЯ (только описание, без драматургии) ============
  const heroContext = {
    name: selectedCharacter.name,
    title: selectedCharacter.title,
    portrait: selectedCharacter.portrait,
    age: selectedCharacter.age,
    background: selectedCharacter.background,
    personality: selectedCharacter.personality,
    ambition: selectedCharacter.ambition,
    startingKingdom: selectedCharacter.startingKingdom,
    startingPosition: selectedCharacter.startingPosition,
    skills: selectedCharacter.skills,
    reputation: selectedCharacter.reputation,
    quirk: selectedCharacter.quirk,
    playstyle: selectedCharacter.playstyle
  };

  // Найдём королевство героя для контекста
  const heroKingdom = worldLore.kingdoms.find(k => k.id === selectedCharacter.startingKingdom);

  // ============ КОНТЕКСТ АКТЁРОВ ВТОРОГО ПЛАНА ============
  const supportingCastContext = supportingCast.map(char => ({
    name: char.name,
    title: char.title,
    background: char.background,
    personality: char.personality,
    ambition: char.ambition,
    skills: char.skills,
    startingKingdom: char.startingKingdom,
    playstyle: char.playstyle,
    // Подсказка для Narrator как использовать персонажа
    suggestedRole: char.playstyle === heroContext.playstyle 
      ? 'СОПЕРНИК - схожие методы, конкуренция за одни цели'
      : char.startingKingdom === heroContext.startingKingdom
        ? 'МЕСТНЫЙ ИГРОК - пути пересекутся'
        : 'ВНЕШНЯЯ СИЛА - представитель другого королевства'
  }));

  // ============ ПОЛНЫЙ КОНТЕКСТ ДЛЯ NARRATOR ============
  const narratorContext: NarratorContext = {
    hero: {
      character: selectedCharacter,
      hook: '',  // Narrator создаст сам
      moralDilemma: '',  // Narrator создаст сам
      flaw: ''  // Narrator создаст сам
    },
    world: {
      name: worldLore.worldName,
      era: worldLore.era,
      description: worldLore.worldDescription,
      kingdoms: worldContext.kingdoms,
      legends: worldLore.legends,
      majorEvents: worldLore.majorEvents
    },
    startingLocation: {
      kingdomId: selectedCharacter.startingKingdom,
      kingdomName: heroKingdom?.name || 'Неизвестное королевство',
      position: selectedCharacter.startingPosition
    },
    supportingCast: {
      characters: supportingCast,
      instruction: 'Используй этих персонажей как NPC в истории героя'
    },
    timeline: `${worldState.date.season}, ${worldState.date.year} год`,
    tone: ['epic', 'personal stakes', 'morally grey']
  };

  // ============ SYSTEM PROMPT ДЛЯ NARRATOR ============
  const systemPrompt = `Ты NARRATOR - мастер эпических историй.
Ты получаешь ОПИСАНИЕ персонажа и создаёшь для него ДРАМАТУРГИЮ: крючок, дилемму, врагов, союзников, сюжет.

ТВОЯ ЗАДАЧА - превратить обычного персонажа в ГЕРОЯ ЭПОСА:
1. Придумай ИНЦИДЕНТ, который вырывает героя из привычной жизни
2. Создай МОРАЛЬНУЮ ДИЛЕММУ, которая будет его терзать
3. Определи его СЛАБОСТЬ/ТАЙНУ, которая может его погубить
4. Втяни его в МАСШТАБНЫЙ КОНФЛИКТ с высокими ставками

МАСШТАБ: Герой должен влиять на судьбы королевств, а не решать мелкие проблемы.
СТИЛЬ: Эпическое фэнтези с политическими интригами и личными драмами.
ЯЗЫК: Русский
ФОРМАТ: Только валидный JSON`;

  // ============ USER PROMPT ДЛЯ NARRATOR ============
  const userPrompt = `Создай ЭПИЧЕСКИЙ СЦЕНАРИЙ для этого персонажа.

═══════════════════════════════════════
ПЕРСОНАЖ (только описание, драматургию создаёшь ТЫ):
═══════════════════════════════════════
${JSON.stringify(heroContext, null, 2)}

═══════════════════════════════════════
МИР:
═══════════════════════════════════════
${JSON.stringify(worldContext, null, 2)}

═══════════════════════════════════════
ДРУГИЕ ПЕРСОНАЖИ (используй как NPC):
═══════════════════════════════════════
${supportingCast.length > 0 
  ? JSON.stringify(supportingCastContext, null, 2)
  : 'Создай оригинальных NPC'}

═══════════════════════════════════════
СТАРТОВАЯ ПОЗИЦИЯ:
═══════════════════════════════════════
Королевство: ${heroKingdom?.name || 'Неизвестно'}
Статус: ${selectedCharacter.startingPosition}
Время: ${worldState.date.season}, ${worldState.date.year} год

═══════════════════════════════════════

Сгенерируй JSON:
{
  "title": "Эпическое название истории",
  "logline": "Одно предложение - суть эпоса",
  "tone": "эпический/трагический/героический",
  
  "heroDramaturgy": {
    "incitingIncident": "ЧТО случилось, что вырвало героя из привычной жизни? (2-3 предложения, КОНКРЕТНОЕ событие)",
    "moralDilemma": "Между ЧЕМ и ЧЕМ герою придётся выбирать? (долг vs любовь, честь vs выживание и т.д.)",
    "secretOrFlaw": "Какая СЛАБОСТЬ или ТАЙНА может погубить героя?",
    "stakes": "Что герой ПОТЕРЯЕТ, если проиграет? (должно быть ЗНАЧИМО)",
    "transformation": "Каким герой станет к концу истории?"
  },
  
  "connections": {
    "ally": { "name": "Имя", "who": "Кто это", "why": "Почему помогает" },
    "rival": { "name": "Имя", "who": "Кто это", "conflict": "В чём конфликт" },
    "mentor": { "name": "Имя", "who": "Кто это", "lesson": "Чему учит" },
    "loveInterest": { "name": "Имя или null", "who": "Кто это", "complication": "Что мешает" }
  },
  
  "premise": "Завязка: как incitingIncident запускает историю (3-4 предложения)",
  "centralConflict": "Главный конфликт - ЗА ЧТО сражается герой?",
  "moralQuestion": "Главный вопрос истории",
  
  "playerCharacterArc": "Арка героя: от кого к кому он меняется (2-3 предложения)",
  
  "npcs": [
    {
      "name": "Имя",
      "role": "антагонист/союзник/соперник/наставник/предатель",
      "allegiance": <id королевства или "neutral">,
      "personality": "Характер (1 предложение)",
      "motivation": "Чего хочет НА САМОМ ДЕЛЕ",
      "firstAppearance": 1,
      "potentialBetrayal": true/false,
      "relationToPlayer": "Отношение к герою",
      "isFromSupportingCast": true/false
    }
  ],
  
  "acts": [
    {
      "actNumber": 1,
      "title": "АКТ 1: Название",
      "description": "Что происходит (3-4 предложения, ЭПИЧНО)",
      "keyEvents": ["Событие 1", "Событие 2", "Событие 3"],
      "tensions": ["Главное напряжение акта"],
      "moralChoices": ["Сложный выбор для героя"],
      "revelations": ["Что узнаёт герой"],
      "cliffhanger": "Чем заканчивается акт (должно заставить читать дальше)"
    }
  ],
  
  "sideConflicts": [
    {
      "name": "Название",
      "parties": ["Сторона 1", "Сторона 2"],
      "nature": "Суть конфликта",
      "connectionToMain": "Как влияет на героя",
      "resolution": "Возможное разрешение"
    }
  ],
  
  "chekhovsGuns": [
    {
      "element": "Предмет/информация/персонаж",
      "introduction": "Как появляется",
      "payoff": "Как выстреливает",
      "actIntroduced": 1,
      "actPayoff": 3
    }
  ],
  
  "climax": "ЭПИЧЕСКАЯ кульминация - как герой решает свою moralDilemma (3-4 предложения)",
  "possibleEndings": {
    "triumph": "Героическая победа - герой преодолевает себя",
    "bittersweet": "Победа с ценой - герой побеждает, но теряет что-то важное",
    "tragic": "Трагедия - слабость героя приводит к падению"
  },
  "themes": ["тема1", "тема2"],
  "warnings": ["Сложные темы если есть"]
}

ПРАВИЛА ЭПИЧНОСТИ:
1. МАСШТАБ: Герой влияет на судьбы КОРОЛЕВСТВ, не деревень
2. СТАВКИ: На кону должны быть ЖИЗНИ, КОРОНЫ, ВОЙНЫ
3. incitingIncident: Должен быть ШОКИРУЮЩИМ и НЕОБРАТИМЫМ
4. moralDilemma: Оба выбора должны быть ПЛОХИМИ по-своему
5. Антагонист: Должен быть УМНЫМ и иметь СВОЮ правду
6. АКТЁРЫ ВТОРОГО ПЛАНА: Включи их как ЗНАЧИМЫХ NPC, но фокус на ГЕРОЕ
7. Каждый акт заканчивается КЛИФФХЭНГЕРОМ
8. playstyle героя (${selectedCharacter.playstyle}) определяет ТИП эпичности:
   - боевой → эпические сражения, осады, поединки
   - дипломатия → политические игры, союзы, браки
   - интриги → заговоры, предательства, тайные войны
   - исследование → древние тайны, забытые силы, экспедиции
   - торговля → экономические войны, гильдии, контрабанда

ЗАПРЕЩЕНО: мелкие квесты, банальное зло, "избранный", "древнее пробуждение"
ОБЯЗАТЕЛЬНО: личные ставки + политические интриги + моральная серость`;

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    NARRATOR_MODEL,
    {
      agent: 'NARRATOR',
      context: narratorContext
    }
  );

  // Parse JSON
  let jsonStr = response.trim();
  if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
  if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
  jsonStr = jsonStr.trim();

  try {
    const result = JSON.parse(jsonStr) as WorldScenario;
    
    // Update debug log with parsed response
    const lastLog = debugStore.logs.find(l => l.agent === 'NARRATOR' && l.status === 'success');
    if (lastLog) {
      updateDebugLog(lastLog.id, { parsedResponse: result });
    }
    
    setDebugPhase('IDLE');
    return result;
  } catch (e) {
    console.error('Failed to parse scenario JSON:', jsonStr);
    setDebugPhase('IDLE');
    throw new Error('Invalid scenario JSON from LLM');
  }
}

// ============ SHOWRUNNER AGENT ============
// Генерирует конкретные сцены на основе сценария Narrator и директив Director

export interface TravelContext {
  currentLocationId: string;
  currentKingdomId: number;
  visitedLocations: string[];
  unlockedLocations: string[];
  availableRoutes?: {
    locationId: string;
    locationName: string;
    distance: number;
    cost: number;
    danger: 'safe' | 'risky' | 'dangerous';
  }[];
  travelQuest?: {
    targetLocationId: string;
    targetLocationName: string;
    reason: string;
    deadline?: number;
  };
  inTransit?: {
    fromId: string;
    fromName: string;
    toId: string;
    toName: string;
    daysRemaining: number;
    totalDays: number;
  };
}

export interface ActiveQuestInfo {
  id: string;
  title: string;
  currentObjective: string;
  type: string;
}

export async function generateScene(
  worldData: WorldData,
  _worldState: WorldState,
  worldLore: WorldLore,
  scenario: WorldScenario,
  selectedCharacter: PlayableCharacter,
  currentLocation: { name: string; type: string; kingdomId: number; id?: string },
  sceneNumber: number = 1,
  previousScenes: { summary: string; lastChoice?: string }[] = [],
  playerState?: PlayerState,
  directive?: DirectorDirective,      // Директива от Director
  storySummary?: string,              // Сводка истории от Director
  travelContext?: TravelContext,      // Контекст путешествий
  activeQuests?: ActiveQuestInfo[],   // Активные квесты
  sceneType: 'normal' | 'travel' | 'arrival' | 'departure' = 'normal'
): Promise<Scene> {
  setDebugPhase('GENERATING_SCENE');
  
  // Find kingdom lore
  const kingdom = worldData.kingdoms.find(k => k.id === currentLocation.kingdomId);
  const kingdomLore = worldLore.kingdoms.find(k => k.id === currentLocation.kingdomId);
  
  // Find location lore (capital or city)
  let locationLore: CityLore | undefined;
  if (kingdomLore) {
    if (kingdom?.capital.name === currentLocation.name) {
      locationLore = kingdomLore.capital;
    } else {
      locationLore = kingdomLore.cities.find(c => c.name === currentLocation.name);
    }
  }
  
  // Use directive's act info if available, otherwise fallback to scene number
  const currentActNumber = directive ? (directive.currentBeat === 'resolution' ? 3 : directive.currentBeat === 'climax' || directive.currentBeat === 'crisis' ? 3 : directive.currentBeat === 'midpoint' ? 2 : directive.currentBeat === 'rising_action' ? 2 : 1) : (sceneNumber <= 3 ? 1 : sceneNumber <= 7 ? 2 : 3);
  const currentAct = scenario.acts?.find(a => a.actNumber === currentActNumber) || scenario.acts?.[0];
  
  // Build Showrunner context
  const showrunnerContext: ShowrunnerContext = {
    scenario: {
      title: scenario.title,
      premise: scenario.premise,
      tone: scenario.tone || 'epic',
      heroDramaturgy: {
        incitingIncident: scenario.heroDramaturgy?.incitingIncident || '',
        moralDilemma: scenario.heroDramaturgy?.moralDilemma || '',
        stakes: scenario.heroDramaturgy?.stakes || ''
      },
      currentAct: currentActNumber,
      actDescription: currentAct?.description || ''
    },
    hero: {
      name: selectedCharacter.name,
      title: selectedCharacter.title,
      personality: selectedCharacter.personality,
      background: selectedCharacter.background,
      ambition: selectedCharacter.ambition,
      playstyle: selectedCharacter.playstyle
    },
    location: {
      id: currentLocation.id,
      name: currentLocation.name,
      type: currentLocation.type,
      description: locationLore?.description,
      specialty: locationLore?.specialty,
      mood: locationLore?.mood
    },
    kingdom: {
      id: currentLocation.kingdomId,
      name: kingdomLore?.name || kingdom?.name || 'Unknown',
      culture: kingdomLore?.culture || '',
      ruler: kingdomLore?.initialState?.rulerName || '',
      rulerPersonality: kingdomLore?.initialState?.rulerPersonality || 'Balanced'
    },
    previousScenes: previousScenes.length > 0 ? previousScenes : undefined,
    playerState: playerState ? {
      gold: playerState.stats.gold,
      reputation: playerState.stats.reputation,
      influence: playerState.stats.influence,
      inventory: playerState.inventory.map(i => i.name),
      relationships: playerState.relationships.map(r => `${r.npcName}: ${r.status}`),
      flags: playerState.flags.map(f => f.id)
    } : undefined,
    // Travel context
    travel: travelContext ? {
      currentLocationId: travelContext.currentLocationId,
      currentKingdomId: travelContext.currentKingdomId,
      visitedLocations: travelContext.visitedLocations,
      unlockedLocations: travelContext.unlockedLocations,
      availableRoutes: travelContext.availableRoutes,
      travelQuest: travelContext.travelQuest,
      inTransit: travelContext.inTransit
    } : undefined,
    activeQuests: activeQuests,
    sceneNumber,
    isFirstScene: sceneNumber === 1,
    sceneType
  };
  
  const systemPrompt = `Ты — SHOWRUNNER, создаёшь интерактивные сцены для фэнтези-игры с открытым миром.

ПРАВИЛА:
1. Описания визуальные, диалоги живые
2. Каждый выбор имеет МЕХАНИЧЕСКИЕ ПОСЛЕДСТВИЯ (effects)
3. Выборы влияют на: золото, репутацию, отношения с NPC, предметы, ПУТЕШЕСТВИЯ
4. Если по сюжету нужно переместиться — добавь TRAVEL выбор

ФОРМАТ JSON:
{
  "id": "scene-${sceneNumber}",
  "sceneNumber": ${sceneNumber},
  "location": "Конкретное место",
  "locationId": "poi_id если известен",
  "kingdomId": число,
  "timeOfDay": "Время суток",
  
  "description": "Текст сцены (2-4 абзаца)",
  
  "dialogue": [
    { "speaker": "Имя", "text": "Реплика" }
  ],
  
  "choices": [
    {
      "id": "choice-1",
      "text": "Действие от первого лица",
      "tone": "aggressive|diplomatic|cunning|noble|cautious|travel",
      "effects": [
        { "type": "stat", "stat": { "attribute": "gold|reputation|influence", "change": число } },
        { "type": "relationship", "relationship": { "npcName": "Имя", "change": число } },
        { "type": "item", "item": { "action": "add|remove", "itemName": "Название" } },
        { "type": "flag", "flag": { "flagId": "id_события", "value": true } },
        { "type": "travel", "travel": { "action": "move|unlock_route|require_travel", "targetLocationId": "id", "targetLocationName": "Название", "reason": "зачем" } },
        { "type": "quest", "quest": { "action": "add|complete", "questId": "id", "title": "Название", "description": "Описание" } }
      ],
      "travelTo": {
        "locationId": "id локации",
        "locationName": "Название",
        "distance": 1-5,
        "cost": число,
        "danger": "safe|risky|dangerous"
      },
      "requirements": {
        "minGold": число,
        "unlockedLocation": "id если нужна разблокировка"
      }
    }
  ],
  
  "travelOptions": [
    {
      "locationId": "id",
      "locationName": "Название города",
      "distance": 2,
      "cost": 20,
      "danger": "safe|risky|dangerous",
      "description": "Описание маршрута",
      "isLocked": false,
      "lockReason": null
    }
  ],
  
  "activeQuest": {
    "id": "quest_id",
    "title": "Название",
    "currentObjective": "Текущая цель"
  },
  
  "isTravel": false
}

ТИПЫ ЭФФЕКТОВ:
- stat: gold (-50..+100), reputation (-20..+20), influence (-10..+10)
- relationship: change (-30..+30) к NPC
- item: add/remove предмета
- flag: установка сюжетного флага
- travel: move, unlock_route, require_travel (ВАЖНО для отправки в другой город!)
- quest: add (добавить квест), complete (завершить)

🚨 ПРИМЕР require_travel (когда по сюжету герой должен пойти в другой город):
{
  "id": "choice-1",
  "text": "Отправиться в Торнвик",
  "tone": "cautious",
  "effects": [
    { 
      "type": "travel", 
      "travel": { 
        "action": "require_travel", 
        "targetLocationId": "poi_city_Tornvik_123",  // ID из списка "ВСЕ ГОРОДА МИРА"!
        "targetLocationName": "Торнвик",             // ДОЛЖЕН совпадать с названием в списке!
        "reason": "Доставить письмо лорду Рейвену" 
      }
    }
  ]
}
⚠️ ВАЖНО: targetLocationId и targetLocationName должны соответствовать друг другу из списка городов!

ТИПЫ СЦЕН:
- normal: обычная сцена в локации
- travel: сцена в пути между локациями
- arrival: прибытие в новую локацию
- departure: отправление из локации

ВАЖНО: 
- Каждый выбор ДОЛЖЕН иметь хотя бы 1 effect!
- Если сюжет требует перемещения в другой город — добавь travel effect с action: "require_travel"
- Travel выборы должны иметь travelTo с деталями маршрута
- travelOptions показывает доступные маршруты для UI`;

  const previousContext = previousScenes.length > 0 
    ? `\n\nПРЕДЫДУЩИЕ СЦЕНЫ:\n${previousScenes.map((s, i) => `Сцена ${i + 1}: ${s.summary}${s.lastChoice ? ` → Выбор: ${s.lastChoice}` : ''}`).join('\n')}`
    : '';

  const userPrompt = `КОНТЕКСТ СЦЕНЫ #${sceneNumber}:

═══ СЦЕНАРИЙ (от Narrator) ═══
Название: "${showrunnerContext.scenario.title}"
Завязка: ${showrunnerContext.scenario.premise}
Тон: ${showrunnerContext.scenario.tone}

${showrunnerContext.isFirstScene ? `⚡ ИНЦИДЕНТ (с этого начинается история):
${showrunnerContext.scenario.heroDramaturgy.incitingIncident}

Моральная дилемма героя: ${showrunnerContext.scenario.heroDramaturgy.moralDilemma}
Ставки: ${showrunnerContext.scenario.heroDramaturgy.stakes}` : ''}

ТЕКУЩИЙ АКТ: ${showrunnerContext.scenario.currentAct}
${showrunnerContext.scenario.actDescription}

═══ ГЕРОЙ ═══
${showrunnerContext.hero.name}, ${showrunnerContext.hero.title}
Характер: ${showrunnerContext.hero.personality}
Предыстория: ${showrunnerContext.hero.background}
Стремление: ${showrunnerContext.hero.ambition}
Стиль игры: ${showrunnerContext.hero.playstyle}

═══ ЛОКАЦИЯ ═══
${showrunnerContext.location.name} (${showrunnerContext.location.type})
${showrunnerContext.location.description || ''}
${showrunnerContext.location.specialty ? `Известна: ${showrunnerContext.location.specialty}` : ''}
${showrunnerContext.location.mood ? `Атмосфера: ${showrunnerContext.location.mood}` : ''}

═══ КОРОЛЕВСТВО ═══
${showrunnerContext.kingdom.name}
Культура: ${showrunnerContext.kingdom.culture}
Правитель: ${showrunnerContext.kingdom.ruler} (${showrunnerContext.kingdom.rulerPersonality})
${previousContext}

${showrunnerContext.playerState ? `═══ СОСТОЯНИЕ ИГРОКА ═══
Золото: ${showrunnerContext.playerState.gold}
Репутация: ${showrunnerContext.playerState.reputation}
Влияние: ${showrunnerContext.playerState.influence}
${showrunnerContext.playerState.inventory.length > 0 ? `Инвентарь: ${showrunnerContext.playerState.inventory.join(', ')}` : ''}
${showrunnerContext.playerState.relationships.length > 0 ? `Отношения: ${showrunnerContext.playerState.relationships.join(', ')}` : ''}` : ''}

${directive ? `═══ ДИРЕКТИВЫ ОТ DIRECTOR ═══
📊 ТЕМП: ${directive.pacing === 'slow_down' ? 'Замедлить, развить персонажей' : 
         directive.pacing === 'build_tension' ? 'Нарастить напряжение' :
         directive.pacing === 'climax' ? '🔥 КУЛЬМИНАЦИЯ — ключевой момент истории!' :
         directive.pacing === 'resolution' ? 'Завершение, резолюция конфликта' : 'Поддерживать текущий темп'}

🎯 ФОКУС: ${directive.focus}

📍 BEAT: ${directive.currentBeat}

${directive.mustInclude?.length ? `✅ ОБЯЗАТЕЛЬНО ВКЛЮЧИТЬ:\n${directive.mustInclude.map(m => `- ${m}`).join('\n')}` : ''}
${directive.shouldAvoid?.length ? `❌ ИЗБЕГАТЬ:\n${directive.shouldAvoid.map(a => `- ${a}`).join('\n')}` : ''}
${directive.targetMilestone ? `🏁 К MILESTONE: ${directive.targetMilestone}` : ''}
${directive.shouldEnd ? `⚠️ ФИНАЛЬНАЯ СЦЕНА! Тип концовки: ${directive.endType}` : ''}` : ''}

${travelContext ? `═══ КОНТЕКСТ ПУТЕШЕСТВИЙ ═══
📍 Текущая локация: ${currentLocation.name} (ID: ${travelContext.currentLocationId})
🏰 Королевство: ID ${travelContext.currentKingdomId}

🗺️ ПОСЕЩЁННЫЕ ЛОКАЦИИ: ${travelContext.visitedLocations.length > 0 ? travelContext.visitedLocations.join(', ') : 'Только стартовая'}

🌍 ВСЕ ГОРОДА МИРА (используй эти ID для require_travel):
${worldData.kingdoms.map(k => 
  `${k.name} (ID королевства: ${k.id}):\n` +
  `  - ${k.capital.name} [ID: ${k.capital.id}] (столица)\n` +
  k.cities.map(c => `  - ${c.name} [ID: ${c.id}]`).join('\n')
).join('\n')}

${travelContext.availableRoutes && travelContext.availableRoutes.length > 0 ? `🛤️ ДОСТУПНЫЕ МАРШРУТЫ ИЗ ${currentLocation.name} (текущее королевство):
${travelContext.availableRoutes.map(r =>
  `- ${r.locationName} [ID: ${r.locationId}] (${r.distance} дн., ${r.cost} золота, ${r.danger === 'safe' ? 'безопасно' : r.danger === 'risky' ? 'рискованно' : 'опасно'})`
).join('\n')}` : ''}

${travelContext.travelQuest ? `🎯 КВЕСТ НА ПЕРЕМЕЩЕНИЕ:
Цель: ${travelContext.travelQuest.targetLocationName} (ID: ${travelContext.travelQuest.targetLocationId})
Причина: ${travelContext.travelQuest.reason}
${travelContext.travelQuest.deadline ? `Дедлайн: сцена ${travelContext.travelQuest.deadline}` : ''}
⚠️ При прибытии в ${travelContext.travelQuest.targetLocationName} ОБЯЗАТЕЛЬНО укажи locationId: "${travelContext.travelQuest.targetLocationId}"` : ''}

${travelContext.inTransit ? `🚶 В ПУТИ:
Из: ${travelContext.inTransit.fromName}
В: ${travelContext.inTransit.toName} (ID: ${travelContext.inTransit.toId})
Осталось: ${travelContext.inTransit.daysRemaining} из ${travelContext.inTransit.totalDays} дней
⚠️ При прибытии ОБЯЗАТЕЛЬНО укажи locationId: "${travelContext.inTransit.toId}" и kingdomId` : ''}` : ''}

${activeQuests && activeQuests.length > 0 ? `═══ АКТИВНЫЕ КВЕСТЫ ═══
${activeQuests.map(q => `📜 ${q.title} (${q.type})
   Цель: ${q.currentObjective}`).join('\n')}` : ''}

${storySummary ? `═══ СВОДКА ИСТОРИИ ═══
${storySummary}` : ''}

═══ ЗАДАЧА ═══
${showrunnerContext.isFirstScene 
  ? `Это ПЕРВАЯ СЦЕНА. Начни с incitingIncident — покажи момент, который меняет жизнь героя навсегда.
  Сделай это КИНЕМАТОГРАФИЧНО. Герой должен оказаться в ситуации, требующей немедленного выбора.`
  : directive?.pacing === 'climax' 
    ? `Это КУЛЬМИНАЦИЯ. Момент истины. Герой должен сделать ключевой выбор, который определит исход истории.
    Максимальное напряжение. Все ставки на кону.`
  : directive?.shouldEnd
    ? `Это ФИНАЛЬНАЯ СЦЕНА. Заверши историю достойно. Покажи последствия выбора героя.
    Тип концовки: ${directive.endType}`
  : `Это сцена #${sceneNumber}. Следуй директивам Director.
  ${directive?.focus ? `Фокус: ${directive.focus}` : 'Продолжи историю логично.'}`}

ВАЖНО:
- Минимум 3 выбора, максимум 5 (если не финал)
- Выборы должны соответствовать playstyle героя (${showrunnerContext.hero.playstyle})
- Каждый выбор ведёт историю в РАЗНОМ направлении
- НЕ пиши "продолжение следует" — оставь на выборе
${directive?.shouldEnd ? '- Если финал: можно дать 1-2 эпилоговых выбора или просто завершить описанием' : ''}

ПРАВИЛА ПУТЕШЕСТВИЙ:
${sceneType === 'travel' ? `- Это сцена В ПУТИ. Опиши события дороги, встречи, опасности.
- isTravel: true
- Выборы: как справиться с препятствиями в пути` : 
sceneType === 'arrival' ? `- Это сцена ПРИБЫТИЯ в новую локацию. Опиши первые впечатления.
- Покажи что особенного в этом месте
- Дай выборы: с кем поговорить, куда пойти` :
sceneType === 'departure' ? `- Герой собирается покинуть локацию.
- Дай travel выборы для путешествия в другие города
- Используй travelOptions для списка доступных маршрутов` :
`🚨 КОГДА ПО СЮЖЕТУ ГЕРОЙ ДОЛЖЕН ОТПРАВИТЬСЯ В ДРУГОЙ ГОРОД:
1. Добавь к ЛЮБОМУ подходящему выбору travel effect:
   { "type": "travel", "travel": { "action": "require_travel", "targetLocationId": "ID_ИЗ_СПИСКА_ГОРОДОВ", "targetLocationName": "Имя города", "reason": "Зачем идти" }}
2. targetLocationId ОБЯЗАТЕЛЬНО бери из списка "ВСЕ ГОРОДА МИРА" выше! Название города ДОЛЖНО совпадать с targetLocationName!
3. После выбора с require_travel на карте появится маркер цели

- Если игрок может свободно уйти — добавь travel choice (tone: "travel") с travelTo
- Если в сцене есть квест на перемещение — напомни о цели`}

⚠️ КРИТИЧЕСКИ ВАЖНО - locationId и kingdomId:
- ВСЕГДА указывай locationId и kingdomId для сцены!
- locationId берётся из КОНТЕКСТА ПУТЕШЕСТВИЙ (ID локаций в маршрутах или квесте)
- Если герой прибыл в новое место — укажи ID этого места
- Если герой в пути или в текущей локации — укажи currentLocationId: "${travelContext?.currentLocationId || ''}"
${travelContext?.travelQuest ? `
⚠️ АКТИВЕН КВЕСТ НА ПЕРЕМЕЩЕНИЕ в ${travelContext.travelQuest.targetLocationName}!
При прибытии укажи locationId: "${travelContext.travelQuest.targetLocationId}"
Убедись что один из выборов ведёт к выполнению квеста.` : ''}
${travelContext?.inTransit ? `
⚠️ ГЕРОЙ В ПУТИ в ${travelContext.inTransit.toName}!
При прибытии укажи locationId: "${travelContext.inTransit.toId}"` : ''}

Генерируй JSON:`;

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    SHOWRUNNER_MODEL,
    {
      agent: 'SHOWRUNNER',
      context: showrunnerContext
    }
  );

  // Parse JSON
  let jsonStr = response.trim();
  if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
  if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
  jsonStr = jsonStr.trim();

  try {
    const result = JSON.parse(jsonStr) as Scene;
    
    // Update debug log with parsed response
    const lastLog = debugStore.logs.find(l => l.agent === 'SHOWRUNNER' && l.status === 'success');
    if (lastLog) {
      updateDebugLog(lastLog.id, { parsedResponse: result });
    }
    
    setDebugPhase('IDLE');
    return result;
  } catch (e) {
    console.error('Failed to parse scene JSON:', jsonStr);
    setDebugPhase('IDLE');
    throw new Error('Invalid scene JSON from Showrunner');
  }
}

// ============ DIRECTOR AGENT ============
// Анализирует прогресс истории и даёт директивы Showrunner

// Создать начальное состояние истории
export const createInitialStoryState = (scenario: WorldScenario): StoryState => ({
  currentAct: 1,
  actProgress: 0,
  scenesInCurrentAct: 0,
  milestones: [
    { id: 'act1_setup', name: 'Завязка истории', act: 1, reached: false },
    { id: 'act1_incident', name: 'Инцидент произошёл', act: 1, reached: false },
    { id: 'act2_confrontation', name: 'Первое столкновение', act: 2, reached: false },
    { id: 'act2_midpoint', name: 'Точка невозврата', act: 2, reached: false },
    { id: 'act3_crisis', name: 'Кризис', act: 3, reached: false },
    { id: 'act3_climax', name: 'Кульминация', act: 3, reached: false }
  ],
  currentFocus: scenario.heroDramaturgy?.incitingIncident || 'Начало истории',
  storySummary: '',
  lastSceneSummary: '',
  isClimax: false,
  isEpilogue: false,
  isComplete: false
});

export async function generateDirective(
  scenario: WorldScenario,
  currentStoryState: StoryState,
  lastScene: Scene,
  playerChoice: string,
  playerState: PlayerState,
  totalScenes: number
): Promise<DirectorAnalysis> {
  setDebugPhase('GENERATING_DIRECTIVE');
  
  const directorContext: DirectorContext = {
    scenario: {
      title: scenario.title,
      premise: scenario.premise,
      acts: scenario.acts || [],
      heroDramaturgy: {
        incitingIncident: scenario.heroDramaturgy?.incitingIncident || '',
        moralDilemma: scenario.heroDramaturgy?.moralDilemma || '',
        stakes: scenario.heroDramaturgy?.stakes || ''
      }
    },
    currentStoryState,
    lastScene: {
      description: lastScene.description.substring(0, 500),
      location: lastScene.location,
      choices: lastScene.choices.map(c => c.text)
    },
    playerChoice,
    playerState: {
      gold: playerState.stats.gold,
      reputation: playerState.stats.reputation,
      relationships: playerState.relationships.map(r => `${r.npcName}: ${r.status}`)
    },
    totalScenes
  };

  const systemPrompt = `Ты — DIRECTOR, управляешь сценарным движком интерактивной истории.

ТВОЯ РОЛЬ:
1. Анализировать что произошло в последней сцене
2. Отслеживать прогресс по сценарию (акты, milestones)
3. Решать темп повествования
4. Давать чёткие директивы Showrunner для следующей сцены

СТРУКТУРА ИСТОРИИ:
- АКТ 1 (Завязка): Знакомство с миром, inciting incident
- АКТ 2 (Развитие): Конфликт нарастает, midpoint, ставки повышаются
- АКТ 3 (Развязка): Кризис, кульминация, резолюция

ПРАВИЛА ТЕМПА:
- slow_down: Если игрок торопится, нужно развить персонажей/мир
- maintain: История идёт нормально
- build_tension: Пора повышать ставки
- climax: Время кульминации
- resolution: После кульминации, завершение

ФОРМАТ JSON:
{
  "updatedStoryState": {
    "currentAct": 1|2|3,
    "actProgress": 0-100,
    "scenesInCurrentAct": число,
    "milestones": [...текущие milestones с обновлённым reached...],
    "currentFocus": "На чём сейчас фокус истории",
    "storySummary": "Краткая сводка ВСЕЙ истории до этого момента (2-3 предложения)",
    "lastSceneSummary": "Что произошло в последней сцене (1 предложение)",
    "isClimax": false,
    "isEpilogue": false,
    "isComplete": false
  },
  "directive": {
    "pacing": "slow_down|maintain|build_tension|climax|resolution",
    "focus": "Конкретный фокус для следующей сцены",
    "currentBeat": "setup|rising_action|midpoint|crisis|climax|resolution",
    "mustInclude": ["что обязательно включить"],
    "shouldAvoid": ["чего избегать"],
    "targetMilestone": "id milestone к которому вести",
    "shouldEnd": false,
    "endType": null
  },
  "reasoning": "Почему ты принял такое решение (1-2 предложения)"
}`;

  const userPrompt = `АНАЛИЗИРУЙ СИТУАЦИЮ:

═══ СЦЕНАРИЙ ═══
"${directorContext.scenario.title}"
${directorContext.scenario.premise}

Моральная дилемма героя: ${directorContext.scenario.heroDramaturgy.moralDilemma}
Ставки: ${directorContext.scenario.heroDramaturgy.stakes}

═══ ТЕКУЩЕЕ СОСТОЯНИЕ ═══
Акт: ${currentStoryState.currentAct}
Прогресс акта: ${currentStoryState.actProgress}%
Всего сцен: ${totalScenes}
Сцен в текущем акте: ${currentStoryState.scenesInCurrentAct}

Достигнутые milestones:
${currentStoryState.milestones.filter(m => m.reached).map(m => `✓ ${m.name}`).join('\n') || 'Нет'}

Недостигнутые milestones:
${currentStoryState.milestones.filter(m => !m.reached).map(m => `○ ${m.name} (Акт ${m.act})`).join('\n')}

═══ ПОСЛЕДНЯЯ СЦЕНА ═══
Локация: ${directorContext.lastScene.location}
${directorContext.lastScene.description}

ВЫБОР ИГРОКА: "${playerChoice}"

═══ СОСТОЯНИЕ ИГРОКА ═══
Золото: ${directorContext.playerState.gold}
Репутация: ${directorContext.playerState.reputation}
Отношения: ${directorContext.playerState.relationships.join(', ') || 'Нет'}

═══ ЗАДАЧА ═══
1. Обнови milestones если какой-то был достигнут
2. Определи текущий beat истории
3. Реши нужно ли менять акт
4. Дай директиву Showrunner

${totalScenes >= 10 && !currentStoryState.isClimax ? 'ВНИМАНИЕ: История идёт долго. Рассмотри переход к кульминации.' : ''}
${currentStoryState.isClimax ? 'История в КУЛЬМИНАЦИИ. После разрешения конфликта — эпилог.' : ''}

Генерируй JSON:`;

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    DIRECTOR_MODEL,
    {
      agent: 'DIRECTOR',
      context: directorContext
    }
  );

  // Parse JSON
  let jsonStr = response.trim();
  if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
  if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
  jsonStr = jsonStr.trim();

  try {
    const result = JSON.parse(jsonStr) as DirectorAnalysis;
    
    // Update debug log
    const lastLog = debugStore.logs.find(l => l.agent === 'DIRECTOR' && l.status === 'success');
    if (lastLog) {
      updateDebugLog(lastLog.id, { parsedResponse: result });
    }
    
    setDebugPhase('IDLE');
    return result;
  } catch (e) {
    console.error('Failed to parse director JSON:', jsonStr);
    setDebugPhase('IDLE');
    throw new Error('Invalid director JSON');
  }
}

// Export for testing
export { createWorldContext, callLLM };

