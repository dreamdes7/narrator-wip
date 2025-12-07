import { useState, useCallback, useEffect } from 'react';
import type { WorldData, POI } from '../types/world';
import type { WorldState } from '../types/simulation';
import { 
  generateWorldLore, 
  generateScenario, 
  generatePlayableCharacters,
  generateScene,
  generateDirective,
  createInitialStoryState,
  getAgentDebugStore,
  subscribeToDebugStore,
  clearDebugStore,
  type WorldLore, 
  type WorldScenario,
  type PlayableCharacter,
  type CharacterGenerationResult,
  type TravelContext,
  type ActiveQuestInfo
} from '../services/llmService';
import type { 
  AgentDebugStore, 
  Scene, 
  SceneChoice,
  SceneEffect,
  PlayerState,
  AppliedEffect,
  StoryState,
  DirectorDirective
} from '../types/agents';
import { createInitialPlayerState } from '../types/agents';
import type { TravelState, TravelRoute, Quest } from '../types/travel';
import { 
  getKingdomRoutes,
  getKingdomLocationIds,
  getPOIById,
  createTravelQuest,
  updateQuestsOnArrival
} from '../utils/travelSystem';

// Функция применения эффектов к состоянию игрока
const applyEffects = (
  state: PlayerState, 
  effects: SceneEffect[], 
  sceneNumber: number
): { newState: PlayerState; appliedEffects: AppliedEffect[] } => {
  const newState = JSON.parse(JSON.stringify(state)) as PlayerState;
  const appliedEffects: AppliedEffect[] = [];

  for (const effect of effects) {
    switch (effect.type) {
      case 'stat':
        if (effect.stat) {
          const attr = effect.stat.attribute as keyof typeof newState.stats;
          if (attr in newState.stats) {
            const oldValue = newState.stats[attr];
            newState.stats[attr] = Math.max(0, oldValue + effect.stat.change);
            
            const isPositive = effect.stat.change > 0;
            appliedEffects.push({
              description: `${attr === 'gold' ? 'Золото' : attr === 'reputation' ? 'Репутация' : 'Влияние'}: ${isPositive ? '+' : ''}${effect.stat.change}`,
              type: isPositive ? 'positive' : 'negative',
              icon: attr === 'gold' ? '💰' : attr === 'reputation' ? '⭐' : '👑'
            });
          }
        }
        break;

      case 'item':
        if (effect.item) {
          if (effect.item.action === 'add') {
            const existing = newState.inventory.find(i => i.name === effect.item!.itemName);
            if (existing) {
              existing.quantity++;
            } else {
              newState.inventory.push({
                id: `item-${Date.now()}`,
                name: effect.item.itemName,
                type: 'key',
                quantity: 1
              });
            }
            appliedEffects.push({
              description: `Получено: ${effect.item.itemName}`,
              type: 'positive',
              icon: '📦'
            });
          } else {
            const idx = newState.inventory.findIndex(i => i.name === effect.item!.itemName);
            if (idx >= 0) {
              if (newState.inventory[idx].quantity > 1) {
                newState.inventory[idx].quantity--;
              } else {
                newState.inventory.splice(idx, 1);
              }
              appliedEffects.push({
                description: `Потеряно: ${effect.item.itemName}`,
                type: 'negative',
                icon: '📦'
              });
            }
          }
        }
        break;

      case 'relationship':
        if (effect.relationship) {
          const rel = newState.relationships.find(r => r.npcName === effect.relationship!.npcName);
          if (rel) {
            rel.relation = Math.max(-100, Math.min(100, rel.relation + effect.relationship.change));
            if (effect.relationship.newStatus) {
              rel.status = effect.relationship.newStatus;
            }
          } else {
            newState.relationships.push({
              npcId: `npc-${Date.now()}`,
              npcName: effect.relationship.npcName,
              relation: effect.relationship.change,
              status: effect.relationship.newStatus || (effect.relationship.change > 0 ? 'neutral' : 'rival')
            });
          }
          
          const isPositive = effect.relationship.change > 0;
          appliedEffects.push({
            description: `${effect.relationship.npcName}: ${isPositive ? '+' : ''}${effect.relationship.change}`,
            type: isPositive ? 'positive' : 'negative',
            icon: isPositive ? '💚' : '💔'
          });
        }
        break;

      case 'flag':
        if (effect.flag) {
          const existing = newState.flags.find(f => f.id === effect.flag!.flagId);
          if (existing) {
            existing.value = effect.flag.value;
          } else {
            newState.flags.push({
              id: effect.flag.flagId,
              value: effect.flag.value,
              setAt: sceneNumber
            });
          }
          appliedEffects.push({
            description: `Событие: ${effect.flag.flagId}`,
            type: 'neutral',
            icon: '🚩'
          });
        }
        break;

      case 'location':
        if (effect.location) {
          if (effect.location.action === 'unlock' && !newState.visitedLocations.includes(effect.location.locationId)) {
            newState.visitedLocations.push(effect.location.locationId);
            appliedEffects.push({
              description: `Открыта локация: ${effect.location.locationId}`,
              type: 'positive',
              icon: '🗺️'
            });
          }
        }
        break;
        
      // Travel effects are processed separately in the hook
      case 'travel':
        // Handled in processTravelEffects
        break;
        
      // Quest effects are processed separately in the hook  
      case 'quest':
        // Handled in processQuestEffects
        break;
    }
  }

  return { newState, appliedEffects };
};

