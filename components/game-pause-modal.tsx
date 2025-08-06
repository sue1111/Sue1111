"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, User, AlertCircle } from "lucide-react"

interface GamePauseModalProps {
  gameId: string
  inactivePlayers: Array<{
    user_id: string
    player_symbol: string
    username?: string
    last_activity: string
  }>
  onResume: () => void
  onCancel: () => void
}

export default function GamePauseModal({ 
  gameId, 
  inactivePlayers, 
  onResume, 
  onCancel 
}: GamePauseModalProps) {
  const [timeLeft, setTimeLeft] = useState(120) // 2 минуты в секундах
  const [isResuming, setIsResuming] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Время вышло, автоматически отменяем игру
          onCancel()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [onCancel])

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleResume = async () => {
    setIsResuming(true)
    try {
      // Отправляем запрос на возобновление игры
      const response = await fetch(`/api/games/${gameId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (response.ok) {
        onResume()
      } else {
        console.error('Failed to resume game')
      }
    } catch (error) {
      console.error('Error resuming game:', error)
    } finally {
      setIsResuming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md border-0 shadow-2xl dark:bg-gray-800">
        <div className="bg-gradient-to-r from-orange-500 to-red-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Game Paused</h3>
              <p className="text-orange-100">Waiting for players to return</p>
            </div>
            <AlertCircle className="h-8 w-8" />
          </div>
        </div>
        
        <div className="p-6">
          <div className="mb-6 text-center">
            <div className="mb-4 flex justify-center">
              <Clock className="h-16 w-16 text-orange-500" />
            </div>
            
            <h3 className="mb-2 text-lg font-semibold dark:text-white">
              Game Paused
            </h3>
            
            <div className="mb-4 text-center">
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {formatTime(timeLeft)}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Time remaining to resume
              </p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Inactive players:
              </p>
              {inactivePlayers.map((player, index) => (
                <div key={index} className="flex items-center justify-center gap-2 mb-1">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {player.username || `Player ${player.player_symbol}`} ({player.player_symbol})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel Game
            </Button>
            <Button
              onClick={handleResume}
              disabled={isResuming}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700"
            >
              {isResuming ? "Resuming..." : "Resume Game"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
} 