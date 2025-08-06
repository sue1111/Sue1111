"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { socketManager } from "@/lib/socket"
import { MultiplayerFallback } from "@/lib/multiplayer-fallback"
import type { GameState, UserData, Player } from "@/lib/types"

interface PendingInvite {
  gameId: string
  from: Player
  betAmount: number
}

interface UseMultiplayerReturn {
  activeGame: GameState | null
  lobbyGames: GameState[]
  onlinePlayers: Player[]
  pendingInvite: PendingInvite | null
  isConnected: boolean
  createGame: (betAmount: number) => void
  joinGame: (gameId: string) => void
  makeMove: (index: number) => void
  invitePlayer: (userId: string, betAmount: number) => void
  acceptInvite: (gameId: string) => void
  declineInvite: (gameId: string) => void
  endGame: () => void
}

// Флаг для отключения функциональности сокета
const DISABLE_SOCKET = true;

export function useMultiplayer(userData: UserData | null): UseMultiplayerReturn {
  const [activeGame, setActiveGame] = useState<GameState | null>(null)
  const [lobbyGames, setLobbyGames] = useState<GameState[]>([])
  const [onlinePlayers, setOnlinePlayers] = useState<Player[]>([])
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null)
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [useFallback, setUseFallback] = useState<boolean>(false)
  const fallbackRef = useRef<MultiplayerFallback | null>(null)

  // Используем useRef для хранения ID пользователя, чтобы избежать проблем с замыканиями
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (userData?.id) {
      userIdRef.current = userData.id
    }
  }, [userData])

  // Проверяем доступность WebSocket
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isWebSocketAvailable = MultiplayerFallback.isWebSocketAvailable()
      setUseFallback(!isWebSocketAvailable)
      console.log(`WebSocket available: ${isWebSocketAvailable}, using fallback: ${!isWebSocketAvailable}`)
    }
  }, [])

  // Инициализация сокета при монтировании компонента
  useEffect(() => {
    console.log("🔧 useMultiplayer effect triggered:", { DISABLE_SOCKET, userData: !!userData, useFallback })
    
    // Если сокеты отключены или используем fallback, не пытаемся подключиться к WebSocket
    if (DISABLE_SOCKET || !userData || useFallback) {
      console.log("🔧 Skipping WebSocket connection, using fallback")
      // Инициализируем fallback если WebSocket недоступен
      if (useFallback && userData) {
        fallbackRef.current = new MultiplayerFallback()
        setIsConnected(true)
        console.log("✅ Using multiplayer fallback system")
      } else if (DISABLE_SOCKET && userData) {
        // Если сокеты отключены, но есть пользователь, используем fallback
        fallbackRef.current = new MultiplayerFallback()
        setIsConnected(true)
        console.log("✅ Using multiplayer fallback system (sockets disabled)")
      }
      return;
    }
    
    try {
      // Подключаемся к сокету
      const socket = socketManager.getSocket()

      // Устанавливаем обработчики событий
      socket.on("connect", () => {
        console.log("✅ Socket connected in useMultiplayer")
        console.log("🔌 Socket ID:", socket.id)
        setIsConnected(true)

        // Отправляем данные пользователя при подключении
        socket.emit("user:connect", {
          userId: userData.id,
          username: userData.username,
          avatar: userData.avatar,
        })
      })

      socket.on("disconnect", () => {
        console.log("Socket disconnected")
        setIsConnected(false)
      })

      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error)
        setIsConnected(false)
        // При ошибке WebSocket переключаемся на fallback
        if (!fallbackRef.current) {
          fallbackRef.current = new MultiplayerFallback()
          setUseFallback(true)
          setIsConnected(true)
          console.log("🔄 Switched to fallback due to WebSocket error")
        }
      })

      // Обработчики игровых событий
      socket.on("game:update", (game: GameState) => {
        if (game.players.X.id === userData.id || game.players.O?.id === userData.id) {
          setActiveGame(game)
        }
      })

      socket.on("game:lobby", (games: GameState[]) => {
        setLobbyGames(games)
      })

      socket.on("players:online", (players: Player[]) => {
        // Фильтруем текущего пользователя из списка онлайн-игроков
        setOnlinePlayers(players.filter((player) => player.id !== userData.id))
      })

      socket.on("game:invite", (invite: PendingInvite) => {
        setPendingInvite(invite)
      })

      // Подключаемся к сокету только если он не отключен
      if (!socket.connected && !DISABLE_SOCKET) {
        socket.connect()
      }

      // Отключаемся при размонтировании компонента
      return () => {
        socket.off("connect")
        socket.off("disconnect")
        socket.off("connect_error")
        socket.off("game:update")
        socket.off("game:lobby")
        socket.off("players:online")
        socket.off("game:invite")

        // Отправляем событие отключения пользователя
        if (socket.connected && userData.id) {
          socket.emit("user:disconnect", { userId: userData.id })
        }
      }
    } catch (error) {
      console.error("Error setting up socket:", error)
      // При ошибке инициализации WebSocket переключаемся на fallback
      if (!fallbackRef.current) {
        fallbackRef.current = new MultiplayerFallback()
        setUseFallback(true)
        setIsConnected(true)
        console.log("🔄 Switched to fallback due to initialization error")
      }
      return () => {}; // Пустая функция очистки
    }
  }, [userData, useFallback])

  // Настройка fallback обработчиков
  useEffect(() => {
    if (useFallback && fallbackRef.current) {
      fallbackRef.current.onGameStateUpdate((gameState) => {
        // Преобразуем GameState из fallback в полный GameState
        const fullGameState: GameState = {
          id: gameState.id,
          board: gameState.board,
          currentPlayer: gameState.currentPlayer,
          status: gameState.status,
          players: {
            X: gameState.players.X ? { ...gameState.players.X, avatar: null } : { id: '', username: '', avatar: null },
            O: gameState.players.O ? { ...gameState.players.O, avatar: null } : null
          },
          betAmount: 0, // Будет получено из API
          pot: 0, // Будет получено из API
          createdAt: new Date().toISOString(),
          winner: gameState.winner || null
        }
        setActiveGame(fullGameState)
      })
    }
  }, [useFallback])

  // Функция для создания новой игры
  const createGame = useCallback(
    (betAmount: number) => {
      if (!userData) return

      console.log("🎮 createGame called:", { betAmount, useFallback, DISABLE_SOCKET })

      if (useFallback) {
        // В fallback режиме создаем игру через API
        console.log("Creating game via API fallback")
        fetch('/api/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userData.id, betAmount })
        }).then(response => response.json())
        .then(data => {
          if (data.success) {
            console.log("Game created via API fallback")
          }
        }).catch(error => {
          console.error("Error creating game via API:", error)
        })
      } else if (!DISABLE_SOCKET) {
        try {
          const socket = socketManager.getSocket()
          socket.emit("game:create", {
            userId: userData.id,
            betAmount,
          })
        } catch (error) {
          console.error("Error creating game:", error)
        }
      } else {
        console.log("🎮 No fallback or socket available, cannot create game")
      }
    },
    [userData, useFallback],
  )

  // Функция для присоединения к игре
  const joinGame = useCallback(
    (gameId: string) => {
      if (!userData) return

      if (useFallback && fallbackRef.current) {
        fallbackRef.current.joinGame(gameId, userData.id, userData.username)
      } else if (!DISABLE_SOCKET) {
        try {
          const socket = socketManager.getSocket()
          socket.emit("game:join", {
            userId: userData.id,
            gameId,
          })
        } catch (error) {
          console.error("Error joining game:", error)
        }
      }
    },
    [userData, useFallback],
  )

  // Функция для выполнения хода
  const makeMove = useCallback(
    (index: number) => {
      if (!userData || !activeGame) return

      if (useFallback && fallbackRef.current) {
        fallbackRef.current.makeMove(activeGame.id, userData.id, index)
      } else if (!DISABLE_SOCKET) {
        try {
          const socket = socketManager.getSocket()
          socket.emit("game:move", {
            userId: userData.id,
            gameId: activeGame.id,
            index,
          })
        } catch (error) {
          console.error("Error making move:", error)
        }
      }
    },
    [userData, activeGame, useFallback],
  )

  // Функция для приглашения игрока
  const invitePlayer = useCallback(
    (userId: string, betAmount: number) => {
      if (!userData) return

      if (!DISABLE_SOCKET) {
        try {
          const socket = socketManager.getSocket()
          socket.emit("game:invite", {
            fromUserId: userData.id,
            toUserId: userId,
            betAmount,
          })
        } catch (error) {
          console.error("Error inviting player:", error)
        }
      }
    },
    [userData],
  )

  // Функция для принятия приглашения
  const acceptInvite = useCallback(
    (gameId: string) => {
      if (!userData) return

      if (!DISABLE_SOCKET) {
        try {
          const socket = socketManager.getSocket()
          socket.emit("game:accept-invite", {
            userId: userData.id,
            gameId,
          })

          // Сбрасываем приглашение
          setPendingInvite(null)
        } catch (error) {
          console.error("Error accepting invite:", error)
        }
      }
    },
    [userData],
  )

  // Функция для отклонения приглашения
  const declineInvite = useCallback(
    (gameId: string) => {
      if (!userData) return

      if (!DISABLE_SOCKET) {
        try {
          const socket = socketManager.getSocket()
          socket.emit("game:decline-invite", {
            userId: userData.id,
            gameId,
          })

          // Сбрасываем приглашение
          setPendingInvite(null)
        } catch (error) {
          console.error("Error declining invite:", error)
        }
      }
    },
    [userData],
  )

  // Функция для завершения игры
  const endGame = useCallback(() => {
    if (!userData || !activeGame) return

    if (useFallback && fallbackRef.current) {
      fallbackRef.current.disconnect()
    } else if (!DISABLE_SOCKET) {
      try {
        const socket = socketManager.getSocket()
        socket.emit("game:end", {
          userId: userData.id,
          gameId: activeGame.id,
        })
      } catch (error) {
        console.error("Error ending game:", error)
      }
    }

    // Сбрасываем активную игру
    setActiveGame(null)
  }, [userData, activeGame, useFallback])

  return {
    activeGame,
    lobbyGames,
    onlinePlayers,
    pendingInvite,
    isConnected,
    createGame,
    joinGame,
    makeMove,
    invitePlayer,
    acceptInvite,
    declineInvite,
    endGame,
  }
}