// Process travel-specific effects
const processTravelEffects = (
  effects: SceneEffect[],
  currentTravelState: TravelState,
  worldData: WorldData
): { newTravelState: TravelState; appliedEffects: AppliedEffect[]; newQuests: Quest[] } => {
  let newTravelState = { ...currentTravelState };
  const appliedEffects: AppliedEffect[] = [];
  const newQuests: Quest[] = [];

  for (const effect of effects) {
    if (effect.type === 'travel' && effect.travel) {
      switch (effect.travel.action) {
        case 'unlock_route':
          if (effect.travel.targetLocationId && !newTravelState.unlockedLocations.includes(effect.travel.targetLocationId)) {
            newTravelState = {
              ...newTravelState,
              unlockedLocations: [...newTravelState.unlockedLocations, effect.travel.targetLocationId],
              unlockedRoutes: [...newTravelState.unlockedRoutes, effect.travel.targetLocationId]
            };
            appliedEffects.push({
              description: `Разблокирован маршрут: ${effect.travel.targetLocationName || 'новая локация'}`,
              type: 'positive',
              icon: '🗺️'
            });
          }
          break;
          
        case 'require_travel':
          if (effect.travel.targetLocationId && effect.travel.reason) {
            const targetPOI = getPOIById(worldData, effect.travel.targetLocationId);
            
            // Create travel quest
            const quest = createTravelQuest(
              effect.travel.targetLocationId,
              targetPOI?.name || effect.travel.targetLocationName || 'Неизвестная локация',
              effect.travel.reason,
              1, // act
              0, // scene (will be set properly)
              effect.travel.deadline
            );
            newQuests.push(quest);
            
            // Set travel quest in state
            newTravelState = {
              ...newTravelState,
              travelQuest: {
                targetLocationId: effect.travel.targetLocationId,
                reason: effect.travel.reason,
                deadline: effect.travel.deadline,
                questId: quest.id
              }
            };
            
            // Auto-unlock the location
            if (!newTravelState.unlockedLocations.includes(effect.travel.targetLocationId)) {
              newTravelState.unlockedLocations = [...newTravelState.unlockedLocations, effect.travel.targetLocationId];
              newTravelState.unlockedRoutes = [...newTravelState.unlockedRoutes, effect.travel.targetLocationId];
            }
            
            appliedEffects.push({
              description: `Квест: ${effect.travel.reason}`,
              type: 'neutral',
              icon: '⭐'
            });
          }
          break;
          
        case 'move':
          // Instant move (teleport/fast travel)
          if (effect.travel.targetLocationId) {
            newTravelState = {
              ...newTravelState,
              currentLocationId: effect.travel.targetLocationId,
              visitedLocations: newTravelState.visitedLocations.includes(effect.travel.targetLocationId)
                ? newTravelState.visitedLocations
                : [...newTravelState.visitedLocations, effect.travel.targetLocationId]
            };
            appliedEffects.push({
              description: `Перемещение: ${effect.travel.targetLocationName || 'новая локация'}`,
              type: 'neutral',
              icon: '🚶'
            });
          }
          break;
      }
    }
  }

  return { newTravelState, appliedEffects, newQuests };
};

