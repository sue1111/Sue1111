"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { GameResult } from "./game-results-dashboard"

interface WinStats {
  xWins: number
  oWins: number
  draws: number
  total: number
}

interface PlayerStats {
  name: string
  wins: number
  losses: number
  draws: number
  total: number
  winRate: number
}

export function GameResultsVisualizations({ results }: { results: GameResult[] }) {
  const [winStats, setWinStats] = useState<WinStats>({
    xWins: 0,
    oWins: 0,
    draws: 0,
    total: 0,
  })

  const [topPlayers, setTopPlayers] = useState<PlayerStats[]>([])

  useEffect(() => {
    // Calculate win statistics
    const stats = results.reduce(
      (acc, result) => {
        if (result.winner === "X") {
          acc.xWins += 1
        } else if (result.winner === "O") {
          acc.oWins += 1
        } else {
          acc.draws += 1
        }
        acc.total += 1
        return acc
      },
      { xWins: 0, oWins: 0, draws: 0, total: 0 },
    )

    setWinStats(stats)

    // Calculate player statistics
    const playerMap = new Map<string, PlayerStats>()

    results.forEach((result) => {
      // Process Player X
      if (!playerMap.has(result.player_x)) {
        playerMap.set(result.player_x, {
          name: result.player_x,
          wins: 0,
          losses: 0,
          draws: 0,
          total: 0,
          winRate: 0,
        })
      }

      // Process Player O
      if (!playerMap.has(result.player_o)) {
        playerMap.set(result.player_o, {
          name: result.player_o,
          wins: 0,
          losses: 0,
          draws: 0,
          total: 0,
          winRate: 0,
        })
      }

      const playerX = playerMap.get(result.player_x)!
      const playerO = playerMap.get(result.player_o)!

      playerX.total += 1
      playerO.total += 1

      if (result.winner === "X") {
        playerX.wins += 1
        playerO.losses += 1
      } else if (result.winner === "O") {
        playerO.wins += 1
        playerX.losses += 1
      } else {
        playerX.draws += 1
        playerO.draws += 1
      }

      playerX.winRate = (playerX.wins / playerX.total) * 100
      playerO.winRate = (playerO.wins / playerO.total) * 100

      playerMap.set(result.player_x, playerX)
      playerMap.set(result.player_o, playerO)
    })

    // Sort players by win rate and get top 5
    const sortedPlayers = Array.from(playerMap.values())
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 5)

    setTopPlayers(sortedPlayers)
  }, [results])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Games</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{winStats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Win Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold">
                {winStats.xWins} / {winStats.oWins} / {winStats.draws}
              </div>
              <div className="text-sm text-muted-foreground">X Wins / O Wins / Draws</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Win Percentages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm">X Wins</div>
                <div className="text-sm font-medium">
                  {winStats.total ? ((winStats.xWins / winStats.total) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm">O Wins</div>
                <div className="text-sm font-medium">
                  {winStats.total ? ((winStats.oWins / winStats.total) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm">Draws</div>
                <div className="text-sm font-medium">
                  {winStats.total ? ((winStats.draws / winStats.total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Win Distribution Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full">
            <div className="flex h-full items-end gap-2">
              <div
                className="bg-blue-500 w-1/3 rounded-t-md relative group"
                style={{ height: `${winStats.total ? (winStats.xWins / winStats.total) * 100 : 0}%` }}
              >
                <div className="absolute inset-x-0 bottom-full mb-2 flex justify-center">
                  <div className="bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {winStats.xWins} X Wins
                  </div>
                </div>
              </div>
              <div
                className="bg-red-500 w-1/3 rounded-t-md relative group"
                style={{ height: `${winStats.total ? (winStats.oWins / winStats.total) * 100 : 0}%` }}
              >
                <div className="absolute inset-x-0 bottom-full mb-2 flex justify-center">
                  <div className="bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {winStats.oWins} O Wins
                  </div>
                </div>
              </div>
              <div
                className="bg-gray-300 w-1/3 rounded-t-md relative group"
                style={{ height: `${winStats.total ? (winStats.draws / winStats.total) * 100 : 0}%` }}
              >
                <div className="absolute inset-x-0 bottom-full mb-2 flex justify-center">
                  <div className="bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {winStats.draws} Draws
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <div>X Wins</div>
              <div>O Wins</div>
              <div>Draws</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Players</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topPlayers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No player data available</div>
            ) : (
              topPlayers.map((player) => (
                <div key={player.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="font-medium">{player.name}</div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-sm">
                      <span className="text-green-500 font-medium">{player.wins}W</span>
                      {" / "}
                      <span className="text-red-500 font-medium">{player.losses}L</span>
                      {" / "}
                      <span className="text-gray-500 font-medium">{player.draws}D</span>
                    </div>
                    <div className="w-[60px] text-right font-medium">{player.winRate.toFixed(1)}%</div>
                    <div className="w-[100px] bg-gray-200 rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: `${player.winRate}%` }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
