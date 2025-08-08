"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Users } from "lucide-react"
import type { UserData } from "@/lib/types"

interface WaitingScreenProps {
  gameId: string
  betAmount: number
  userData: UserData | null
  onGameStart: (gameData: any) => void
  onCancel: () => void
}

export default function WaitingScreen({ gameId, betAmount, userData, onGameStart, onCancel }: WaitingScreenProps) {
  const [isJoiningAI, setIsJoiningAI] = useState(false)
  const [status, setStatus] = useState<'waiting' | 'joining' | 'starting'>('waiting')

  // Автоматическое подключение ИИ через 11 секунд
  useEffect(() => {
    const timer = setTimeout(() => {
      setStatus('joining')
      joinAI()
    }, 11000) // Увеличили до 11 секунд

    return () => clearTimeout(timer)
  }, [])

  // Проверяем статус игры каждые 2 секунды
  useEffect(() => {
    const checkGameStatus = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}`)
        if (response.ok) {
          const gameData = await response.json()
          if (gameData.status === 'playing') {
            setStatus('starting')
            // Удаляем игру из лобби перед стартом
            await fetch(`/api/games/lobby`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ gameId })
            })
            onGameStart(gameData)
            return
          }
        }
      } catch (error) {
        console.error('Error checking game status:', error)
      }
    }

    const interval = setInterval(checkGameStatus, 2000)
    return () => clearInterval(interval)
  }, [gameId, onGameStart])

  const joinAI = async () => {
    if (!userData) {
      console.error('❌ Нет данных пользователя')
      return
    }

    setIsJoiningAI(true)
    
    try {
      const response = await fetch(`/api/games/${gameId}/join-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userData.id
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        setStatus('starting')
        
        // Проверяем, что у нас есть правильные данные игры
        if (result.game && result.game.id) {
          onGameStart(result.game)
        } else {
          console.error('❌ Invalid game data in response:', result)
          setStatus('waiting')
        }
      } else {
        const errorData = await response.text()
        console.error('❌ Failed to join AI:', errorData)
        setStatus('waiting')
      }
    } catch (error) {
      console.error('❌ Error joining AI:', error)
      setStatus('waiting')
    } finally {
      setIsJoiningAI(false)
    }
  }

  const handleCancel = () => {
    // TODO: Удалить игру из БД
    onCancel()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md border-0 shadow-2xl dark:bg-gray-800">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <h2 className="text-xl font-semibold">Waiting for Opponent</h2>
          <p className="text-blue-100">Game ID: {gameId.slice(0, 8)}...</p>
        </div>
        
        <div className="p-6">
          <div className="mb-6 text-center">
            <div className="mb-4 flex justify-center">
              <div className="relative">
                <Users className="h-16 w-16 text-blue-500" />


              </div>
            </div>
            
            <h3 className="mb-2 text-lg font-semibold dark:text-white">
              {status === 'waiting' && 'Looking for opponent...'}
              {status === 'joining' && 'Connecting opponent...'}
              {status === 'starting' && 'Starting game...'}
            </h3>
            
            <p className="text-gray-600 dark:text-gray-300">
              Bet amount: ${betAmount}
            </p>
          </div>

          {status === 'waiting' && (
            <div className="mb-6 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                An opponent will join automatically
              </p>
            </div>
          )}



          {status === 'starting' && (
            <div className="mb-6 text-center">
              <div className="mx-auto h-8 w-8 rounded-full bg-green-500" />
              <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                Game starting...
              </p>
            </div>
          )}

          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={status === 'joining' || status === 'starting'}
              className="border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
} 