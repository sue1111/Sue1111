"use client"

import { useState, useEffect, useMemo } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { GameState, UserData } from "@/lib/types"

interface GameBoardProps {
  gameState: GameState
  onMakeMove: (index: number) => void
  onEndGame: () => void
  userData: UserData | null
  isMultiplayer?: boolean
  isAIThinking?: boolean
  pendingMove?: { index: number; timestamp: number } | null
}

export default function GameBoard({
  gameState,
  onMakeMove,
  onEndGame,
  userData,
  isMultiplayer = false,
  isAIThinking = false,
  pendingMove = null,
}: GameBoardProps) {
  // Ensure betAmount and pot have default values
  const betAmount = gameState.betAmount || 
                   (gameState.pot && gameState.pot > 0 ? gameState.pot / 2 : 0) || 
                   0;
  const pot = gameState.pot || (gameState.betAmount ? gameState.betAmount * 2 : 0) || 0;
  
  // Функция для безопасного получения ставки с дополнительными проверками
  const getSafeBetAmount = () => {
    // Приоритет: gameState.betAmount > pot/2 > 0
    if (gameState.betAmount && gameState.betAmount > 0) {
      return gameState.betAmount;
    }
    if (gameState.pot && gameState.pot > 0) {
      return gameState.pot / 2;
    }
    // Если ничего не найдено, возвращаем 0
    return 0;
  };
  
  const safeBetAmount = getSafeBetAmount();
  
  // Определяем, какой символ использует текущий игрок (X или O)
  const playerSymbol = userData ? (gameState.players.X.id === userData.id ? "X" : "O") : "X"
  const isPlayerTurn = gameState.currentPlayer === playerSymbol
  
  // Добавляем логирование для отладки betAmount
  useEffect(() => {
    if (gameState.status === "completed" || gameState.status === "draw") {
      console.log(`🎮 BetAmount Debug:`, {
        gameStateBetAmount: gameState.betAmount,
        gameStatePot: gameState.pot,
        calculatedBetAmount: betAmount,
        safeBetAmount: safeBetAmount,
        calculatedPot: pot,
        gameState: gameState,
        gameStatus: gameState.status,
        gameWinner: gameState.winner,
        didPlayerWin: gameState.winner === playerSymbol
      });
    }
  }, [gameState.status, gameState.betAmount, gameState.pot, betAmount, safeBetAmount, pot, gameState.winner, playerSymbol]);

  const [showResults, setShowResults] = useState(false)
  const [timeLeft, setTimeLeft] = useState(15)
  const [lastMove, setLastMove] = useState<number | null>(null)
  const [boardHighlight, setBoardHighlight] = useState<number[]>([])
  const [isComponentMounted, setIsComponentMounted] = useState(true)
  const [gameEnded, setGameEnded] = useState(false)

  // Определяем имя противника
  const opponentName = gameState.players.O?.username || "Opponent"
  
  // Логируем отображение ника противника
  useEffect(() => {
    console.log(`🎮 Opponent name: "${opponentName}", ID: "${gameState.players.O?.id}"`)
  }, [opponentName, gameState.players.O?.id])

  // Добавляем логирование для отладки только при значительных изменениях
  useEffect(() => {
    console.log("🎮 GameBoard Debug:", {
      userDataId: userData?.id,
      playersX: gameState.players.X?.id,
      playersO: gameState.players.O?.id,
      playerSymbol,
      currentPlayer: gameState.currentPlayer,
      isPlayerTurn,
      gameStatePlayers: gameState.players
    })
  }, [gameState.board, gameState.status, gameState.currentPlayer, userData?.id])

  // Демонстрационная логика паузы (для тестирования)
  useEffect(() => {
    if (gameState.status === "playing" && isMultiplayer) {
      // Симулируем паузу через 30 секунд для демонстрации
      const pauseTimer = setTimeout(() => {
        console.log("🎮 Demo: Simulating game pause")
        // Здесь можно вызвать функцию паузы
      }, 30000)

      return () => clearTimeout(pauseTimer)
    }
  }, [gameState.status, isMultiplayer])

  // Устанавливаем флаг монтирования компонента
  useEffect(() => {
    setIsComponentMounted(true)
    return () => {
      setIsComponentMounted(false)
    }
  }, [])

  // Сбрасываем gameEnded когда начинается новая игра
  useEffect(() => {
    if (gameState.status === "playing") {
      console.log(`GameBoard: Resetting game states for new game`);
      setGameEnded(false)
      setShowResults(false)
    }
  }, [gameState.id])

  // Не сбрасываем модальное окно, если игра уже завершена
  useEffect(() => {
    if ((gameState.status === "completed" || gameState.status === "draw") && !showResults && !gameEnded) {
      console.log(`GameBoard: Game completed but modal not shown yet, setting up timer`);
      const timer = setTimeout(() => {
        console.log(`GameBoard: Showing results modal after completion`);
        setShowResults(true)
        setGameEnded(true)
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [gameState.status, gameState.winner, showResults, gameEnded])

  // Принудительно показываем модальное окно при завершении игры
  useEffect(() => {
    if ((gameState.status === "completed" || gameState.status === "draw") && !showResults) {
      console.log(`GameBoard: Forcing modal show for completed game`);
      setShowResults(true)
      setGameEnded(true)
    }
  }, [gameState.status, gameState.winner, showResults])

  // Защищаем модальное окно от сброса при обновлении userData
  useEffect(() => {
    if (showResults && (gameState.status === "completed" || gameState.status === "draw")) {
      console.log(`GameBoard: Modal is shown, protecting from reset`);
      console.log(`GameBoard: Modal userData:`, userData);
    }
  }, [userData, showResults, gameState.status])

  // Добавляем логирование для отладки состояния модального окна
  useEffect(() => {
    console.log(`GameBoard: Modal state - showResults: ${showResults}, gameEnded: ${gameEnded}, status: ${gameState.status}`);
  }, [showResults, gameEnded, gameState.status])

  // Таймер для ходов
  useEffect(() => {
    console.log(`GameBoard: gameState.status = ${gameState.status}, isPlayerTurn = ${isPlayerTurn}`);
    
    if (gameState.status === "playing" && isPlayerTurn) {
      const timer = setInterval(() => {
        if (!isComponentMounted) {
          clearInterval(timer)
          return
        }
        
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            // В многопользовательском режиме не делаем автоматический ход
            if (!isMultiplayer) {
              // Автоматический выбор случайной пустой ячейки, если время истекло
              const emptyIndices = gameState.board
                .map((cell, idx) => (cell === null ? idx : null))
                .filter((idx) => idx !== null) as number[]

              if (emptyIndices.length > 0) {
                const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)]
                onMakeMove(randomIndex)
              }
            }
            return 15
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }

    if ((gameState.status === "completed" || gameState.status === "draw") && !gameEnded) {
      console.log(`GameBoard: Game ended with status ${gameState.status}, winner: ${gameState.winner}`);
      setGameEnded(true)
      
      try {
        // Проверка на выигрышную линию
        const winningLine = getWinningLine(gameState.board)
        if (winningLine && isComponentMounted) {
          setBoardHighlight(winningLine)
        }

        // Показываем результаты немедленно
        if (isComponentMounted) {
          console.log(`GameBoard: Showing results modal immediately`);
          setShowResults(true)
        }
      } catch (error) {
        console.error("Error handling game end:", error)
        // В случае ошибки все равно показываем результаты
        if (isComponentMounted) {
          console.log(`GameBoard: Showing results modal due to error`);
          setShowResults(true)
        }
      }
    }

    return () => {}
  }, [gameState.status, gameState.currentPlayer, gameState.board, onMakeMove, isPlayerTurn, isMultiplayer, isComponentMounted])

  // Сбрасываем таймер, когда наступает ход игрока
  useEffect(() => {
    if (isPlayerTurn && isComponentMounted) {
      setTimeLeft(15)
    }
  }, [isPlayerTurn, isComponentMounted])

  const handleCellClick = (index: number) => {
    try {
      console.log("🎯 Cell clicked:", { 
        index, 
        isPlayerTurn, 
        status: gameState.status, 
        cellValue: gameState.board[index],
        currentPlayer: gameState.currentPlayer,
        playerSymbol
      })
      
      // Проверяем, что игра активна и можно делать ход
      if (isPlayerTurn && gameState.status === "playing" && gameState.board[index] === null) {
        console.log("🎯 Making move at position:", index)
        setLastMove(index)
        onMakeMove(index)
      } else {
        console.log("🎯 Cannot make move:", { 
          isPlayerTurn, 
          status: gameState.status, 
          cellValue: gameState.board[index] 
        })
        
        // Если игра завершена, показываем сообщение
        if (gameState.status === "completed" || gameState.status === "draw") {
          console.log("🎯 Game is already finished, cannot make move")
        }
      }
    } catch (error) {
      console.error("Error in handleCellClick:", error)
    }
  }

  // Оптимизация анимаций для мобильных устройств
  // Добавить плавные анимации для улучшения UX, но с учетом производительности
  const renderCell = (index: number) => {
    try {
      const value = gameState.board[index]
      const isLastMove = lastMove === index
      const isHighlighted = boardHighlight.includes(index)
      const isDisabled = !isPlayerTurn || gameState.status !== "playing" || value !== null || isAIThinking
      
      // Проверяем, есть ли pendingMove для этой ячейки
      const hasPendingMove = pendingMove && pendingMove.index === index
      const pendingPlayerSymbol = userData?.id === gameState.players?.X?.id ? "X" : "O"

      return (
        <button
          key={index}
          className={`game-board-cell min-h-[60px] touch-manipulation
          ${value === "X" ? "game-board-cell-x" : value === "O" ? "game-board-cell-o" : "hover:bg-gray-100 dark:hover:bg-gray-700"}
          ${isLastMove ? "ring-4 ring-primary/20 animate-pulse" : ""}
          ${isHighlighted ? "bg-primary/10 dark:bg-primary/20" : ""}
          ${isDisabled ? "cursor-not-allowed" : ""}
          ${isAIThinking && !isPlayerTurn ? "opacity-90" : ""}
          transition-all duration-300 ease-in-out`}
          onClick={() => handleCellClick(index)}
          disabled={isDisabled}
        >
          {(value === "X" || (hasPendingMove && pendingPlayerSymbol === "X")) && (
            <span
              className="text-4xl md:text-5xl transform transition-transform duration-300 ease-in-out"
              style={{ 
                animation: isLastMove ? "scale 0.3s ease-in-out" : "none",
                opacity: isAIThinking && isLastMove ? 0.8 : 1 
              }}
            >
              X
            </span>
          )}
          {(value === "O" || (hasPendingMove && pendingPlayerSymbol === "O")) && (
            <span
              className="text-4xl md:text-5xl transform transition-transform duration-300 ease-in-out"
              style={{ 
                animation: isLastMove ? "scale 0.3s ease-in-out" : "none",
                opacity: isAIThinking && isLastMove ? 0.8 : 1 
              }}
            >
              O
            </span>
          )}
        </button>
      )
    } catch (error) {
      console.error("Error rendering cell:", error)
      return (
        <div key={index} className="aspect-square rounded-lg bg-gray-200"></div>
      )
    }
  }

  // Оптимизация рендеринга игровой доски
  // Мемоизация ячеек доски для предотвращения ненужных ререндеров
  const boardCells = useMemo(() => {
    try {
      return gameState.board.map((_, index) => renderCell(index))
    } catch (error) {
      console.error("Error creating board cells:", error)
      return Array(9).fill(null).map((_, index) => (
        <div key={index} className="aspect-square rounded-lg bg-gray-200"></div>
      ))
    }
  }, [gameState.board, lastMove, boardHighlight, isPlayerTurn, gameState.status, isAIThinking])

  // Определяем, выиграл ли текущий игрок
  const didPlayerWin = gameState.winner === playerSymbol
  
  // Добавляем логирование для отладки
  useEffect(() => {
    if (gameState.status === "completed" || gameState.status === "draw") {
      console.log(`GameBoard: Win check - winner: ${gameState.winner}, playerSymbol: ${playerSymbol}, didPlayerWin: ${didPlayerWin}`);
    }
  }, [gameState.status, gameState.winner, playerSymbol, didPlayerWin])

  // Безопасная обработка закрытия модального окна
  const handleCloseResults = () => {
    try {
      setShowResults(false)
      setGameEnded(false)
      onEndGame()
    } catch (error) {
      console.error("Error closing results:", error)
      setGameEnded(false)
      onEndGame()
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 p-4 backdrop-blur-lg dark:border-gray-800 dark:bg-gray-900/80">
                  <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" className="text-gray-500" onClick={onEndGame}>
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Game #{gameState.id.slice(-5)}</h1>
            {isMultiplayer && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  console.log("🎮 Demo: Manual pause trigger")
                  // Здесь можно вызвать функцию паузы
                }}
                className="text-xs"
              >
                Simulate Pause
              </Button>
            )}
          </div>

        {/* Game Info */}
        <div className="mt-4 rounded-xl bg-white p-3 shadow-md dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Bet Per Move</div>
              <div className="font-bold text-primary">${gameState.betAmount}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Current Pot</div>
              <div className="font-bold text-primary">${gameState.pot}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Potential Win</div>
              <div className="font-bold text-primary">${gameState.pot.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Game Board */}
      <main className="flex flex-1 flex-col items-center justify-center p-6">
        {/* Game Status */}
        <div className="mb-6 text-center">
          {gameState.status === "playing" && (
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {isPlayerTurn ? "Your Turn" : "Opponent's Turn"}
              </h2>
              {isAIThinking && !isPlayerTurn && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                  enemy thinks...
                </div>
              )}
            </div>
          )}
          {gameState.status === "completed" && (
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {didPlayerWin ? "You Won!" : "You Lost!"}
            </h2>
          )}
          {gameState.status === "draw" && (
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">It's a Draw!</h2>
          )}
        </div>

        {/* Board */}
        <div className="grid w-full max-w-xs sm:max-w-sm grid-cols-3 gap-2 rounded-2xl bg-white p-4 shadow-lg dark:bg-gray-800">
          {boardCells}
        </div>

        {/* Players */}
        <div className="mt-8 flex w-full max-w-xs justify-between">
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
              X
            </div>
            <div className="font-medium text-gray-900 dark:text-white">{gameState.players.X.username}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {gameState.players.X.id === userData?.id ? "You" : "Opponent"}
            </div>
          </div>

          <div className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-900 text-white">
              O
            </div>
            <div className="font-medium text-gray-900 dark:text-white">{opponentName}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Opponent
            </div>
          </div>
        </div>
      </main>

      {/* Results Modal */}
      {(() => {
        console.log(`GameBoard: Rendering modal - showResults: ${showResults}, gameState.status: ${gameState.status}`);
        return null;
      })()}
      {(showResults || gameState.status === "completed" || gameState.status === "draw") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <Card className="w-full max-w-sm border-0 shadow-2xl animate-fade-in dark:bg-gray-800">
            <div
              className={`p-4 text-white ${
                didPlayerWin
                  ? "bg-gradient-to-r from-primary to-primary/80"
                  : gameState.status === "draw"
                    ? "bg-gray-700"
                    : "bg-gray-900"
              }`}
            >
              <h3 className="text-lg font-semibold">
                {didPlayerWin ? "You Won!" : gameState.status === "draw" ? "It's a Draw!" : "You Lost!"}
              </h3>
            </div>
            <div className="p-4">
              <div className="mb-4">
                {didPlayerWin && (
                  <p className="text-gray-600 dark:text-gray-300">
                    Congratulations! You won ${(safeBetAmount * 2).toFixed(2)} (2x your bet).
                  </p>
                )}

                {gameState.status === "draw" && (
                  <p className="text-gray-600 dark:text-gray-300">
                    The game ended in a draw. Your bets have been returned.
                  </p>
                )}

                {gameState.winner && !didPlayerWin && (
                  <p className="text-gray-600 dark:text-gray-300">
                    Better luck next time! You lost ${safeBetAmount.toFixed(2)}.
                  </p>
                )}
              </div>

              <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-700">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Your Bet</div>
                    <div className="font-bold text-primary">${safeBetAmount.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Your Balance</div>
                    <div className="font-bold text-primary">${userData?.balance?.toFixed(2) || "0.00"}</div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  className="border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                  onClick={handleCloseResults}
                >
                  Back to Home
                </Button>
                <Button
                  className="bg-primary text-white hover:bg-primary/90"
                  onClick={() => {
                    try {
                      setShowResults(false)
                      onEndGame()
                    } catch (error) {
                      console.error("Error in play again:", error)
                      onEndGame()
                    }
                  }}
                >
                  Play Again
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// Вспомогательная функция для получения выигрышной линии
function getWinningLine(board: (string | null)[]): number[] {
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
      return [a, b, c]
    }
  }

  return []
}
