import { useState, useCallback, useEffect } from 'react';
import type { WorldData } from '../types/world';
import type { WorldState, KingdomState, LocationState, Season, ActiveConflict, ConflictStatus } from '../types/simulation';

// Начальные значения для генерации
const INITIAL_YEAR = 452;

// Хелпер для генерации начального состояния на основе сгенерированного мира
const generateInitialState = (world: WorldData): WorldState => {
  const kingdomStates: Record<number, KingdomState> = {};
  const locationStates: Record<string, LocationState> = {};

  world.kingdoms.forEach(k => {
    kingdomStates[k.id] = {
      id: k.id,
      ruler: {
        name: `King of ${k.name}`,
        personality: 'Balanced'
      },
      resources: {
        gold: 1000,
        mana: 500,
        food: 1000
      },
      military: {
        strength: Math.floor(Math.random() * 500) + 500,
        readiness: 100
      },
      diplomacy: {
        enemies: [],
        allies: []
      }
    };

    // Инициализируем города этого королевства
    const allPoints = [k.capital, ...k.cities];
    allPoints.forEach(poi => {
      locationStates[poi.id] = {
        id: poi.id,
        kingdomId: k.id,
        condition: 'INTACT',
        population: poi.type === 'capital' ? 5000 : 1000,
        defense: poi.type === 'capital' ? 1000 : 300,
        modifiers: []
      };
    });
  });

  return {
    date: {
      year: INITIAL_YEAR,
      season: 'SPRING',
      day: 1
    },
    kingdoms: kingdomStates,
    locations: locationStates,
    activeConflicts: [],
    globalFlags: []
  };
};

// Calculate battle outcome based on strengths
const calculateBattleStatus = (attackerStr: number, defenderStr: number): ConflictStatus => {
  const ratio = attackerStr / (defenderStr || 1);
  const randomFactor = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
  const effectiveRatio = ratio * randomFactor;

  if (effectiveRatio > 1.3) return 'ATTACKER_WINNING';
  if (effectiveRatio < 0.7) return 'DEFENDER_WINNING';
  return 'STALEMATE';
};

