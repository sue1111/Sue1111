const { Server: SocketIOServer } = require('socket.io')

class GameSocketServer {
  constructor(server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ["https://your-app.vercel.app", "https://*.vercel.app"] 
          : ["http://localhost:3000", "http://127.0.0.1:3000", "https://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
      path: '/socket.io/'
    })

    this.gameRooms = new Map()
    this.setupEventHandlers()
    console.log('WebSocket server initialized')
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`)

      // Присоединиться к игре
      socket.on('game:join', async (data) => {
        await this.handleJoinGame(socket, data)
      })

      // Сделать ход
      socket.on('game:move', async (data) => {
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

  async handleJoinGame(socket, data) {
    const { gameId, userId, username } = data
    
    try {
      // Присоединяемся к комнате
      socket.join(gameId)
      
      // Создаем или обновляем комнату
      let room = this.gameRooms.get(gameId)
      if (!room) {
        room = {
          gameId,
          players: {},
          status: 'waiting',
          createdAt: new Date()
        }
        this.gameRooms.set(gameId, room)
      }

      // Добавляем игрока в комнату
      room.players[userId] = {
        socketId: socket.id,
        username,
        symbol: Object.keys(room.players).length === 0 ? 'X' : 'O'
      }

      // Обновляем статус игры если нужно
      if (Object.keys(room.players).length >= 2) {
        room.status = 'playing'
      }

      // Уведомляем всех в комнате
      this.io.to(gameId).emit('game:player_joined', {
        userId,
        username,
        symbol: room.players[userId].symbol,
        players: room.players,
        status: room.status
      })

      console.log(`Player ${username} (${userId}) joined game ${gameId} as ${room.players[userId].symbol}`)

    } catch (error) {
      console.error(`Error joining game: ${error}`)
      socket.emit('game:error', { message: 'Failed to join game' })
    }
  }

  async handleMove(socket, data) {
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

      console.log(`Move made by ${player.username} at position ${position}`)

    } catch (error) {
      console.error(`Error handling move: ${error}`)
      socket.emit('game:error', { message: 'Failed to make move' })
    }
  }

  handleDisconnect(socket) {
    console.log(`Client disconnected: ${socket.id}`)
    
    // Находим игру, в которой был игрок
    for (const [gameId, room] of this.gameRooms.entries()) {
      const player = Object.values(room.players).find(p => p.socketId === socket.id)
      if (player) {
        // Удаляем игрока из комнаты
        delete room.players[userId]
        
        // Уведомляем остальных игроков
        this.io.to(gameId).emit('game:player_disconnected', {
          userId: player.symbol === 'X' ? 'player_x' : 'player_o',
          username: player.username
        })

        console.log(`Player ${player.username} disconnected from game ${gameId}`)
        break
      }
    }
  }

  // Методы для внешнего использования
  emitToGame(gameId, event, data) {
    this.io.to(gameId).emit(event, data)
  }

  getGameRoom(gameId) {
    return this.gameRooms.get(gameId)
  }

  removeGameRoom(gameId) {
    this.gameRooms.delete(gameId)
  }
}

let socketServer = null

function initializeSocketServer(server) {
  if (!socketServer) {
    socketServer = new GameSocketServer(server)
  }
  return socketServer
}

function getSocketServer() {
  return socketServer
}

module.exports = { initializeSocketServer, getSocketServer } 