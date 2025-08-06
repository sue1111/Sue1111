import { io, Socket } from 'socket.io-client'
import { createLogger } from './utils/logger'

const logger = createLogger('SocketClient')

export interface GameMove {
  userId: string
  position: number
  symbol: 'X' | 'O'
  timestamp: string
}

export interface PlayerJoined {
  userId: string
  username: string
  symbol: 'X' | 'O'
  players: Record<string, any>
  status: string
}

export interface GameError {
  message: string
}

class GameSocketClient {
  private socket: Socket | null = null
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private usePolling = false // Fallback режим

  constructor() {
    this.initializeSocket()
  }

  private initializeSocket() {
    // Проверяем, поддерживается ли WebSocket
    if (typeof window !== 'undefined' && !window.WebSocket) {
      this.usePolling = true
      logger.warn('WebSocket not supported, using polling fallback')
    }

    // Для Vercel используем текущий домен
    const serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 
                     (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
    
    this.socket = io(serverUrl, {
      transports: this.usePolling ? ['polling'] : ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      timeout: 20000,
      forceNew: true,
      withCredentials: true,
      path: '/socket.io/'
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    if (!this.socket) return

    this.socket.on('connect', () => {
      this.isConnected = true
      this.reconnectAttempts = 0
      logger.info('Connected to WebSocket server')
    })

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false
      logger.warn(`Disconnected from WebSocket server: ${reason}`)
    })

    this.socket.on('connect_error', (error) => {
      this.isConnected = false
      this.reconnectAttempts++
      logger.error(`Connection error: ${error.message}`)
    })

    this.socket.on('reconnect', (attemptNumber) => {
      this.isConnected = true
      this.reconnectAttempts = 0
      logger.info(`Reconnected after ${attemptNumber} attempts`)
    })

    this.socket.on('reconnect_failed', () => {
      logger.error('Failed to reconnect to WebSocket server')
    })
  }

  // Подключение к серверу
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'))
        return
      }

      if (this.isConnected) {
        resolve()
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, 5000)

      this.socket.once('connect', () => {
        clearTimeout(timeout)
        resolve()
      })

      this.socket.once('connect_error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })

      this.socket.connect()
    })
  }

  // Отключение от сервера
  public disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.isConnected = false
      logger.info('Disconnected from WebSocket server')
    }
  }

  // Присоединиться к игре
  public joinGame(gameId: string, userId: string, username: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('Socket not connected'))
        return
      }

      this.socket.emit('game:join', { gameId, userId, username })

      // Ждем подтверждения или ошибки
      const timeout = setTimeout(() => {
        reject(new Error('Join game timeout'))
      }, 10000)

      this.socket.once('game:player_joined', () => {
        clearTimeout(timeout)
        resolve()
      })

      this.socket.once('game:error', (error: GameError) => {
        clearTimeout(timeout)
        reject(new Error(error.message))
      })
    })
  }

  // Сделать ход
  public makeMove(gameId: string, userId: string, position: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('Socket not connected'))
        return
      }

      this.socket.emit('game:move', { gameId, userId, position })
      resolve() // Ход отправлен, не ждем подтверждения
    })
  }

  // Подписка на события игры
  public onGameEvent(event: string, callback: (data: any) => void) {
    if (!this.socket) return

    this.socket.on(event, callback)
  }

  // Отписка от событий игры
  public offGameEvent(event: string, callback?: (data: any) => void) {
    if (!this.socket) return

    if (callback) {
      this.socket.off(event, callback)
    } else {
      this.socket.off(event)
    }
  }

  // Проверка соединения
  public ping(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket || !this.isConnected) {
        resolve(false)
        return
      }

      const timeout = setTimeout(() => {
        resolve(false)
      }, 3000)

      this.socket.emit('ping')
      this.socket.once('pong', () => {
        clearTimeout(timeout)
        resolve(true)
      })
    })
  }

  // Получить статус соединения
  public getConnectionStatus(): boolean {
    return this.isConnected
  }

  // Получить количество попыток переподключения
  public getReconnectAttempts(): number {
    return this.reconnectAttempts
  }
}

// Создаем единственный экземпляр клиента
let socketClient: GameSocketClient | null = null

export function getSocketClient(): GameSocketClient {
  if (!socketClient) {
    socketClient = new GameSocketClient()
  }
  return socketClient
}

export function disconnectSocketClient() {
  if (socketClient) {
    socketClient.disconnect()
    socketClient = null
  }
} 