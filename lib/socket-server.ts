import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { createLogger } from './utils/logger'

const logger = createLogger('SocketServer')

interface GameRoom {
  gameId: string
  players: {
    [userId: string]: {
      socketId: string
      username: string
      symbol: 'X' | 'O'
    }
  }
  status: 'waiting' | 'playing' | 'completed'
  createdAt: Date
}

class GameSocketServer {
  private io: SocketIOServer
  private gameRooms: Map<string, GameRoom> = new Map()

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    })

    this.setupEventHandlers()
    logger.info('WebSocket server initialized')
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`)

      // Присоединиться к игре
      socket.on('game:join', async (data: { gameId: string, userId: string, username: string }) => {
        await this.handleJoinGame(socket, data)
      })

      // Сделать ход
      socket.on('game:move', async (data: { gameId: string, userId: string, position: number }) => {
        await this.handleMove(socket, data)
      })

      // Отключение игрока
      socket.on('disconnect', () => {
        this.handleDisconnect(socket)
      })

      // Пинг для проверки соединения
      socket.on('ping', () => {
        socket.emit('pong')
      })
    })
  }

  private async handleJoinGame(socket: any, data: { gameId: string, userId: string, username: string }) {
    const { gameId, userId, username } = data
    
    try {
      // Получаем информацию об игре из БД
      const { getSupabaseServerClient } = await import('./supabase/supabase-server')
      const directSupabase = getSupabaseServerClient()
      
      const { data: game, error } = await directSupabase
        .from('games')
        .select('*')
        .eq('id', gameId as any)
        .single()

      if (error || !game) {
        socket.emit('game:error', { message: 'Game not found' })
        return
      }

      // Проверяем, может ли игрок присоединиться
      if ((game as any).status !== 'waiting' && (game as any).status !== 'playing') {
        socket.emit('game:error', { message: 'Game is not available' })
        return
      }

      // Определяем символ игрока
      let symbol: 'X' | 'O' = 'O'
      if (!(game as any).player_x || (game as any).player_x === userId) {
        symbol = 'X'
      } else if (!(game as any).player_o || (game as any).player_o === userId) {
        symbol = 'O'
      } else {
        socket.emit('game:error', { message: 'Game is full' })
        return
      }

      // Присоединяемся к комнате
      socket.join(gameId)
      
      // Создаем или обновляем комнату
      let room = this.gameRooms.get(gameId)
      if (!room) {
        room = {
          gameId,
          players: {},
          status: game.status as 'waiting' | 'playing' | 'completed',
          createdAt: new Date()
        }
        this.gameRooms.set(gameId, room)
      }

      // Добавляем игрока в комнату
      room.players[userId] = {
        socketId: socket.id,
        username,
        symbol
      }

      // Обновляем статус игры если нужно
      if (room.players[userId] && Object.keys(room.players).length >= 2) {
        room.status = 'playing'
        
        // Обновляем статус в БД
        await directSupabase
          .from('games')
          .update({ 
            status: 'playing',
            player_o: symbol === 'O' ? userId : (game as any).player_o,
            player_x: symbol === 'X' ? userId : (game as any).player_x
          })
          .eq('id', gameId as any)
      }

      // Уведомляем всех в комнате
      this.io.to(gameId).emit('game:player_joined', {
        userId,
        username,
        symbol,
        players: room.players,
        status: room.status
      })

      logger.info(`Player ${username} (${userId}) joined game ${gameId} as ${symbol}`)

    } catch (error) {
      logger.error(`Error joining game: ${error}`)
      socket.emit('game:error', { message: 'Failed to join game' })
    }
  }

  private async handleMove(socket: any, data: { gameId: string, userId: string, position: number }) {
    const { gameId, userId, position } = data
    
    try {
      const room = this.gameRooms.get(gameId)
      if (!room) {
        socket.emit('game:error', { message: 'Game room not found' })
        return
      }

      const player = room.players[userId]
      if (!player) {
        socket.emit('game:error', { message: 'Player not in game' })
        return
      }

      // Отправляем ход всем игрокам в комнате
      this.io.to(gameId).emit('game:move_made', {
        userId,
        position,
        symbol: player.symbol,
        timestamp: new Date().toISOString()
      })

      logger.info(`Move made by ${player.username} at position ${position}`)

    } catch (error) {
      logger.error(`Error handling move: ${error}`)
      socket.emit('game:error', { message: 'Failed to make move' })
    }
  }

  private handleDisconnect(socket: any) {
    logger.info(`Client disconnected: ${socket.id}`)
    
    // Находим игру, в которой был игрок
    for (const [gameId, room] of this.gameRooms.entries()) {
      const player = Object.values(room.players).find(p => p.socketId === socket.id)
      if (player) {
        // Удаляем игрока из комнаты
        delete room.players[player.symbol === 'X' ? 'player_x' : 'player_o']
        
        // Уведомляем остальных игроков
        this.io.to(gameId).emit('game:player_disconnected', {
          userId: player.symbol === 'X' ? 'player_x' : 'player_o',
          username: player.username
        })

        logger.info(`Player ${player.username} disconnected from game ${gameId}`)
        break
      }
    }
  }

  // Методы для внешнего использования
  public emitToGame(gameId: string, event: string, data: any) {
    this.io.to(gameId).emit(event, data)
  }

  public getGameRoom(gameId: string): GameRoom | undefined {
    return this.gameRooms.get(gameId)
  }

  public removeGameRoom(gameId: string) {
    this.gameRooms.delete(gameId)
  }
}

let socketServer: GameSocketServer | null = null

export function initializeSocketServer(server: HTTPServer) {
  if (!socketServer) {
    socketServer = new GameSocketServer(server)
  }
  return socketServer
}

export function getSocketServer(): GameSocketServer | null {
  return socketServer
} 