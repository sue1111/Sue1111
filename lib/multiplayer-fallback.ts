import { createLogger } from './utils/logger'

const logger = createLogger('MultiplayerFallback')

export interface GameState {
  id: string
  board: (string | null)[]
  currentPlayer: 'X' | 'O'
  status: 'waiting' | 'playing' | 'completed' | 'draw'
  players: {
    X?: { id: string; username: string }
    O?: { id: string; username: string }
  }
  winner?: string
}

class MultiplayerFallback {
  private pollingInterval: NodeJS.Timeout | null = null
  private currentGameId: string | null = null
  private onGameUpdate: ((gameState: GameState) => void) | null = null

  constructor() {
    logger.info('Multiplayer fallback initialized')
  }

  // Подключиться к игре через API
  async joinGame(gameId: string, userId: string, username: string): Promise<void> {
    try {
      this.currentGameId = gameId
      
      const response = await fetch(`/api/games/${gameId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to join game')
      }

      const gameData = await response.json()
      logger.info(`Joined game ${gameId} via API`)

      // Начинаем polling для обновлений
      this.startPolling(gameId)

    } catch (error) {
      logger.error(`Error joining game: ${error}`)
      throw error
    }
  }

  // Сделать ход через API
  async makeMove(gameId: string, userId: string, position: number): Promise<void> {
    try {
      const response = await fetch(`/api/games/${gameId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          position,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to make move')
      }

      logger.info(`Move made at position ${position}`)

    } catch (error) {
      logger.error(`Error making move: ${error}`)
      throw error
    }
  }

  // Начать polling для обновлений игры
  private startPolling(gameId: string) {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
    }

    this.pollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/games/${gameId}`)
        if (response.ok) {
          const gameState = await response.json()
          if (this.onGameUpdate) {
            this.onGameUpdate(gameState)
          }
        }
      } catch (error) {
        logger.error(`Polling error: ${error}`)
      }
    }, 2000) // Poll каждые 2 секунды
  }

  // Остановить polling
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  // Подписка на обновления игры
  onGameStateUpdate(callback: (gameState: GameState) => void) {
    this.onGameUpdate = callback
  }

  // Отписка от обновлений
  offGameStateUpdate() {
    this.onGameUpdate = null
  }

  // Проверка доступности WebSocket
  static isWebSocketAvailable(): boolean {
    if (typeof window === 'undefined') return false
    
    // Проверяем, поддерживается ли WebSocket
    if (!window.WebSocket) return false
    
    // Временно отключаем проверку Vercel для тестирования
    // const isVercel = window.location.hostname.includes('vercel.app')
    // return !isVercel
    
    return true
  }

  // Получить статус соединения
  getConnectionStatus(): boolean {
    return this.pollingInterval !== null
  }

  // Отключиться от игры
  disconnect() {
    this.stopPolling()
    this.currentGameId = null
    this.onGameUpdate = null
    logger.info('Disconnected from multiplayer fallback')
  }
}

export { MultiplayerFallback } 