export const useWorldLore = () => {
  const [lore, setLore] = useState<WorldLore | null>(null);
  const [scenario, setScenario] = useState<WorldScenario | null>(null);
  
  // Character state
  const [characters, setCharacters] = useState<PlayableCharacter[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<PlayableCharacter | null>(null);
  const [characterContext, setCharacterContext] = useState<{ sharedWorld: string; timeline: string } | null>(null);
  
  // Scene state (Showrunner)
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [sceneHistory, setSceneHistory] = useState<{ summary: string; lastChoice?: string }[]>([]);
  const [sceneNumber, setSceneNumber] = useState(0);
  const [isGameStarted, setIsGameStarted] = useState(false);
  
  // Player State
  const [playerState, setPlayerState] = useState<PlayerState>(createInitialPlayerState());
  const [lastAppliedEffects, setLastAppliedEffects] = useState<AppliedEffect[]>([]);
  
  // Story State (Director)
  const [storyState, setStoryState] = useState<StoryState | null>(null);
  const [lastDirective, setLastDirective] = useState<DirectorDirective | null>(null);
  
  // Travel & Quest State
  const [travelState, setTravelState] = useState<TravelState | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingCharacters, setIsGeneratingCharacters] = useState(false);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [isGeneratingScene, setIsGeneratingScene] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Agent Debug Store
  const [debugStore, setDebugStore] = useState<AgentDebugStore>(() => getAgentDebugStore());
  
  // Subscribe to debug store updates
  useEffect(() => {
    // Initial sync
    setDebugStore(getAgentDebugStore());
    
    // Subscribe to future updates
    const unsubscribe = subscribeToDebugStore((newStore) => {
      setDebugStore({ ...newStore }); // Force new reference
    });
    return unsubscribe;
  }, []);

  const generate = useCallback(async (worldData: WorldData, worldState: WorldState) => {
    setIsGenerating(true);
    setError(null);

    try {
      console.log('Generating world lore via LLM...');
      const generatedLore = await generateWorldLore(worldData, worldState);
      console.log('Lore generated:', generatedLore);
      setLore(generatedLore);
      return generatedLore;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate lore';
      console.error('Lore generation failed:', errorMsg);
      setError(errorMsg);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // Generate playable characters (after lore)
  const generateCharacters = useCallback(async (
    worldData: WorldData, 
    worldState: WorldState,
    existingLore: WorldLore
  ) => {
    setIsGeneratingCharacters(true);
    setError(null);
    setSelectedCharacter(null);

    try {
      console.log('Generating playable characters via LLM...');
      const result: CharacterGenerationResult = await generatePlayableCharacters(worldData, worldState, existingLore);
      console.log('Characters generated:', result);
      setCharacters(result.characters);
      setCharacterContext({ sharedWorld: result.sharedWorld, timeline: result.timeline });
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate characters';
      console.error('Character generation failed:', errorMsg);
      setError(errorMsg);
      return null;
    } finally {
      setIsGeneratingCharacters(false);
    }
  }, []);

  const selectCharacter = useCallback((character: PlayableCharacter) => {
    console.log('Character selected:', character.name);
    setSelectedCharacter(character);
    // Инициализируем состояние игрока с начальным золотом в зависимости от персонажа
    const startingGold = character.playstyle === 'торговля' ? 100 : 50;
    setPlayerState(createInitialPlayerState(startingGold));
  }, []);

  // Generate scenario (requires selected character)
  const generateWorldScenario = useCallback(async (
    worldData: WorldData, 
    worldState: WorldState,
    existingLore: WorldLore,
    character: PlayableCharacter,
    allCharacters?: PlayableCharacter[]
  ) => {
    setIsGeneratingScenario(true);
    setError(null);

    const supportingCast = allCharacters 
      ? allCharacters.filter(c => c.id !== character.id)
      : characters.filter(c => c.id !== character.id);

    try {
      console.log('Generating scenario for character:', character.name);
      console.log('Supporting cast (other characters as NPCs):', supportingCast.map(c => c.name));
      
      const generatedScenario = await generateScenario(
        worldData, 
        worldState, 
        existingLore, 
        character,
        supportingCast
      );
      
      console.log('Scenario generated:', generatedScenario);
      setScenario(generatedScenario);
      return generatedScenario;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate scenario';
      console.error('Scenario generation failed:', errorMsg);
      setError(errorMsg);
      return null;
    } finally {
      setIsGeneratingScenario(false);
    }
  }, [characters]);

  // Start the game - initialize story state and generate first scene
  const startGame = useCallback(async (
    worldData: WorldData, 
    worldState: WorldState,
    startingLocation: { name: string; type: string; kingdomId: number; id?: string }
  ) => {
    if (!lore || !scenario || !selectedCharacter) {
      setError('Cannot start game without lore, scenario and selected character');
      return null;
    }
    
    setIsGeneratingScene(true);
    setError(null);
    setSceneNumber(1);
    setSceneHistory([]);
    setLastAppliedEffects([]);
    
    // Initialize story state from scenario
    const initialStoryState = createInitialStoryState(scenario);
    setStoryState(initialStoryState);
    setLastDirective(null);
    
    // Initialize travel state
    const startKingdom = worldData.kingdoms.find(k => k.id === startingLocation.kingdomId);
    const kingdomLocationIds = startKingdom ? getKingdomLocationIds(startKingdom) : [];
    const startingLocationId = startingLocation.id || startKingdom?.capital.id || '';
    
    const initialTravelState: TravelState = {
      currentLocationId: startingLocationId,
      currentKingdomId: startingLocation.kingdomId,
      unlockedLocations: kingdomLocationIds,
      visitedLocations: [startingLocationId],
      unlockedRoutes: kingdomLocationIds,
      traveling: undefined,
      travelQuest: undefined
    };
    setTravelState(initialTravelState);
    setQuests([]);
    
    // Build travel context for Showrunner
    const availableRoutes = getKingdomRoutes(startingLocationId, worldData).map(route => {
      const targetPOI = getPOIById(worldData, route.toId);
      return {
        locationId: route.toId,
        locationName: targetPOI?.name || 'Unknown',
        distance: route.distance,
        cost: route.cost,
        danger: route.danger
      };
    });
    
    const travelContext: TravelContext = {
      currentLocationId: startingLocationId,
      currentKingdomId: startingLocation.kingdomId,
      visitedLocations: [startingLocationId],
      unlockedLocations: kingdomLocationIds,
      availableRoutes
    };
    
    try {
      console.log('🎬 Showrunner: Generating first scene...');
      // First scene - no directive needed, use inciting incident
      const scene = await generateScene(
        worldData,
        worldState,
        lore,
        scenario,
        selectedCharacter,
        { ...startingLocation, id: startingLocationId },
        1,
        [],
        playerState,
        undefined, // No directive for first scene
        undefined, // No summary yet
        travelContext,
        [],        // No active quests yet
        'normal'
      );
      
      console.log('Scene generated:', scene);
      setCurrentScene(scene);
      setIsGameStarted(true);
      return scene;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate scene';
      console.error('Scene generation failed:', errorMsg);
      setError(errorMsg);
      return null;
    } finally {
      setIsGeneratingScene(false);
    }
  }, [lore, scenario, selectedCharacter, playerState]);

  // Continue game with choice - Director analyzes, then Showrunner generates
  const continueWithChoice = useCallback(async (
    worldData: WorldData, 
    worldState: WorldState,
    currentLocation: { name: string; type: string; kingdomId: number; id?: string },
    choice: SceneChoice
  ) => {
    if (!lore || !scenario || !selectedCharacter || !currentScene || !storyState || !travelState) {
      setError('Cannot continue game without active scene');
      return null;
    }
    
    // Apply effects from the choice
    let updatedPlayerState = playerState;
    let updatedTravelState = travelState;
    let effects: AppliedEffect[] = [];
    let newQuestsFromEffects: Quest[] = [];
    
    // Check if this choice has a require_travel effect
    const hasRequireTravelEffect = choice.effects?.some(
      e => e.type === 'travel' && e.travel?.action === 'require_travel'
    );
    
    if (choice.effects && choice.effects.length > 0) {
      // Apply player state effects
      const playerResult = applyEffects(playerState, choice.effects, sceneNumber);
      updatedPlayerState = playerResult.newState;
      effects = [...playerResult.appliedEffects];
      
      // Apply travel effects
      const travelResult = processTravelEffects(choice.effects, travelState, worldData);
      updatedTravelState = travelResult.newTravelState;
      effects = [...effects, ...travelResult.appliedEffects];
      newQuestsFromEffects = travelResult.newQuests;
      
      setPlayerState(updatedPlayerState);
      setTravelState(updatedTravelState);
      if (newQuestsFromEffects.length > 0) {
        setQuests(prev => [...prev, ...newQuestsFromEffects]);
      }
      setLastAppliedEffects(effects);
      console.log('📊 Effects applied:', effects);
    } else {
      setLastAppliedEffects([]);
    }
    
    // ========== REQUIRE_TRAVEL: Stop and wait for player to select destination on map ==========
    if (hasRequireTravelEffect) {
      console.log('🗺️ Travel quest created! Waiting for player to select destination on map...');
      // Clear current scene to show the map
      setCurrentScene(null);
      // Don't generate next scene - player must manually select destination
      return null;
    }
    
    // Handle travel choice - if this was a travel action
    let sceneType: 'normal' | 'travel' | 'arrival' | 'departure' = 'normal';
    if (choice.travelTo) {
      // Player chose to travel somewhere
      updatedTravelState = {
        ...updatedTravelState,
        traveling: {
          fromId: updatedTravelState.currentLocationId,
          toId: choice.travelTo.locationId,
          daysRemaining: choice.travelTo.distance,
          totalDays: choice.travelTo.distance,
          route: {
            fromId: updatedTravelState.currentLocationId,
            toId: choice.travelTo.locationId,
            distance: choice.travelTo.distance,
            cost: choice.travelTo.cost,
            danger: choice.travelTo.danger,
            terrain: [],
            isUnlocked: true
          },
          startedAt: sceneNumber
        }
      };
      setTravelState(updatedTravelState);
      sceneType = 'departure';
      
      // Deduct gold for travel
      updatedPlayerState = {
        ...updatedPlayerState,
        stats: {
          ...updatedPlayerState.stats,
          gold: Math.max(0, updatedPlayerState.stats.gold - choice.travelTo.cost)
        }
      };
      setPlayerState(updatedPlayerState);
    }
    
    setIsGeneratingScene(true);
    setError(null);
    
    const nextSceneNumber = sceneNumber + 1;
    
    try {
      // STEP 1: Director analyzes the situation and gives directive
      console.log('🎬 Director: Analyzing story progress...');
      const directorAnalysis = await generateDirective(
        scenario,
        storyState,
        currentScene,
        choice.text,
        updatedPlayerState,
        sceneNumber
      );
      
      console.log('📋 Director analysis:', directorAnalysis);
      
      // Update story state from Director
      setStoryState(directorAnalysis.updatedStoryState);
      setLastDirective(directorAnalysis.directive);
      
      // Check if story is complete
      if (directorAnalysis.updatedStoryState.isComplete) {
        console.log('🏁 Story is complete!');
        // Could show epilogue screen here
        setIsGeneratingScene(false);
        return null;
      }
      
      // Add current scene to history (using Director's summary)
      const newHistory = [
        ...sceneHistory,
        { 
          summary: directorAnalysis.updatedStoryState.lastSceneSummary, 
          lastChoice: choice.text 
        }
      ];
      
      // Build travel context for Showrunner
      const currentLocationId = updatedTravelState.currentLocationId || currentLocation.id || '';
      const availableRoutes = getKingdomRoutes(currentLocationId, worldData).map(route => {
        const targetPOI = getPOIById(worldData, route.toId);
        return {
          locationId: route.toId,
          locationName: targetPOI?.name || 'Unknown',
          distance: route.distance,
          cost: route.cost,
          danger: route.danger
        };
      });
      
      const travelContextForScene: TravelContext = {
        currentLocationId,
        currentKingdomId: updatedTravelState.currentKingdomId,
        visitedLocations: updatedTravelState.visitedLocations,
        unlockedLocations: updatedTravelState.unlockedLocations,
        availableRoutes,
        travelQuest: updatedTravelState.travelQuest ? {
          targetLocationId: updatedTravelState.travelQuest.targetLocationId,
          targetLocationName: getPOIById(worldData, updatedTravelState.travelQuest.targetLocationId)?.name || '',
          reason: updatedTravelState.travelQuest.reason,
          deadline: updatedTravelState.travelQuest.deadline
        } : undefined,
        inTransit: updatedTravelState.traveling ? {
          fromId: updatedTravelState.traveling.fromId,
          fromName: getPOIById(worldData, updatedTravelState.traveling.fromId)?.name || '',
          toId: updatedTravelState.traveling.toId,
          toName: getPOIById(worldData, updatedTravelState.traveling.toId)?.name || '',
          daysRemaining: updatedTravelState.traveling.daysRemaining,
          totalDays: updatedTravelState.traveling.totalDays
        } : undefined
      };
      
      // Build active quests info
      const allQuests = [...quests, ...newQuestsFromEffects];
      const activeQuestsInfo: ActiveQuestInfo[] = allQuests
        .filter(q => q.status === 'active')
        .map(q => ({
          id: q.id,
          title: q.title,
          currentObjective: q.objectives.find(o => !o.completed)?.description || 'Завершить квест',
          type: q.type
        }));
      
      // STEP 2: Showrunner generates scene using Director's directive
      console.log(`🎬 Showrunner: Generating scene #${nextSceneNumber} with directive...`);
      const scene = await generateScene(
        worldData,
        worldState,
        lore,
        scenario,
        selectedCharacter,
        { ...currentLocation, id: currentLocationId },
        nextSceneNumber,
        newHistory,
        updatedPlayerState,
        directorAnalysis.directive,         // Pass directive
        directorAnalysis.updatedStoryState.storySummary,  // Pass story summary
        travelContextForScene,              // Pass travel context
        activeQuestsInfo,                   // Pass active quests
        sceneType                           // Pass scene type
      );
      
      console.log('Scene generated:', scene);
      
      // ========== SYNC LOCATION WITH SCENE ==========
      // If the scene specifies a different location, update travelState
      // This handles cases where LLM generates travel/arrival scenes
      let finalTravelState = updatedTravelState;
      
      // Check if scene has a locationId that differs from current
      let sceneLocationId = scene.locationId;
      let sceneKingdomId = scene.kingdomId;
      
      // Fallback: try to find location by name if locationId not provided but we're in transit
      if (!sceneLocationId && updatedTravelState.traveling) {
        // If we were traveling, check if scene location matches destination
        const destinationPOI = getPOIById(worldData, updatedTravelState.traveling.toId);
        if (destinationPOI && scene.location?.toLowerCase().includes(destinationPOI.name.toLowerCase())) {
          console.log(`🔍 Detected arrival at ${destinationPOI.name} by name match`);
          sceneLocationId = destinationPOI.id;
          sceneKingdomId = destinationPOI.kingdomId;
        }
      }
      
      // Fallback: if we have a travel quest, check if scene mentions destination
      if (!sceneLocationId && updatedTravelState.travelQuest) {
        const questTargetPOI = getPOIById(worldData, updatedTravelState.travelQuest.targetLocationId);
        if (questTargetPOI && scene.location?.toLowerCase().includes(questTargetPOI.name.toLowerCase())) {
          console.log(`🔍 Detected arrival at quest target ${questTargetPOI.name} by name match`);
          sceneLocationId = questTargetPOI.id;
          sceneKingdomId = questTargetPOI.kingdomId;
        }
      }
      
      if (sceneLocationId && sceneLocationId !== finalTravelState.currentLocationId) {
        console.log(`🗺️ Location changed: ${finalTravelState.currentLocationId} → ${sceneLocationId}`);
        
        // Find the kingdom for this location
        const newKingdom = sceneKingdomId 
          ? worldData.kingdoms.find(k => k.id === sceneKingdomId)
          : worldData.kingdoms.find(k => 
              k.capital.id === sceneLocationId || 
              k.cities.some(c => c.id === sceneLocationId)
            );
        
        finalTravelState = {
          ...finalTravelState,
          currentLocationId: sceneLocationId,
          currentKingdomId: newKingdom?.id || finalTravelState.currentKingdomId,
          visitedLocations: finalTravelState.visitedLocations.includes(sceneLocationId)
            ? finalTravelState.visitedLocations
            : [...finalTravelState.visitedLocations, sceneLocationId],
          traveling: undefined // Clear traveling state on arrival
        };
        
        // Check if travel quest completed
        if (finalTravelState.travelQuest?.targetLocationId === sceneLocationId) {
          console.log('✅ Travel quest completed!');
          finalTravelState.travelQuest = undefined;
        }
        
        // Update quests on arrival
        const updatedQuests = updateQuestsOnArrival(allQuests, sceneLocationId);
        setQuests(updatedQuests);
      }
      // Also handle explicit travel departure  
      else if (updatedTravelState.traveling && sceneType === 'departure') {
        // For simplicity, arrive immediately after departure scene
        const arrivedLocationId = updatedTravelState.traveling.toId;
        const arrivedKingdom = worldData.kingdoms.find(k => 
          k.capital.id === arrivedLocationId || 
          k.cities.some(c => c.id === arrivedLocationId)
        );
        
        finalTravelState = {
          ...finalTravelState,
          currentLocationId: arrivedLocationId,
          currentKingdomId: arrivedKingdom?.id || finalTravelState.currentKingdomId,
          visitedLocations: finalTravelState.visitedLocations.includes(arrivedLocationId)
            ? finalTravelState.visitedLocations
            : [...finalTravelState.visitedLocations, arrivedLocationId],
          traveling: undefined
        };
        
        // Check if travel quest completed
        if (finalTravelState.travelQuest?.targetLocationId === arrivedLocationId) {
          finalTravelState.travelQuest = undefined;
        }
        
        // Update quests on arrival
        const updatedQuests = updateQuestsOnArrival(allQuests, arrivedLocationId);
        setQuests(updatedQuests);
      }
      
      // Always update travelState
      setTravelState(finalTravelState);
      
      setCurrentScene(scene);
      setSceneNumber(nextSceneNumber);
      setSceneHistory(newHistory);
      return scene;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate scene';
      console.error('Scene generation failed:', errorMsg);
      setError(errorMsg);
      return null;
    } finally {
      setIsGeneratingScene(false);
    }
  }, [lore, scenario, selectedCharacter, currentScene, sceneNumber, sceneHistory, playerState, storyState]);

  const clear = useCallback(() => {
    setLore(null);
    setScenario(null);
    setCharacters([]);
    setSelectedCharacter(null);
    setCharacterContext(null);
    setCurrentScene(null);
    setSceneHistory([]);
    setSceneNumber(0);
    setIsGameStarted(false);
    setPlayerState(createInitialPlayerState());
    setLastAppliedEffects([]);
    setStoryState(null);
    setLastDirective(null);
    setTravelState(null);
    setQuests([]);
    setError(null);
    clearDebugStore();
  }, []);

  return {
    lore,
    scenario,
    characters,
    selectedCharacter,
    characterContext,
    // Scene state
    currentScene,
    sceneNumber,
    sceneHistory,
    isGameStarted,
    // Player state
    playerState,
    lastAppliedEffects,
    // Story state (Director)
    storyState,
    lastDirective,
    // Travel & Quest state
    travelState,
    quests,
    // Loading states
    isGenerating,
    isGeneratingCharacters,
    isGeneratingScenario,
    isGeneratingScene,
    error,
    // Actions
    generate,
    generateCharacters,
    selectCharacter,
    generateWorldScenario,
    startGame,
    continueWithChoice,
    clear,
    // Debug
    debugStore,
    clearDebugLogs: clearDebugStore
  };
};
