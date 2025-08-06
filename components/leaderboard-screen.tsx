"use client"

import { useState, useEffect, useMemo } from "react"
import { ArrowLeft, Search, Trophy, DollarSign, Loader2, TrendingUp, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { LeaderboardPlayer } from "@/lib/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface LeaderboardScreenProps {
  onNavigate: (screen: "home" | "game" | "profile" | "lobby" | "leaderboard" | "admin") => void
}

export default function LeaderboardScreen({ onNavigate }: LeaderboardScreenProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("winnings")
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardPlayer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/leaderboard?type=${activeTab}`)
        if (!response.ok) {
          throw new Error("Failed to fetch leaderboard data")
        }
        const data = await response.json()
        setLeaderboardData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    fetchLeaderboard()
  }, [activeTab])

  const filteredPlayers = useMemo(() => {
    return leaderboardData.filter((player) => player.username.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [leaderboardData, searchQuery])

  const getRankColor = (index: number) => {
    if (index === 0) return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white"
    if (index === 1) return "bg-gradient-to-r from-gray-300 to-gray-500 text-white"
    if (index === 2) return "bg-gradient-to-r from-amber-500 to-amber-700 text-white"
    return "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
  }

  const renderPlayerList = (players: LeaderboardPlayer[], sortBy: "winnings" | "wins") => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-gray-600">Loading leaderboard...</p>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )
    }

    if (players.length === 0) {
      return (
        <Card className="border-0 shadow-lg p-8 text-center">
          <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No players found</h3>
          <p className="text-gray-600">Try adjusting your search criteria</p>
        </Card>
      )
    }

    const sortedPlayers = [...players].sort((a, b) =>
      sortBy === "winnings" ? b.winnings - a.winnings : b.gamesWon - a.gamesWon,
    )

    return (
      <div className="space-y-4">
        {sortedPlayers.map((player, index) => (
          <Card 
            key={player.id} 
            className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] max-w-full"
          >
            <div className="flex items-center p-6 min-w-0">
                             {/* Rank Badge */}
               <div className={`flex h-12 w-12 items-center justify-center rounded-full ${getRankColor(index)} shadow-lg mr-4`}>
                 <span className="text-sm font-bold">{index + 1}</span>
               </div>
              
              {/* Player Info */}
              <div className="flex flex-1 items-center min-w-0">
                {player.avatar ? (
                  <img
                    src={player.avatar || "/placeholder.svg"}
                    alt={player.username}
                    className="h-12 w-12 rounded-full border-2 border-white shadow-md flex-shrink-0"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-lg shadow-md flex-shrink-0">
                    {player.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="ml-4 min-w-0 flex-1">
                  <div className="font-bold text-lg text-gray-900 truncate">{player.username}</div>
                  <div className="text-sm text-gray-500 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="truncate">
                      {sortBy === "winnings" ? `${player.gamesWon} wins` : `$${player.winnings.toLocaleString()} earned`}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Stats */}
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  {sortBy === "winnings" ? "Total Winnings" : "Total Wins"}
                </div>
                <div className="flex items-center justify-end font-bold text-lg">
                  {sortBy === "winnings" ? (
                    <>
                      <DollarSign className="h-5 w-5 text-green-500 mr-1 flex-shrink-0" />
                      <span className="text-green-600">{player.winnings.toLocaleString()}</span>
                    </>
                  ) : (
                    <>
                      <Trophy className="h-5 w-5 text-yellow-500 mr-1 flex-shrink-0" />
                      <span className="text-yellow-600">{player.gamesWon}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

      return (
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-gray-500 hover:bg-gray-100" 
            onClick={() => onNavigate("home")}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Leaderboard
            </h1>
            <p className="text-sm text-gray-600">Top players and champions</p>
          </div>
          <div className="w-10"></div> {/* Spacer for alignment */}
        </div>

        {/* Search */}
        <div className="mt-4 flex items-center rounded-xl bg-white shadow-sm border border-gray-200 p-3">
          <Search className="ml-2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-0 bg-transparent text-gray-900 placeholder-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      </header>

      {/* Leaderboard Tabs */}
      <div className="p-4 flex-1 overflow-y-auto">
        <Tabs defaultValue="winnings" onValueChange={(value) => setActiveTab(value)}>
          <TabsList className="grid w-full grid-cols-2 bg-white shadow-lg rounded-xl p-1">
            <TabsTrigger 
              value="winnings" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white rounded-lg transition-all duration-200"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Top Winnings
            </TabsTrigger>
            <TabsTrigger 
              value="wins" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-orange-600 data-[state=active]:text-white rounded-lg transition-all duration-200"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Most Wins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="winnings" className="mt-6">
            {renderPlayerList(filteredPlayers, "winnings")}
          </TabsContent>

          <TabsContent value="wins" className="mt-6">
            {renderPlayerList(filteredPlayers, "wins")}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
