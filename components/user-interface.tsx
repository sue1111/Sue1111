"use client"

import { useState, useCallback, memo, useEffect } from "react"
import { Trophy, Clock, User, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import GameBoard from "@/components/game-board"
import HomeScreen from "@/components/home-screen"
import ProfileScreen from "@/components/profile-screen"
import LobbyScreen from "@/components/lobby-screen"
import LeaderboardScreen from "@/components/leaderboard-screen"
import WaitingScreen from "@/components/waiting-screen"
import GamePauseModal from "@/components/game-pause-modal"
import { useMultiplayer } from "@/hooks/use-multiplayer"
import type { GameState, UserData } from "@/lib/types"
import { getSupabaseClient } from "@/lib/supabase"
import { useToast } from "@/components/ui/use-toast"

interface UserInterfaceProps {
  userData: UserData | null
  setUserData: (userData: UserData) => void
  onAdminRequest: () => void
  onLogout: () => void
  onMainSiteRequest: () => void
}

// Функция для обновления баланса и статистики пользователя
async function updateUserBalance(userId: string, newBalance: number, gamesPlayed?: number, gamesWon?: number, totalWinnings?: number) {
  console.log(`Updating user data: userId=${userId}, newBalance=${newBalance}, gamesPlayed=${gamesPlayed}, gamesWon=${gamesWon}, totalWinnings=${totalWinnings}`);
  
  try {
    const response = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        balance: newBalance,
        gamesPlayed,
        gamesWon,
        totalWinnings,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to update user data");
    }

    console.log(`Successfully updated user data for ${userId}`);
  } catch (error) {
    console.error("Error updating user data:", error);
  }
}

// Функция для получения актуальных данных пользователя из БД
async function refreshUserData(userId: string, setUserData: (user: UserData) => void) {
  try {
    const response = await fetch(`/api/users/${userId}`);
    if (response.ok) {
      const freshUser = await response.json();
      setUserData(freshUser);
      console.log(`Refreshed user data for ${userId}`);
    }
  } catch (error) {
    console.error("Error refreshing user data:", error);
  }
}