export const useWorldSimulation = (initialWorld: WorldData | null) => {
  const [state, setState] = useState<WorldState | null>(null);

  // Инициализация при загрузке мира
  useEffect(() => {
    if (initialWorld && !state) {
      setState(generateInitialState(initialWorld));
    }
  }, [initialWorld]);

  // --- ACTIONS ---

  const advanceSeason = useCallback(() => {
    setState(prev => {
      if (!prev) return null;
      
      const seasons: Season[] = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];
      const currentIdx = seasons.indexOf(prev.date.season);
      let nextIdx = currentIdx + 1;
      let nextYear = prev.date.year;

      if (nextIdx >= seasons.length) {
        nextIdx = 0;
        nextYear++;
      }

      return {
        ...prev,
        date: {
          ...prev.date,
          season: seasons[nextIdx],
          year: nextYear
        }
      };
    });
  }, []);

  const updateLocationState = useCallback((locationId: string, updates: Partial<LocationState>) => {
    setState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        locations: {
          ...prev.locations,
          [locationId]: {
            ...prev.locations[locationId],
            ...updates
          }
        }
      };
    });
  }, []);

  const updateKingdomState = useCallback((kingdomId: number, updates: Partial<KingdomState>) => {
    setState(prev => {
      if (!prev || !prev.kingdoms[kingdomId]) return prev;
      
      const existing = prev.kingdoms[kingdomId];
      
      // Deep merge nested objects
      return {
        ...prev,
        kingdoms: {
          ...prev.kingdoms,
          [kingdomId]: {
            ...existing,
            ...updates,
            ruler: updates.ruler ? { ...existing.ruler, ...updates.ruler } : existing.ruler,
            resources: updates.resources ? { ...existing.resources, ...updates.resources } : existing.resources,
            military: updates.military ? { ...existing.military, ...updates.military } : existing.military,
            diplomacy: updates.diplomacy ? { ...existing.diplomacy, ...updates.diplomacy } : existing.diplomacy
          }
        }
      };
    });
  }, []);

  // --- CONFLICT MANAGEMENT ---

  // Start a new conflict (cells become contested, not immediately captured)
  const startConflict = useCallback((attackerId: number, defenderId: number, contestedCellIds: number[]): ActiveConflict | null => {
    let newConflict: ActiveConflict | null = null;
    
    setState(prev => {
      if (!prev) return null;

      const attackerState = prev.kingdoms[attackerId];
      const defenderState = prev.kingdoms[defenderId];

      if (!attackerState || !defenderState) return prev;

      // Check if conflict already exists between these kingdoms
      const existingConflict = prev.activeConflicts.find(
        c => (c.attackerId === attackerId && c.defenderId === defenderId) ||
             (c.attackerId === defenderId && c.defenderId === attackerId)
      );

      if (existingConflict) {
        // Add cells to existing conflict
        const updatedConflicts = prev.activeConflicts.map(c => {
          if (c.id === existingConflict.id) {
            return {
              ...c,
              contestedCellIds: [...new Set([...c.contestedCellIds, ...contestedCellIds])]
            };
          }
          return c;
        });
        return { ...prev, activeConflicts: updatedConflicts };
      }

      // Create new conflict
      newConflict = {
        id: `conflict-${attackerId}-${defenderId}-${Date.now()}`,
        attackerId,
        defenderId,
        contestedCellIds,
        startTimestamp: Date.now(),
        status: 'PENDING',
        attackerStrength: attackerState.military.strength,
        defenderStrength: defenderState.military.strength,
        rounds: 0
      };

      return {
        ...prev,
        activeConflicts: [...prev.activeConflicts, newConflict]
      };
    });

    return newConflict;
  }, []);

  // Resolve a battle round (can be called by LLM or UI)
  const resolveBattleRound = useCallback((conflictId: string): { 
    status: ConflictStatus; 
    attackerLosses: number; 
    defenderLosses: number 
  } | null => {
    let result: { status: ConflictStatus; attackerLosses: number; defenderLosses: number } | null = null;

    setState(prev => {
      if (!prev) return null;

      const conflictIndex = prev.activeConflicts.findIndex(c => c.id === conflictId);
      if (conflictIndex === -1) return prev;

      const conflict = prev.activeConflicts[conflictIndex];
      const attackerState = prev.kingdoms[conflict.attackerId];
      const defenderState = prev.kingdoms[conflict.defenderId];

      // Calculate this round's outcome
      const newStatus = calculateBattleStatus(attackerState.military.strength, defenderState.military.strength);

      // Calculate losses
      let attackerLosses = 0;
      let defenderLosses = 0;

      if (newStatus === 'ATTACKER_WINNING') {
        attackerLosses = Math.floor(Math.random() * 20) + 10;
        defenderLosses = Math.floor(Math.random() * 40) + 30;
      } else if (newStatus === 'DEFENDER_WINNING') {
        attackerLosses = Math.floor(Math.random() * 40) + 30;
        defenderLosses = Math.floor(Math.random() * 20) + 10;
      } else {
        attackerLosses = Math.floor(Math.random() * 25) + 15;
        defenderLosses = Math.floor(Math.random() * 25) + 15;
      }

      result = { status: newStatus, attackerLosses, defenderLosses };

      // Update conflict
      const updatedConflicts = [...prev.activeConflicts];
      updatedConflicts[conflictIndex] = {
        ...conflict,
        status: newStatus,
        rounds: conflict.rounds + 1,
        attackerStrength: Math.max(0, conflict.attackerStrength - attackerLosses),
        defenderStrength: Math.max(0, conflict.defenderStrength - defenderLosses)
      };

      // Update kingdom military strength
      const updatedKingdoms = {
        ...prev.kingdoms,
        [conflict.attackerId]: {
          ...attackerState,
          military: {
            ...attackerState.military,
            strength: Math.max(0, attackerState.military.strength - attackerLosses)
          }
        },
        [conflict.defenderId]: {
          ...defenderState,
          military: {
            ...defenderState.military,
            strength: Math.max(0, defenderState.military.strength - defenderLosses)
          }
        }
      };

      return {
        ...prev,
        activeConflicts: updatedConflicts,
        kingdoms: updatedKingdoms
      };
    });

    return result;
  }, []);

  // Force resolve conflict with specific outcome (for LLM/testing)
  const forceResolveConflict = useCallback((conflictId: string, outcome: 'ATTACKER_VICTORY' | 'DEFENDER_VICTORY' | 'RETREAT') => {
    setState(prev => {
      if (!prev) return null;

      const conflictIndex = prev.activeConflicts.findIndex(c => c.id === conflictId);
      if (conflictIndex === -1) return prev;

      const conflict = prev.activeConflicts[conflictIndex];
      
      // Update conflict with pending resolution
      const updatedConflicts = [...prev.activeConflicts];
      updatedConflicts[conflictIndex] = {
        ...conflict,
        status: 'RESOLVED',
        pendingResolution: outcome
      };

      return {
        ...prev,
        activeConflicts: updatedConflicts
      };
    });
  }, []);

  // Remove resolved conflict
  const clearConflict = useCallback((conflictId: string) => {
    setState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        activeConflicts: prev.activeConflicts.filter(c => c.id !== conflictId)
      };
    });
  }, []);

  // Get active conflict between two kingdoms
  const getConflict = useCallback((kingdom1Id: number, kingdom2Id: number): ActiveConflict | undefined => {
    if (!state) return undefined;
    return state.activeConflicts.find(
      c => (c.attackerId === kingdom1Id && c.defenderId === kingdom2Id) ||
           (c.attackerId === kingdom2Id && c.defenderId === kingdom1Id)
    );
  }, [state]);

  const tick = useCallback(() => {
    setState(prev => {
      if (!prev) return null;
      
      const updatedKingdoms = { ...prev.kingdoms };
      Object.keys(updatedKingdoms).forEach(key => {
        const kId = Number(key);
        const k = updatedKingdoms[kId];
        updatedKingdoms[kId] = {
            ...k,
            resources: {
                ...k.resources,
                gold: k.resources.gold + 1
            }
        };
      });

      return {
        ...prev,
        kingdoms: updatedKingdoms
      };
    });
  }, []);

  return {
    state,
    actions: {
      advanceSeason,
      updateLocationState,
      updateKingdomState,
      tick,
      // Conflict actions
      startConflict,
      resolveBattleRound,
      forceResolveConflict,
      clearConflict,
      getConflict
    }
  };
};
