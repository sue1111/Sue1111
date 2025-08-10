'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus, Users, Clock, DollarSign } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('LobbyScreen')

interface LobbyGame {
  id: string
  status: string
  betAmount: number
  pot: number
  createdAt: string
  creator: {
    id: string
    username: string
    avatar: string | null
  } | null
  hasSecondPlayer: boolean
  players: any
}

interface LobbyScreenProps {
  userData: any
  onJoinGame: (gameId: string) => void
  onCreateGame: (betAmount: number) => void
  onBack: () => void
}

export default function LobbyScreen({ userData, onJoinGame, onCreateGame, onBack }: LobbyScreenProps) {
  const [games, setGames] = useState<LobbyGame[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('waiting')
  const [betMin, setBetMin] = useState('')
  const [betMax, setBetMax] = useState('')
  const { toast } = useToast()

  // Загрузка игр
  const fetchGames = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({
        status: statusFilter,
        ...(betMin && { betMin }),
        ...(betMax && { betMax }),
        limit: '50'
      })

      const response = await fetch(`/api/games/lobby?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch games')
      }

      const data = await response.json()
      setGames(data)
      logger.info(`Loaded ${data.length} games from lobby`)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch games'
      setError(errorMessage)
      logger.error(`Error fetching games: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Присоединение к игре
  const handleJoinGame = async (gameId: string) => {
    console.log("🎮 handleJoinGame called with gameId:", gameId)
    console.log("🎮 userData:", userData)
    
    // Просто вызываем onJoinGame, который обработает присоединение
    console.log("🎮 Calling onJoinGame with gameId:", gameId)
    onJoinGame(gameId)
  }

  // Создание новой игры - вызываем прямо создание игры
  const handleCreateGame = (betAmount: number = 1) => {
    onCreateGame(betAmount) // Создаем игру напрямую
  }

  // Отмена игры
  const handleCancelGame = async (gameId: string) => {
    try {
      const response = await fetch(`/api/games/${gameId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userData.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast({
          title: "Error cancelling game",
          description: errorData.error || "Failed to cancel game",
          variant: "destructive"
        })
        return
      }

      const data = await response.json()
      toast({
        title: "Success",
        description: `Game cancelled! Refunded $${data.refundedAmount}`,
      })

      // Обновляем список игр
      fetchGames()
    } catch (error) {
      console.error("Error cancelling game:", error)
      toast({
        title: "Error",
        description: "Failed to cancel game. Please try again.",
        variant: "destructive"
      })
    }
  }

  // Фильтрация игр
  const filteredGames = games.filter((game) => {
    const matchesSearch = 
      game.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (game.creator?.username && game.creator.username.toLowerCase().includes(searchQuery.toLowerCase()))

    return matchesSearch
  })

  // Автообновление списка игр
  useEffect(() => {
    fetchGames()
    
    const interval = setInterval(fetchGames, 5000) // Обновляем каждые 5 секунд
    
    return () => clearInterval(interval)
  }, [statusFilter, betMin, betMax])

  // Форматирование времени
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Multiplayer Lobby</h1>
            <p className="text-gray-600">Find opponents or create a new game</p>
          </div>
          
          <Button 
            onClick={() => handleCreateGame(1)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Game
          </Button>
        </div>
      </div>

      {/* Фильтры */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
                placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
          />
        </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="playing">Playing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            
            <Input
              placeholder="Min bet"
              value={betMin}
              onChange={(e) => setBetMin(e.target.value)}
              type="number"
            />
            
            <Input
              placeholder="Max bet"
              value={betMax}
              onChange={(e) => setBetMax(e.target.value)}
              type="number"
            />
          </div>
        </CardContent>
              </Card>

      {/* Список игр */}
      <div className="grid gap-4">
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-gray-900"></div>
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-red-800">{error}</p>
              <Button onClick={fetchGames} variant="outline" className="mt-2">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && filteredGames.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No games found</h3>
              <p className="text-gray-600 mb-4">
                No games match your current filters. Try adjusting your search criteria or create a new game.
              </p>
              <Button onClick={() => handleCreateGame(1)}>
                Create First Game
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && filteredGames.map((game) => (
          <Card key={game.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={game.status === 'waiting' ? 'default' : 'secondary'}>
                      {game.status}
                    </Badge>
                    {game.hasSecondPlayer && (
                      <Badge variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        2 Players
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      <span>${game.betAmount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatTimeAgo(game.createdAt)}</span>
                    </div>
                  </div>
                  
                  {game.creator && (
                    <p className="text-sm text-gray-600 mt-1">
                      Created by <span className="font-medium">{game.creator.username}</span>
                    </p>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {game.status === 'waiting' && !game.hasSecondPlayer && game.creator?.id !== userData?.id && (
                    <Button 
                      onClick={() => handleJoinGame(game.id)}
                      size="sm"
                    >
                      Join Game
                    </Button>
                  )}
                  
                  {game.status === 'waiting' && game.creator?.id === userData?.id && (
                    <div className="flex gap-2">
                      <Button 
                        size="sm"
                        variant="outline"
                        disabled
                      >
                        Waiting for opponent...
                      </Button>
                      <Button 
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancelGame(game.id)}
                      >
                        Cancel Game
                      </Button>
                    </div>
                  )}
                  
                  {game.status === 'playing' && (
                    <Button 
                      onClick={() => handleJoinGame(game.id)}
                      size="sm"
                      variant="outline"
                    >
                      Watch Game
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
