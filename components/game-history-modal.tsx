"use client"

import { useState, useEffect } from "react"
import { X, Trophy, Clock, DollarSign, User, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { UserData } from "@/lib/types"

interface GameHistoryModalProps {
  userData: UserData
  isOpen: boolean
  onClose: () => void
}

interface GameHistory {
  id: string
  status: string
  winner: string | null
  betAmount: number
  potAmount: number
  createdAt: string
  completedAt: string | null
  playerX: {
    id: string
    username: string
    avatar: string | null
  }
  playerO: {
    id: string
    username: string
    avatar: string | null
  }
  board: string[][]
  currentPlayer: string
}

export default function GameHistoryModal({ userData, isOpen, onClose }: GameHistoryModalProps) {
  const [games, setGames] = useState<GameHistory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const fetchGames = async (reset = false) => {
    if (!userData.id) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const currentOffset = reset ? 0 : offset
      const response = await fetch(`/api/users/${userData.id}/games?limit=10&offset=${currentOffset}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch game history")
      }
      
      const data = await response.json()
      
      if (reset) {
        setGames(data.games)
        setOffset(10)
      } else {
        setGames(prev => [...prev, ...data.games])
        setOffset(prev => prev + 10)
      }
      
      setHasMore(data.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load game history")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && userData.id) {
      fetchGames(true)
    }
  }, [isOpen, userData.id])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const getGameResult = (game: GameHistory) => {
    if (game.status === "completed") {
      if (game.winner === "X") {
        return game.playerX.id === userData.id ? "Won" : "Lost"
      } else if (game.winner === "O") {
        return game.playerO.id === userData.id ? "Won" : "Lost"
      } else {
        return "Draw"
      }
    } else if (game.status === "playing") {
      return "In Progress"
    } else if (game.status === "waiting") {
      return "Waiting"
    } else if (game.status === "draw") {
      return "Draw"
    }
    return game.status
  }

  const getGameResultColor = (result: string) => {
    switch (result) {
      case "Won":
        return "bg-green-100 text-green-800"
      case "Lost":
        return "bg-red-100 text-red-800"
      case "Draw":
        return "bg-yellow-100 text-yellow-800"
      case "In Progress":
        return "bg-blue-100 text-blue-800"
      case "Waiting":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getOpponentName = (game: GameHistory) => {
    if (game.playerX.id === userData.id) {
      return game.playerO.username
    } else {
      return game.playerX.username
    }
  }

  const getOpponentIcon = (game: GameHistory) => {
    // Определяем ИИ по ID (начинается с 'ai_') или по отсутствию пользователя в БД
    const isAI = (playerId: string) => {
      return playerId && (playerId.startsWith('ai_') || playerId === 'Unknown Player')
    }
    
    if (game.playerX.id === userData.id) {
      return isAI(game.playerO.id) ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />
    } else {
      return isAI(game.playerX.id) ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-6">
          <div className="flex items-center space-x-3">
            <Trophy className="h-6 w-6 text-yellow-500" />
            <h2 className="text-xl font-bold">Game History</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-120px)] overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4 text-red-800">
              {error}
            </div>
          )}

          {games.length === 0 && !isLoading && (
            <div className="text-center py-8 text-gray-500">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No games played yet</p>
            </div>
          )}

          <div className="space-y-4">
            {games.map((game) => (
              <Card key={game.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {getOpponentIcon(game)}
                      <span className="font-medium">{getOpponentName(game)}</span>
                    </div>
                    <Badge className={getGameResultColor(getGameResult(game))}>
                      {getGameResult(game)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <DollarSign className="h-4 w-4" />
                      <span>${game.betAmount}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatDate(game.createdAt)}</span>
                    </div>
                  </div>
                </div>
                
                {game.status === "completed" && game.winner && (
                  <div className="mt-2 text-sm text-gray-500">
                    {game.winner === "X" ? "You played as X" : "You played as O"}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 text-center">
              <Button 
                onClick={() => fetchGames(false)}
                disabled={isLoading}
                variant="outline"
              >
                {isLoading ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 