const UserInterface = memo(({ userData, setUserData, onAdminRequest, onLogout, onMainSiteRequest }: UserInterfaceProps) => {
  const [currentScreen, setCurrentScreen] = useState<"home" | "game" | "profile" | "lobby" | "leaderboard" | "waiting">("home")
  const [gameMode, setGameMode] = useState<"ai" | "multiplayer">("ai")
  const [waitingGameId, setWaitingGameId] = useState<string>("")
  const [waitingBetAmount, setWaitingBetAmount] = useState<number>(0)
  const [gameState, setGameState] = useState<GameState>(() => ({
    id: '',
    board: Array(9).fill(null),
    currentPlayer: 'X',
    players: { X: { id: '', username: '', avatar: null }, O: null },
    status: 'playing', // Игры против AI сразу начинаются
    betAmount: 0,
    pot: 0,
    winner: null,
    createdAt: ''
  }))
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAITinking, setIsAIThinking] = useState<boolean>(false);
  const [lastMoveTime, setLastMoveTime] = useState<number>(0);
  const [isGamePaused, setIsGamePaused] = useState<boolean>(false);
  const [pauseData, setPauseData] = useState<any>(null);
  const [systemSettings, setSystemSettings] = useState({
    minBet: 1,
    maxBet: 100,
    botWinPercentage: 50 // Добавляем вероятность победы бота
  })
  const { toast } = useToast();

  // Загружаем системные настройки
  useEffect(() => {
    const loadSystemSettings = async () => {
      try {
        const response = await fetch("/api/settings?type=system")
        if (response.ok) {
          const settings = await response.json()
          setSystemSettings({
            minBet: settings.minBet || 1,
            maxBet: settings.maxBet || 100,
            botWinPercentage: settings.botWinPercentage || 50 // Загружаем вероятность победы бота
          })
        }
      } catch (error) {
        console.error("Ошибка загрузки системных настроек:", error)
      }
    }

    loadSystemSettings()
  }, [])

  // Используем хук для многопользовательской игры
  const {
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
    endGame: endMultiplayerGame,
  } = useMultiplayer(userData)

  // Добавляем функцию для обработки данных игры
  const handleGameData = useCallback((game: any, betAmount: number) => {
    try {
      if (!userData) return;
      
      // Преобразуем доску из JSON в массив, если она в формате строки
      let parsedBoard = game.board;
      console.log("Тип данных game.board:", typeof game.board, game.board);
      
      if (typeof game.board === 'string') {
        try {
          parsedBoard = JSON.parse(game.board);
          console.log("Доска после JSON.parse:", parsedBoard);
        } catch (e) {
          console.error("Ошибка при разборе доски:", e);
          parsedBoard = Array(9).fill(null);
        }
      }
      
      // Если доска все еще не является массивом, создаем пустую доску
      if (!Array.isArray(parsedBoard)) {
        console.error("Доска не является массивом после обработки:", parsedBoard);
        parsedBoard = Array(9).fill(null);
      }
      
      console.log("Итоговая доска для использования:", parsedBoard);

      // Устанавливаем состояние игры
      let players = game.players;
      let status = game.status || "waiting";
      
      // Добавляем AI игрока, если его нет
      if (!game.player_o || !game.players?.O) {
        players = {
          ...game.players,
          O: { id: "ai", username: "ИИ Оппонент", avatar: null }
        };
      }
      
      // Используем статус с сервера, но добавляем дополнительную проверку
      if (game.status === "completed" || game.winner) {
        status = "completed";
      } else if (game.status === "draw") {
        status = "draw";
      } else if (game.status === "playing") {
        status = "playing";
      } else {
        status = "waiting";
      }
      
      console.log(`Setting game status: ${status}, winner: ${game.winner}`);
      console.log(`Game data from server: status=${game.status}, winner=${game.winner}`);
      console.log(`Current player from server: currentPlayer=${game.currentPlayer}, current_player=${game.current_player}`);
      
      const newGameState = {
        id: game.id,
        board: parsedBoard,
        currentPlayer: game.currentPlayer || game.current_player || "X",
        players,
        status,
        betAmount: game.bet_amount || betAmount,
        pot: game.pot || betAmount,
        winner: game.winner || null,
        createdAt: game.created_at || new Date().toISOString(),
      };
      
      console.log(`New game state:`, newGameState);
      
      try {
        setGameState(newGameState);
      } catch (error) {
        console.error("Error setting game state:", error)
      }
      
      // Переходим на экран игры
      setCurrentScreen("game");
      setIsLoading(false);
    } catch (error) {
      console.error("Error in handleGameData:", error)
      // В случае ошибки все равно переходим на экран игры
      setCurrentScreen("game");
      setIsLoading(false);
    }
  }, [userData]);

  // Создание мультиплеер игры с ожиданием
  const handleCreateMultiplayerGame = useCallback(
    async (betAmount: number) => {
      if (!userData) return

      console.log("🎮 handleCreateMultiplayerGame called:", { betAmount, isConnected })

      // Пропускаем проверку подключения для fallback режима
      // if (!isConnected) {
      //   alert("Не удалось подключиться к серверу. Мультиплеер временно недоступен. Вы можете играть против бота.")
      //   return
      // }

      try {
        // Создаем игру через API
        const response = await fetch('/api/games/lobby', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userData.id,
            betAmount: betAmount
          })
        })

        if (response.ok) {
          const result = await response.json()
          console.log('✅ Created multiplayer game:', result)
          console.log('🎮 Game ID:', result.game.id)
          console.log('🎮 Game status:', result.game.status)
          console.log('💰 Bet amount:', betAmount)
          
          // Проверяем, что игра создана со статусом 'waiting'
          if (result.game.status !== 'waiting') {
            console.error('❌ Game created with wrong status:', result.game.status)
            toast({
              title: "Error",
              description: "Game created with wrong status",
              variant: "destructive"
            })
            return
          }
          
          // Показываем загрузку при переходе на экран ожидания
          setIsLoading(true)
          console.log('⏳ Setting loading to true')
          
          // Переходим на экран ожидания
          setWaitingGameId(result.game.id)
          setWaitingBetAmount(betAmount)
          setCurrentScreen("waiting")
          console.log('🔄 Переход на экран ожидания...')
          console.log('📱 Current screen set to: waiting')
          console.log('🎮 Waiting game ID set to:', result.game.id)
          console.log('💰 Waiting bet amount set to:', betAmount)
          
          // Скрываем загрузку после короткой задержки
          setTimeout(() => {
            setIsLoading(false)
            console.log('✅ Loading hidden, waiting screen should be visible')
          }, 300)
        } else {
          const errorData = await response.text()
          console.error('❌ Error response:', errorData)
          
          let errorMessage = "Failed to create game"
          try {
            const error = JSON.parse(errorData)
            errorMessage = error.error || errorMessage
          } catch (e) {
            console.error('❌ Error parsing error response:', e)
          }
          
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive"
          })
        }
      } catch (error) {
        console.error('Error creating multiplayer game:', error)
        toast({
          title: "Error",
          description: "Failed to create game",
          variant: "destructive"
        })
      }
    },
    [userData, isConnected, toast],
  )

  // Аналогично для других функций мультиплеера:
  const handleJoinGame = useCallback(
    async (gameId: string) => {
      if (!userData) return

      console.log("🔧 handleJoinGame called with gameId:", gameId)
      console.log("🔧 isConnected:", isConnected)

      // Пропускаем проверку подключения для fallback режима
      // if (!isConnected) {
      //   alert("Не удалось подключиться к серверу. Мультиплеер временно недоступен.")
      //   return
      // }

      // Сначала пытаемся присоединиться к игре через API
      try {
        console.log("🔧 Joining game via API...")
        const joinResponse = await fetch(`/api/games/${gameId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userData.id,
            username: userData.username
          })
        })

        if (joinResponse.ok) {
          console.log("🔧 Successfully joined game via API")
          
          // Теперь загружаем данные игры
          console.log("🔧 Loading game data via API...")
          const response = await fetch(`/api/games/${gameId}`)
          if (response.ok) {
            const gameData = await response.json()
            console.log("🔧 Game data loaded:", gameData)
            
            // Парсим board если это строка
            let board = gameData.board
            if (typeof board === 'string') {
              try {
                board = JSON.parse(board)
              } catch (error) {
                console.error("🔧 Error parsing board:", error)
                board = Array(9).fill(null)
              }
            }

            // Обновляем состояние игры
            setGameState({
              id: gameData.id,
              board: board,
              currentPlayer: gameData.current_player || 'X',
              players: gameData.players || { X: null, O: null },
              status: gameData.status,
              betAmount: gameData.bet_amount,
              pot: gameData.pot || gameData.bet_amount * 2,
              winner: gameData.winner,
              createdAt: gameData.created_at,
            })
            
            console.log("🔧 Setting current screen to game")
            // Переходим к игре
            setCurrentScreen("game")
            return
          } else {
            console.error("🔧 Failed to load game data:", response.status)
          }
        } else {
          console.error("🔧 Failed to join game:", joinResponse.status)
        }
      } catch (error) {
        console.error("🔧 Error joining game via API:", error)
      }

      // Если API не сработал и WebSocket доступен, используем его
      if (isConnected) {
        console.log("🔧 Using WebSocket fallback")
        joinGame(gameId)
      } else {
        console.error("🔧 Neither API nor WebSocket worked")
        alert("Не удалось подключиться к серверу. Мультиплеер временно недоступен.")
      }
    },
    [userData, joinGame, isConnected],
  )

  const handleInvitePlayer = useCallback(
    (userId: string, betAmount: number) => {
      if (!userData) return

      if (!isConnected) {
        alert("Не удалось подключиться к серверу. Мультиплеер временно недоступен.")
        return
      }

      invitePlayer(userId, betAmount)
    },
    [userData, invitePlayer, isConnected],
  )

  // Обновляем локальное состояние игры при изменении активной игры
  useEffect(() => {
    if (activeGame) {
      setGameState({
        id: activeGame.id,
        board: activeGame.board,
        currentPlayer: activeGame.currentPlayer,
        players: activeGame.players,
        status: activeGame.status,
        betAmount: activeGame.betAmount,
        pot: activeGame.pot,
        winner: activeGame.winner,
        createdAt: activeGame.createdAt,
      })
      setCurrentScreen("game")
    }
  }, [activeGame])

  // Polling для обновления состояния игры
  useEffect(() => {
    console.log("🔧 Polling effect triggered:", { 
      currentScreen, 
      gameStateId: gameState.id 
    })
    
    // Запускаем polling если мы в игре, есть gameState.id и игра не завершена
    if (currentScreen === "game" && gameState.id && gameState.status !== "completed" && gameState.status !== "draw") {
      console.log("🔧 Starting polling for game:", gameState.id)
      
      // Добавляем задержку перед первым polling, чтобы избежать конфликтов с ходами
      const initialDelay = setTimeout(() => {
        const interval = setInterval(async () => {
          try {
            console.log("🔧 Polling game state...")
            const response = await fetch(`/api/games/${gameState.id}`)
            if (response.ok) {
              const gameData = await response.json()
              console.log("🔧 Polled game data:", gameData)
              console.log("🔧 Polled currentPlayer:", gameData.currentPlayer)
              console.log("🔧 Polled current_player:", gameData.current_player)
              
              // Парсим board если это строка
              let board = gameData.board
              if (typeof board === 'string') {
                try {
                  board = JSON.parse(board)
                } catch (error) {
                  console.error("🔧 Error parsing board in polling:", error)
                  board = Array(9).fill(null)
                }
              }
              
              // Сравниваем только важные поля для обновления
              const currentBoardString = JSON.stringify(gameState.board)
              const newBoardString = JSON.stringify(board)
              
                          // Проверяем, не был ли сделан ход в последние 2 секунды
            const timeSinceLastMove = Date.now() - lastMoveTime
            const shouldUpdate = timeSinceLastMove > 2000
            
            // Проверяем, не приостановлена ли игра
            if (gameData.status === 'paused' && !isGamePaused) {
              console.log("🔧 Game paused, showing pause modal")
              setIsGamePaused(true)
              setPauseData({
                gameId: gameData.id,
                inactivePlayers: gameData.inactive_players || []
              })
            } else if (gameData.status === 'playing' && isGamePaused) {
              console.log("🔧 Game resumed, hiding pause modal")
              setIsGamePaused(false)
              setPauseData(null)
            }

            if ((newBoardString !== currentBoardString ||
                gameData.status !== gameState.status ||
                gameData.currentPlayer !== gameState.currentPlayer) && shouldUpdate) {
              
              console.log("🔧 Game state changed, updating...")
              
              // Добавляем небольшую задержку для предотвращения мерцания
              setTimeout(() => {
                setGameState(prevState => ({
                  ...prevState,
                  id: gameData.id,
                  board: board,
                  currentPlayer: gameData.currentPlayer || gameData.current_player || 'X',
                  players: gameData.players || { X: null, O: null },
                  status: gameData.status,
                  betAmount: gameData.bet_amount,
                  pot: gameData.pot || gameData.bet_amount * 2,
                  winner: gameData.winner,
                  createdAt: gameData.created_at,
                }))
              }, 100)
            } else {
              console.log("🔧 No changes in game state or recent move detected")
            }
            } else {
              console.error("🔧 Polling failed:", response.status)
            }
          } catch (error) {
            console.error("🔧 Error polling game state:", error)
          }
        }, 3000) // Обновляем каждые 3 секунды для более стабильного отображения

        return () => {
          console.log("🔧 Stopping polling")
          clearInterval(interval)
        }
      }, 2000) // Задержка 2 секунды перед началом polling

      return () => {
        clearTimeout(initialDelay)
      }
    }
  }, [currentScreen, gameState.id, gameState.status]) // Добавили gameState.status в зависимости

  // Обработчик для создания игры с ботом
  const handleCreateBotGame = useCallback(
    async (betAmount: number) => {
      if (!userData) {
        alert("Ошибка: Необходимо войти в систему для создания игры");
        return;
      }

      if (!userData.id || userData.id.trim() === '') {
        console.error("ID пользователя отсутствует или пустой");
        alert("Ошибка: ID пользователя не определен. Пожалуйста, перезайдите в аккаунт.");
        return;
      }
      
      // Дополнительная проверка и логирование
      console.log("Тип userData.id:", typeof userData.id);
      console.log("Значение userData.id:", userData.id);
      console.log("Длина userData.id:", userData.id.length);
      console.log("Все данные пользователя:", userData);
      
      // Проверка формата UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userData.id)) {
        console.error("ID пользователя не соответствует формату UUID:", userData.id);
        alert("Ошибка: ID пользователя имеет неверный формат. Пожалуйста, перезайдите в аккаунт.");
        return;
      }

      try {
        console.log(`Создание игры со ставкой ${betAmount} для пользователя ${userData.id}`);
        
        // Показываем индикатор загрузки или блокируем кнопку
        setIsLoading(true);
        
        // Используем явное преобразование к строке
        const userId = String(userData.id).trim();
        if (!userId) {
          alert("Ошибка: ID пользователя не может быть пустым");
          setIsLoading(false);
          return;
        }
        
        console.log("Подготовленный userId для отправки:", userId);
        
        // Создаем игру через API
        const response = await fetch('/api/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: userId, 
            betAmount: Number(betAmount) 
          }),
        });

        // Логируем статус ответа
        console.log(`Статус ответа: ${response.status} ${response.statusText}`);
        
        // Получаем данные ответа
        let responseData;
        try {
          responseData = await response.json();
          console.log("Данные ответа:", responseData);
        } catch (parseError) {
          console.error("Ошибка при разборе JSON ответа:", parseError);
          alert("Ошибка при обработке ответа сервера");
          setIsLoading(false);
          return;
        }
        
        if (!response.ok) {
          console.error("Ошибка создания игры:", responseData);
          let errorMessage = "Неизвестная ошибка";
          
          if (responseData.error) {
            errorMessage = responseData.error;
            console.error("Детали ошибки:", responseData.details);
          }
          
          alert(`Ошибка создания игры: ${errorMessage}`);
          setIsLoading(false);
          return;
        }

        console.log("Игра успешно создана:", responseData);
        
        // Проверяем наличие игры в ответе
        if (responseData) {
          console.log("Используем данные игры из ответа:", responseData);
          
          // Обновляем данные пользователя
          if (userData?.id) {
            await refreshUserData(userData.id, setUserData);
          }
          
          // Сразу присоединяем AI к игре
          const joinResponse = await fetch(`/api/games/${responseData.id}/join-ai`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: userData.id
            })
          });

          if (joinResponse.ok) {
            const joinResult = await joinResponse.json();
            console.log('✅ AI joined the game:', joinResult);
            
            // Используем данные игры с AI
            if (joinResult.game) {
              handleGameData(joinResult.game, betAmount);
            } else {
              handleGameData(responseData, betAmount);
            }
          } else {
            console.error('❌ Failed to join AI to game');
            // Все равно переходим в игру
            handleGameData(responseData, betAmount);
          }
          
          return;
        } else {
          console.error("Игра не найдена в ответе");
          alert("Ошибка: Игра не была создана");
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error("Ошибка при создании игры:", error);
        alert("Ошибка при создании игры. Пожалуйста, попробуйте снова.");
        setIsLoading(false);
      }
    },
    [userData, setUserData, handleGameData],
  )

  // Обработчик для присоединения к многопользовательской игре

  // Обработчик для хода в игре с ботом
  const handleBotGameMove = useCallback(
    async (index: number) => {
      if (!gameState || !userData) return

      try {
        // Проверяем, что ячейка пуста и игра активна
        if (gameState.board[index] || gameState.status !== "playing") return

        // Сначала обновляем интерфейс с ходом игрока
        const newBoard = [...gameState.board]
        newBoard[index] = gameState.currentPlayer
        
        // Устанавливаем время последнего хода
        setLastMoveTime(Date.now())
        
        try {
          setGameState(prev => ({
            ...prev,
            board: newBoard,
            currentPlayer: prev.currentPlayer === "X" ? "O" : "X"
          }))
        } catch (error) {
          console.error("Error updating game state:", error)
        }

        // Показываем индикатор "думающего" AI
        setIsAIThinking(true)

        try {
          // Небольшая задержка для создания эффекта "думающего" AI
          await new Promise(resolve => setTimeout(resolve, 800))
          
          // Отправляем ход на сервер
          const response = await fetch(`/api/games/${gameState.id}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index, userId: userData.id })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Ошибка при выполнении хода:', response.status, errorData);
            setIsAIThinking(false);
            return;
          }

          const result = await response.json();
          console.log('Move response:', result);
          
          if (result.game) {
            console.log(`Game response: status=${result.game.status}, winner=${result.game.winner}`);
            
            try {
              // Обновляем состояние игры с данными с сервера
              handleGameData(result.game, gameState.betAmount);
            } catch (error) {
              console.error("Error handling game data:", error)
            }
            
            // Проверяем, завершилась ли игра
            if (result.game.status === "completed" || result.game.status === "draw") {
              console.log(`Game ended with status: ${result.game.status}, winner: ${result.game.winner}`);
              
              // Обновляем данные пользователя с сервера
              if (userData?.id) {
                try {
                  await refreshUserData(userData.id, setUserData);
                } catch (error) {
                  console.error("Error refreshing user data:", error)
                }
              }
            }
          }
        } catch (error) {
          console.error('Ошибка при выполнении хода:', error);
        } finally {
          setIsAIThinking(false);
        }
      } catch (error) {
        console.error('Error in handleBotGameMove:', error);
        setIsAIThinking(false);
      }
    },
    [gameState, userData, setUserData, handleGameData]
  )

  // Обработчик для хода в многопользовательской игре
  const handleMultiplayerMove = useCallback(
    async (index: number) => {
      if (!activeGame || !userData) return
      
      try {
        console.log(`Making move: index=${index}, userId=${userData.id}, gameId=${activeGame.id}`)
        
        // Сохраняем текущий баланс перед ходом
        const previousBalance = userData.balance;
        console.log(`Current balance before move: ${previousBalance}`);
        
        // Определяем символ игрока (X или O)
        let playerSymbol = "X"; // По умолчанию игрок всегда X в играх против AI
        if (activeGame && activeGame.players) {
          playerSymbol = activeGame.players.X.id === userData.id ? "X" : "O";
        }
        console.log(`Player symbol: ${playerSymbol}`);
        
        // Делаем ход через API
        const response = await fetch(`/api/games/${activeGame.id}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index, userId: userData.id }),
        })
        
        if (!response.ok) {
          const err = await response.json()
          console.error("Move error:", err)
          alert(err.error || "Ошибка хода")
          return
        }
        
        const result = await response.json()
        console.log("Move result:", result)
        console.log("Game data:", result.game)
        console.log("Game status:", result.game.status)
        console.log("Game winner:", result.game.winner)
        console.log("Player symbol:", playerSymbol)
        
        // Обновляем состояние игры
        if (result.game) {
          try {
            setGameState({
              id: result.game.id,
              board: result.game.board,
              currentPlayer: result.game.current_player,
              players: {
                X: {
                  id: result.game.player_x,
                  username: result.game.player_x_username || "Player X",
                  avatar: null,
                },
                O: result.game.player_o ? {
                  id: result.game.player_o,
                  username: result.game.player_o_username || "Player O",
                  avatar: null,
                } : null,
              },
              status: result.game.status,
              betAmount: result.game.bet_amount,
              pot: result.game.pot,
              winner: result.game.winner,
              createdAt: result.game.created_at,
            })
          } catch (error) {
            console.error("Error updating game state:", error)
          }
          
          // Если игра завершена и текущий игрок проиграл
          console.log(`Checking loss condition: status=${result.game.status}, winner=${result.game.winner}, playerSymbol=${playerSymbol}`);
          if (result.game.status === "completed" && 
              result.game.winner && 
              result.game.winner !== playerSymbol) {
            console.log(`Game lost. Player symbol: ${playerSymbol}, Winner: ${result.game.winner}`);
            
            try {
              // Обновляем статистику
              const newGamesPlayed = userData.gamesPlayed + 1;
              
              console.log(`Updated user data in DB after loss`);
              
              // Обновляем локальное состояние
              setUserData({
                ...userData,
                gamesPlayed: newGamesPlayed
              });
              
              // Обновляем данные на сервере
              await updateUserBalance(
                userData.id, 
                userData.balance, 
                newGamesPlayed
              );
            } catch (error) {
              console.error("Error handling game loss:", error)
            }
            
            return;
          }
          
          // Если игра завершена и текущий игрок выиграл
          console.log(`Checking win condition: status=${result.game.status}, winner=${result.game.winner}, playerSymbol=${playerSymbol}`);
          if (result.game.status === "completed" && 
              result.game.winner && 
              result.game.winner === playerSymbol) {
            try {
              // Выигрыш - добавляем весь банк к текущему балансу
              const winnings = result.game.pot;
              const newBalance = previousBalance + winnings;
              const newGamesPlayed = userData.gamesPlayed + 1;
              const newGamesWon = userData.gamesWon + 1;
              const newTotalWinnings = (userData.totalWinnings || 0) + winnings;
              
              console.log(`Game won. Updating balance: ${previousBalance} + ${winnings} = ${newBalance}`);
              
              console.log(`Updated user data in DB after win`);
              
              // Обновляем локальное состояние
              setUserData({
                ...userData,
                balance: newBalance,
                gamesPlayed: newGamesPlayed,
                gamesWon: newGamesWon,
                totalWinnings: newTotalWinnings
              });
              
              // Обновляем данные на сервере
              await updateUserBalance(
                userData.id, 
                newBalance, 
                newGamesPlayed, 
                newGamesWon, 
                newTotalWinnings
              );
            } catch (error) {
              console.error("Error handling game win:", error)
            }
            
            return;
          }
          
          // Если игра завершена вничью
          console.log(`Checking draw condition: status=${result.game.status}`);
          if (result.game.status === "draw") {
            try {
              // Ничья - возвращаем ставку
              const refund = result.game.bet_amount;
              const newBalance = previousBalance + refund;
              const newGamesPlayed = userData.gamesPlayed + 1;
              
              console.log(`Game draw. Updating balance: ${previousBalance} + ${refund} = ${newBalance}`);
              
              console.log(`Updated user data in DB after draw`);
              
              // Обновляем локальное состояние
              setUserData({
                ...userData,
                balance: newBalance,
                gamesPlayed: newGamesPlayed
              });
              
              // Обновляем данные на сервере
              await updateUserBalance(
                userData.id, 
                newBalance, 
                newGamesPlayed
              );
            } catch (error) {
              console.error("Error handling game draw:", error)
            }
            
            return;
          }
          
          console.log(`Game not completed or no win condition met. Status: ${result.game.status}, Winner: ${result.game.winner}`);
        }
        
        // Принудительно обновляем данные пользователя после хода
        if (userData?.id) {
          console.log("Refreshing user data after move");
          try {
            await refreshUserData(userData.id, setUserData);
          } catch (error) {
            console.error("Error refreshing user data:", error)
          }
        }
      } catch (error) {
        console.error("Error making move:", error)
        alert("Произошла ошибка при выполнении хода")
      }
    },
    [activeGame, userData, setUserData, systemSettings],
  )

  // Обработчик для завершения игры
  const handleEndGame = useCallback(() => {
    try {
      console.log("🎮 Ending game...")
      
      if (activeGame) {
        try {
          endMultiplayerGame()
        } catch (error) {
          console.error("Error ending multiplayer game:", error)
        }
      }
      
      // Безопасное обновление состояния игры
      setGameState({
        id: '',
        board: Array(9).fill(null),
        currentPlayer: 'X',
        players: { X: { id: '', username: '', avatar: null }, O: null },
        status: 'waiting', // Изменяем на "waiting" вместо "playing"
        betAmount: 0,
        pot: 0,
        winner: null,
        createdAt: ''
      })
      
      setCurrentScreen("home")
      
      // После завершения игры сохраняем текущий баланс
      if (userData?.id) {
        console.log("Forcing user data refresh after game end")
        
        // Сохраняем текущий баланс для проверки
        const currentBalance = userData.balance;
        console.log(`Current balance before refresh: ${currentBalance}`);
        
        // Прямое обновление баланса в базе данных
        updateUserBalance(userData.id, currentBalance).then(() => {
          console.log(`Balance successfully updated to ${currentBalance}`);
          // Не обновляем данные пользователя, так как баланс уже установлен
        }).catch((error) => {
          console.error(`Failed to update balance, refreshing user data:`, error);
          try {
            refreshUserData(userData.id, setUserData);
          } catch (refreshError) {
            console.error("Error refreshing user data:", refreshError)
          }
        });
      }
    } catch (error) {
      console.error("Error in handleEndGame:", error)
      // В случае ошибки все равно переходим на главный экран
      setCurrentScreen("home")
    }
  }, [activeGame, endMultiplayerGame, userData, setUserData])

  // Обработчик запроса на пополнение баланса
  const handleDepositRequest = useCallback((amount: number) => {
    // В реальном приложении здесь был бы API-запрос
    console.log(`Запрос на пополнение баланса на сумму ${amount}`)
  }, [])

  // Отображаем модальное окно с приглашением в игру
  useEffect(() => {
    if (pendingInvite) {
      const handleInviteResponse = (accept: boolean) => {
        if (accept) {
          acceptInvite(pendingInvite.gameId)
        } else {
          declineInvite(pendingInvite.gameId)
        }
      }

      const confirmMessage = `${pendingInvite.from.username} приглашает вас сыграть. Принять приглашение?`
      if (confirm(confirmMessage)) {
        handleInviteResponse(true)
      } else {
        handleInviteResponse(false)
      }
    }
  }, [pendingInvite, acceptInvite, declineInvite])

  // Обработчик начала игры (когда ИИ присоединился)
  const handleGameStart = useCallback((gameData: any) => {
    console.log('🎮 Game started with data:', gameData)
    
    // Проверяем, что у нас есть необходимые данные
    if (!gameData.id || !gameData.players) {
      console.error('❌ Invalid game data:', gameData)
      return
    }
    
    // Показываем загрузку при переходе в игру
    setIsLoading(true)
    
    // Обновляем состояние игры
    const newGameState = {
      id: gameData.id,
      board: typeof gameData.board === 'string' ? JSON.parse(gameData.board) : (gameData.board || Array(9).fill(null)),
      currentPlayer: gameData.current_player || 'X',
      players: gameData.players,
      status: gameData.status || 'playing',
      betAmount: gameData.betAmount || gameData.bet_amount || 0,
      pot: gameData.pot || 0,
      winner: gameData.winner || null,
      createdAt: gameData.createdAt || gameData.created_at || new Date().toISOString()
    }
    
    console.log('🔄 Обновляем состояние игры:', newGameState)
    setGameState(newGameState)
    
    setGameMode("multiplayer")
    setCurrentScreen("game")
    console.log('✅ Переход на экран игры')
    
    // Скрываем загрузку после короткой задержки
    setTimeout(() => {
      setIsLoading(false)
    }, 500)
  }, [])

  // Обработчик отмены ожидания
  const handleCancelWaiting = useCallback(() => {
    setWaitingGameId("")
    setWaitingBetAmount(0)
    setCurrentScreen("home")
  }, [])

  // Подгружаем актуальный баланс при каждом переходе между экранами
  useEffect(() => {
    console.log('🔄 Screen changed to:', currentScreen)
    if (userData?.id) {
      refreshUserData(userData.id, setUserData)
    }
    // eslint-disable-next-line
  }, [currentScreen])

  // Функция для отправки активности игрока
  const sendActivity = useCallback(async (gameId: string, playerSymbol: string) => {
    if (!userData?.id) return

    try {
      await fetch(`/api/games/${gameId}/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userData.id,
          playerSymbol
        })
      })
    } catch (error) {
      console.error('Error sending activity:', error)
    }
  }, [userData?.id])

  // Отправляем активность каждые 30 секунд во время игры
  useEffect(() => {
    if (currentScreen === "game" && gameState?.id && userData?.id) {
      const playerSymbol = gameState.players.X.id === userData.id ? "X" : "O"
      
      // Отправляем активность сразу
      sendActivity(gameState.id, playerSymbol)
      
      // Затем каждые 30 секунд
      const interval = setInterval(() => {
        sendActivity(gameState.id, playerSymbol)
      }, 30000)

      return () => clearInterval(interval)
    }
  }, [currentScreen, gameState?.id, userData?.id, sendActivity])

  // Убираем периодическое обновление, которое может конфликтовать с другими обновлениями
  // useEffect(() => {
  //   if (!userData?.id) return;
    
  //   console.log("Setting up periodic user data refresh");
    
  //   // Обновляем данные сразу при монтировании
  //   refreshUserData(userData.id, setUserData);
    
  //   // Затем обновляем каждые 3 секунды (уменьшаем интервал для более частого обновления)
  //   const interval = setInterval(() => {
  //     console.log("Periodic user data refresh");
  //     refreshUserData(userData.id, setUserData);
  //   }, 3000);
    
  //   return () => {
  //     console.log("Clearing periodic user data refresh");
  //     clearInterval(interval);
  //   };
  // }, [userData?.id, setUserData]);

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="rounded-xl bg-white p-8 shadow-xl dark:bg-gray-800 flex flex-col items-center">
            <div className="mb-4 animate-spin text-primary">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" stroke="#6366F1" strokeWidth="4" strokeDasharray="90 60" />
              </svg>
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">Please wait...</div>
          </div>
        </div>
      )}
      {currentScreen === "home" && (
        <HomeScreen
          onCreateGame={handleCreateBotGame}
          onCreateMultiplayerGame={handleCreateMultiplayerGame}
          onNavigate={setCurrentScreen as (screen: "home" | "game" | "profile" | "lobby" | "leaderboard") => void}
          userData={userData}
          onAdminRequest={onAdminRequest}
          onMainSiteRequest={onMainSiteRequest}
        />
      )}

      {currentScreen === "waiting" && (
        <WaitingScreen
          gameId={waitingGameId}
          betAmount={waitingBetAmount}
          userData={userData}
          onGameStart={handleGameStart}
          onCancel={handleCancelWaiting}
        />
      )}

      {currentScreen === "game" && gameState && (
        gameState.status === "waiting" ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-2xl font-bold mb-4">Ожидание второго игрока...</div>
            <div className="text-gray-500">Отправьте ссылку другу или подождите, пока кто-то присоединится.</div>
          </div>
        ) : (
          <GameBoard
            gameState={gameState}
            onMakeMove={activeGame ? handleMultiplayerMove : handleBotGameMove}
            onEndGame={handleEndGame}
            userData={userData}
            isMultiplayer={!!activeGame}
            isAIThinking={isAITinking}
          />
        )
      )}

      {currentScreen === "profile" && userData && (
        <ProfileScreen
          userData={userData}
          onNavigate={(screen) => setCurrentScreen(screen as any)}
          onLogout={onLogout}
          setUserData={setUserData}
        />
      )}

      {currentScreen === "lobby" && (
        <LobbyScreen
          onJoinGame={handleJoinGame}
          onCreateGame={() => setCurrentScreen("home")}
          onBack={() => setCurrentScreen("home")}
          userData={userData}
        />
      )}

      {currentScreen === "leaderboard" && <LeaderboardScreen onNavigate={(screen) => setCurrentScreen(screen as any)} />}

      {/* Game Pause Modal */}
      {isGamePaused && pauseData && (
        <GamePauseModal
          gameId={pauseData.gameId}
          inactivePlayers={pauseData.inactivePlayers}
          onResume={() => {
            setIsGamePaused(false)
            setPauseData(null)
          }}
          onCancel={() => {
            setIsGamePaused(false)
            setPauseData(null)
            setCurrentScreen("home")
          }}
        />
      )}

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t border-gray-100 bg-white/80 p-3 shadow-lg backdrop-blur-lg dark:border-gray-800 dark:bg-gray-900/80">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentScreen("home")}
          className={currentScreen === "home" ? "text-primary" : "text-gray-400"}
        >
          <Trophy className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentScreen("lobby")}
          className={currentScreen === "lobby" ? "text-primary" : "text-gray-400"}
        >
          <Users className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentScreen("leaderboard")}
          className={currentScreen === "leaderboard" ? "text-primary" : "text-gray-400"}
        >
          <Clock className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentScreen("profile")}
          className={currentScreen === "profile" ? "text-primary" : "text-gray-400"}
        >
          <User className="h-6 w-6" />
        </Button>
      </nav>
    </main>
  )
})

