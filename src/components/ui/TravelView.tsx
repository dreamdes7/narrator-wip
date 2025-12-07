import React, { useState } from 'react';
import type { TravelRoute, TravelState, Quest } from '../../types/travel';
import type { POI } from '../../types/world';
import { getDangerDescription, getDaysDescription, getTravelDescription } from '../../utils/travelSystem';

interface TravelViewProps {
  currentLocation: POI;
  availableRoutes: (TravelRoute & { targetName: string })[];
  travelState: TravelState;
  playerGold: number;
  activeQuest?: Quest;
  onTravel: (route: TravelRoute) => void;
  onClose: () => void;
  isLoading?: boolean;
}

const TravelView: React.FC<TravelViewProps> = ({
  currentLocation,
  availableRoutes,
  travelState,
  playerGold,
  activeQuest,
  onTravel,
  onClose,
  isLoading = false
}) => {
  const [selectedRoute, setSelectedRoute] = useState<TravelRoute | null>(null);
  const [confirmMode, setConfirmMode] = useState(false);

  // Filter routes - separate unlocked and locked
  const unlockedRoutes = availableRoutes.filter(r => r.isUnlocked);
  const lockedRoutes = availableRoutes.filter(r => !r.isUnlocked);

  const canAfford = (route: TravelRoute) => playerGold >= route.cost;
  
  const isQuestTarget = (route: TravelRoute) => 
    travelState.travelQuest?.targetLocationId === route.toId;

  const getDangerColor = (danger: TravelRoute['danger']) => {
    switch (danger) {
      case 'safe': return '#4ecdc4';
      case 'risky': return '#f39c12';
      case 'dangerous': return '#e74c3c';
    }
  };

  const getDangerIcon = (danger: TravelRoute['danger']) => {
    switch (danger) {
      case 'safe': return '🛡️';
      case 'risky': return '⚠️';
      case 'dangerous': return '☠️';
    }
  };

  const handleSelectRoute = (route: TravelRoute & { targetName: string }) => {
    if (!route.isUnlocked || !canAfford(route)) return;
    setSelectedRoute(route);
    setConfirmMode(true);
  };

  const handleConfirmTravel = () => {
    if (selectedRoute) {
      onTravel(selectedRoute);
    }
  };

  const handleCancelConfirm = () => {
    setSelectedRoute(null);
    setConfirmMode(false);
  };

  return (
    <>
      {/* Overlay */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 99
        }} 
        onClick={onClose}
      />

      {/* Modal */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        maxWidth: '550px',
        maxHeight: '80vh',
        backgroundColor: '#0f0f14',
        borderRadius: '12px',
        border: '1px solid #2a2a35',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #2a2a35',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0a0a0e'
        }}>
          <div>
            <div style={{ color: '#4ecdc4', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
              🗺️ Путешествие
            </div>
            <div style={{ color: '#e8e8e8', fontSize: '16px', fontWeight: 500 }}>
              Отправиться из {currentLocation.name}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ color: '#f1c40f', fontSize: '14px' }}>
              💰 {playerGold}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '0 4px'
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Active Quest Banner */}
        {travelState.travelQuest && (
          <div style={{
            padding: '10px 20px',
            backgroundColor: 'rgba(241, 196, 15, 0.1)',
            borderBottom: '1px solid rgba(241, 196, 15, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '16px' }}>⭐</span>
            <div>
              <div style={{ color: '#f1c40f', fontSize: '12px', fontWeight: 500 }}>
                Квест: {travelState.travelQuest.reason}
              </div>
              <div style={{ color: '#888', fontSize: '11px' }}>
                Цель: доберитесь до локации
                {travelState.travelQuest.deadline && ` до сцены ${travelState.travelQuest.deadline}`}
              </div>
            </div>
          </div>
        )}

        {/* Confirm dialog */}
        {confirmMode && selectedRoute && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#16161c',
              borderRadius: '12px',
              border: `1px solid ${getDangerColor(selectedRoute.danger)}`,
              padding: '24px',
              maxWidth: '350px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>
                {getDangerIcon(selectedRoute.danger)}
              </div>
              <h3 style={{ color: '#e8e8e8', fontSize: '18px', margin: '0 0 8px 0' }}>
                Отправиться в {(selectedRoute as any).targetName}?
              </h3>
              <p style={{ color: '#888', fontSize: '13px', margin: '0 0 16px 0' }}>
                {getDaysDescription(selectedRoute.distance)} • {selectedRoute.cost} золота
                <br />
                <span style={{ color: getDangerColor(selectedRoute.danger) }}>
                  {getDangerDescription(selectedRoute.danger)}
                </span>
              </p>
              
              {isQuestTarget(selectedRoute) && (
                <div style={{
                  backgroundColor: 'rgba(241, 196, 15, 0.15)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  color: '#f1c40f',
                  fontSize: '12px'
                }}>
                  ⭐ Это цель вашего квеста!
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  onClick={handleCancelConfirm}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2a2a35',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={handleConfirmTravel}
                  disabled={isLoading}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: getDangerColor(selectedRoute.danger),
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    cursor: isLoading ? 'wait' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    opacity: isLoading ? 0.6 : 1
                  }}
                >
                  {isLoading ? '⏳ Путешествие...' : '🚶 Отправиться'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Routes List */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 20px'
        }}>
          {/* Unlocked Routes */}
          {unlockedRoutes.length > 0 && (
            <>
              <div style={{ 
                color: '#888', 
                fontSize: '11px', 
                textTransform: 'uppercase', 
                letterSpacing: '1px', 
                marginBottom: '10px' 
              }}>
                Доступные маршруты
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {unlockedRoutes.map(route => {
                  const affordable = canAfford(route);
                  const isQuest = isQuestTarget(route);
                  
                  return (
                    <button
                      key={route.toId}
                      onClick={() => handleSelectRoute(route)}
                      disabled={!affordable}
                      style={{
                        padding: '14px 16px',
                        backgroundColor: isQuest ? 'rgba(241, 196, 15, 0.1)' : '#16161c',
                        border: `1px solid ${isQuest ? '#f1c40f' : affordable ? '#2a2a35' : '#1a1a1f'}`,
                        borderRadius: '8px',
                        cursor: affordable ? 'pointer' : 'not-allowed',
                        textAlign: 'left',
                        opacity: affordable ? 1 : 0.5,
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ 
                            color: isQuest ? '#f1c40f' : '#e0e0e0', 
                            fontSize: '14px', 
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            {isQuest && <span>⭐</span>}
                            {route.targetName}
                          </div>
                          <div style={{ 
                            color: '#666', 
                            fontSize: '12px', 
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span>{getDaysDescription(route.distance)}</span>
                            <span>•</span>
                            <span style={{ color: getDangerColor(route.danger) }}>
                              {getDangerIcon(route.danger)} {getDangerDescription(route.danger)}
                            </span>
                          </div>
                        </div>
                        <div style={{ 
                          color: affordable ? '#f1c40f' : '#e74c3c', 
                          fontSize: '13px',
                          fontWeight: 500
                        }}>
                          💰 {route.cost}
                        </div>
                      </div>
                      {!affordable && (
                        <div style={{ 
                          color: '#e74c3c', 
                          fontSize: '11px', 
                          marginTop: '6px' 
                        }}>
                          Недостаточно золота
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Locked Routes */}
          {lockedRoutes.length > 0 && (
            <>
              <div style={{ 
                color: '#555', 
                fontSize: '11px', 
                textTransform: 'uppercase', 
                letterSpacing: '1px', 
                marginBottom: '10px' 
              }}>
                🔒 Заблокированные маршруты
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {lockedRoutes.map(route => (
                  <div
                    key={route.toId}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: '#0d0d10',
                      border: '1px solid #1a1a1f',
                      borderRadius: '8px',
                      opacity: 0.6
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: '#555', fontSize: '13px' }}>
                        🔒 {route.targetName}
                      </div>
                      <div style={{ color: '#444', fontSize: '11px' }}>
                        Требуется квест
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {unlockedRoutes.length === 0 && lockedRoutes.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              color: '#555', 
              padding: '40px 20px' 
            }}>
              Нет доступных маршрутов из этой локации
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #2a2a35',
          backgroundColor: '#0a0a0e',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ color: '#555', fontSize: '11px' }}>
            Путешествие занимает время и золото
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2a2a35',
              border: 'none',
              borderRadius: '6px',
              color: '#888',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Остаться здесь
          </button>
        </div>
      </div>
    </>
  );
};

export default TravelView;

