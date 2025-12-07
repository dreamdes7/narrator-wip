// ============ GAME STATE HOOK ============
// Управление полным состоянием игры: путешествия, квесты, эффекты

import { useState, useCallback, useMemo } from 'react';
import type { WorldData, POI, Kingdom } from '../types/world';
import type { 
  TravelState, 
  TravelRoute, 
  Quest, 
  GameState,
  createInitialTravelState,
  createInitialGameState 
} from '../types/travel';
import type { SceneEffect, PlayerState, AppliedEffect } from '../types/agents';
import {
  getRoutesFromLocation,
  getKingdomRoutes,
  getPOIById,
  getKingdomByLocationId,
  getKingdomLocationIds,
  createPathLines,
  startTravel,
  completeTravel,
  unlockLocation,
  setTravelQuest,
  clearTravelQuest,
  createTravelQuest,
  updateQuestsOnArrival,
  type PathLine
} from '../utils/travelSystem';

interface UseGameStateOptions {
  worldData: WorldData | null;
  startingLocationId: string;
  startingKingdomId: number;
}

export const useGameState = (options: UseGameStateOptions) => {
  const { worldData, startingLocationId, startingKingdomId } = options;

  // Calculate kingdom locations
  const kingdomLocationIds = useMemo(() => {
    if (!worldData) return [];
    const kingdom = worldData.kingdoms.find(k => k.id === startingKingdomId);
    if (!kingdom) return [];
    return getKingdomLocationIds(kingdom);
  }, [worldData, startingKingdomId]);

  // Game State
  const [gameState, setGameState] = useState<GameState>(() => ({
    travel: {
      currentLocationId: startingLocationId,
      currentKingdomId: startingKingdomId,
      unlockedLocations: kingdomLocationIds,
      visitedLocations: [startingLocationId],
      unlockedRoutes: kingdomLocationIds,
      traveling: undefined,
      travelQuest: undefined
    },
    quests: [],
    activeQuestId: undefined,
    worldEvents: []
  }));

  // Reinitialize when starting location changes
  const reinitialize = useCallback((newStartingLocationId: string, newStartingKingdomId: number) => {
    if (!worldData) return;
    
    const kingdom = worldData.kingdoms.find(k => k.id === newStartingKingdomId);
    if (!kingdom) return;
    
    const locationIds = getKingdomLocationIds(kingdom);
    
    setGameState({
      travel: {
        currentLocationId: newStartingLocationId,
        currentKingdomId: newStartingKingdomId,
        unlockedLocations: locationIds,
        visitedLocations: [newStartingLocationId],
        unlockedRoutes: locationIds,
        traveling: undefined,
        travelQuest: undefined
      },
      quests: [],
      activeQuestId: undefined,
      worldEvents: []
    });
  }, [worldData]);

  // ============ TRAVEL ACTIONS ============

  // Get available routes from current location
  const getAvailableRoutes = useCallback((): (TravelRoute & { targetName: string })[] => {
    if (!worldData) return [];
    
    const routes = getKingdomRoutes(gameState.travel.currentLocationId, worldData);
    
    // Also add cross-kingdom routes if unlocked
    const allRoutes = getRoutesFromLocation(
      gameState.travel.currentLocationId,
      worldData,
      gameState.travel
    );
    
    // Merge and add target names
    return allRoutes.map(route => {
      const targetPOI = getPOIById(worldData, route.toId);
      return {
        ...route,
        targetName: targetPOI?.name || 'Unknown'
      };
    });
  }, [worldData, gameState.travel]);

  // Get path lines for map visualization
  const getTravelPaths = useCallback((showOnlyKingdom: boolean = true): PathLine[] => {
    if (!worldData) return [];
    return createPathLines(
      gameState.travel.currentLocationId,
      worldData,
      gameState.travel,
      showOnlyKingdom
    );
  }, [worldData, gameState.travel]);

  // Start traveling to a location
  const travelTo = useCallback((route: TravelRoute) => {
    setGameState(prev => ({
      ...prev,
      travel: startTravel(prev.travel, route, 0) // TODO: pass current scene number
    }));
  }, []);

  // Arrive at destination
  const arriveAtDestination = useCallback(() => {
    setGameState(prev => {
      const newTravel = completeTravel(prev.travel);
      const newQuests = updateQuestsOnArrival(prev.quests, newTravel.currentLocationId);
      
      // Clear travel quest if completed
      let finalTravel = newTravel;
      if (prev.travel.travelQuest?.targetLocationId === newTravel.currentLocationId) {
        finalTravel = clearTravelQuest(newTravel);
      }
      
      return {
        ...prev,
        travel: finalTravel,
        quests: newQuests
      };
    });
  }, []);

  // Unlock a new location
  const unlockNewLocation = useCallback((locationId: string) => {
    setGameState(prev => ({
      ...prev,
      travel: unlockLocation(prev.travel, locationId)
    }));
  }, []);

  // Set travel quest from scenario
  const setTravelQuestFromScenario = useCallback((
    targetLocationId: string,
    reason: string,
    deadline?: number
  ) => {
    if (!worldData) return;
    
    const targetPOI = getPOIById(worldData, targetLocationId);
    if (!targetPOI) return;
    
    const questId = `travel_${targetLocationId}_${Date.now()}`;
    const quest = createTravelQuest(
      targetLocationId,
      targetPOI.name,
      reason,
      1, // TODO: get current act
      0, // TODO: get current scene
      deadline
    );
    
    setGameState(prev => ({
      ...prev,
      travel: setTravelQuest(prev.travel, targetLocationId, reason, questId, deadline),
      quests: [...prev.quests, quest],
      activeQuestId: questId
    }));
    
    // Auto-unlock the location if it's not unlocked
    if (!gameState.travel.unlockedLocations.includes(targetLocationId)) {
      unlockNewLocation(targetLocationId);
    }
  }, [worldData, gameState.travel.unlockedLocations, unlockNewLocation]);

  // ============ QUEST ACTIONS ============

  const addQuest = useCallback((quest: Quest) => {
    setGameState(prev => ({
      ...prev,
      quests: [...prev.quests, quest],
      activeQuestId: prev.activeQuestId || quest.id
    }));
  }, []);

  const completeQuest = useCallback((questId: string) => {
    setGameState(prev => ({
      ...prev,
      quests: prev.quests.map(q => 
        q.id === questId ? { ...q, status: 'completed' } : q
      ),
      activeQuestId: prev.activeQuestId === questId 
        ? prev.quests.find(q => q.id !== questId && q.status === 'active')?.id 
        : prev.activeQuestId
    }));
  }, []);

  const failQuest = useCallback((questId: string) => {
    setGameState(prev => ({
      ...prev,
      quests: prev.quests.map(q => 
        q.id === questId ? { ...q, status: 'failed' } : q
      )
    }));
  }, []);

  // ============ EFFECT PROCESSING ============

  // Process travel and quest effects from scene choices
  const processEffects = useCallback((
    effects: SceneEffect[],
    sceneNumber: number
  ): AppliedEffect[] => {
    const appliedEffects: AppliedEffect[] = [];
    
    for (const effect of effects) {
      if (effect.type === 'travel' && effect.travel) {
        switch (effect.travel.action) {
          case 'move':
            // Immediate move (rare, usually for teleport/fast travel)
            if (effect.travel.targetLocationId) {
              setGameState(prev => ({
                ...prev,
                travel: {
                  ...prev.travel,
                  currentLocationId: effect.travel!.targetLocationId,
                  visitedLocations: prev.travel.visitedLocations.includes(effect.travel!.targetLocationId)
                    ? prev.travel.visitedLocations
                    : [...prev.travel.visitedLocations, effect.travel!.targetLocationId]
                }
              }));
              appliedEffects.push({
                description: `Перемещение в ${effect.travel.targetLocationName || effect.travel.targetLocationId}`,
                type: 'neutral',
                icon: '🚶'
              });
            }
            break;
            
          case 'unlock_route':
            if (effect.travel.targetLocationId) {
              unlockNewLocation(effect.travel.targetLocationId);
              appliedEffects.push({
                description: `Разблокирован маршрут в ${effect.travel.targetLocationName || 'новую локацию'}`,
                type: 'positive',
                icon: '🗺️'
              });
            }
            break;
            
          case 'require_travel':
            if (effect.travel.targetLocationId && effect.travel.reason) {
              setTravelQuestFromScenario(
                effect.travel.targetLocationId,
                effect.travel.reason,
                effect.travel.deadline
              );
              appliedEffects.push({
                description: `Новый квест: ${effect.travel.reason}`,
                type: 'neutral',
                icon: '⭐'
              });
            }
            break;
        }
      }
      
      if (effect.type === 'quest' && effect.quest) {
        switch (effect.quest.action) {
          case 'add':
            if (effect.quest.questId && effect.quest.title) {
              const newQuest: Quest = {
                id: effect.quest.questId,
                title: effect.quest.title,
                description: effect.quest.description || '',
                type: effect.quest.type || 'main',
                status: 'active',
                objectives: effect.quest.objectives?.map(o => ({
                  ...o,
                  completed: false
                })) || [],
                fromScene: sceneNumber,
                rewards: effect.quest.rewards,
                isFromScenario: true
              };
              addQuest(newQuest);
              appliedEffects.push({
                description: `Новый квест: ${effect.quest.title}`,
                type: 'neutral',
                icon: '📜'
              });
            }
            break;
            
          case 'complete':
            if (effect.quest.questId) {
              completeQuest(effect.quest.questId);
              appliedEffects.push({
                description: `Квест выполнен!`,
                type: 'positive',
                icon: '✅'
              });
            }
            break;
            
          case 'fail':
            if (effect.quest.questId) {
              failQuest(effect.quest.questId);
              appliedEffects.push({
                description: `Квест провален`,
                type: 'negative',
                icon: '❌'
              });
            }
            break;
        }
      }
    }
    
    return appliedEffects;
  }, [unlockNewLocation, setTravelQuestFromScenario, addQuest, completeQuest, failQuest]);

  // ============ GETTERS ============

  const getCurrentLocation = useCallback((): POI | null => {
    if (!worldData) return null;
    return getPOIById(worldData, gameState.travel.currentLocationId) || null;
  }, [worldData, gameState.travel.currentLocationId]);

  const getCurrentKingdom = useCallback((): Kingdom | null => {
    if (!worldData) return null;
    return worldData.kingdoms.find(k => k.id === gameState.travel.currentKingdomId) || null;
  }, [worldData, gameState.travel.currentKingdomId]);

  const getTravelQuestTarget = useCallback((): POI | null => {
    if (!worldData || !gameState.travel.travelQuest) return null;
    return getPOIById(worldData, gameState.travel.travelQuest.targetLocationId) || null;
  }, [worldData, gameState.travel.travelQuest]);

  const getActiveQuests = useCallback((): Quest[] => {
    return gameState.quests.filter(q => q.status === 'active');
  }, [gameState.quests]);

  const getActiveQuestInfo = useCallback(() => {
    return getActiveQuests().map(q => ({
      id: q.id,
      title: q.title,
      currentObjective: q.objectives.find(o => !o.completed)?.description || 'Завершить квест',
      type: q.type
    }));
  }, [getActiveQuests]);

  return {
    // State
    gameState,
    travelState: gameState.travel,
    quests: gameState.quests,
    
    // Current location info
    getCurrentLocation,
    getCurrentKingdom,
    getTravelQuestTarget,
    
    // Travel
    getAvailableRoutes,
    getTravelPaths,
    travelTo,
    arriveAtDestination,
    unlockNewLocation,
    setTravelQuestFromScenario,
    
    // Quests
    addQuest,
    completeQuest,
    failQuest,
    getActiveQuests,
    getActiveQuestInfo,
    
    // Effects
    processEffects,
    
    // Utility
    reinitialize
  };
};