UserInterface.displayName = "UserInterface"

export default UserInterface

// Вспомогательная функция для определения победителя
function calculateWinner(board: (string | null)[]) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ]

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]
    }
  }

  return null
}

// Вспомогательная функция для получения лучшего хода для бота
function getBestMove(board: (string | null)[], player: string): number | null {
  const opponent = player === "X" ? "O" : "X"

  // Проверяем, может ли бот выиграть следующим ходом
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) {
      const boardCopy = [...board]
      boardCopy[i] = player
      if (calculateWinner(boardCopy) === player) {
        return i
      }
    }
  }

  // Проверяем, может ли игрок выиграть следующим ходом и блокируем его
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) {
      const boardCopy = [...board]
      boardCopy[i] = opponent
      if (calculateWinner(boardCopy) === opponent) {
        return i
      }
    }
  }

  // Пытаемся занять центр
  if (board[4] === null) {
    return 4
  }

  // Пытаемся занять углы
  const corners = [0, 2, 6, 8]

  for (const corner of corners) {
    if (board[corner] === null) {
      return corner
    }
  }

  // Если нет возможности выиграть или заблокировать, делаем случайный ход
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) {
      return i
    }
  }

  return null
}

// Функции handleGameData больше нет здесь - она перемещена внутрь компонента UserInterface