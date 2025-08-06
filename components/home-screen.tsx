"use client"

import { useState, useEffect } from "react"
import { Play, Trophy, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { UserData } from "@/lib/types"
import { useMobile } from "@/hooks/use-mobile"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface HomeScreenProps {
  onCreateGame: (betAmount: number) => void
  onCreateMultiplayerGame: (betAmount: number) => void
  onNavigate: (screen: "home" | "game" | "profile" | "lobby" | "leaderboard") => void
  userData: UserData | null
  onAdminRequest: () => void
  onMainSiteRequest: () => void
}

export default function HomeScreen({ onCreateGame, onCreateMultiplayerGame, onNavigate, userData, onAdminRequest, onMainSiteRequest }: HomeScreenProps) {
  const [betAmount, setBetAmount] = useState(10)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showGameModal, setShowGameModal] = useState(false)
  const [systemSettings, setSystemSettings] = useState({
    minBet: 1,
    maxBet: 100
  })
  const { isMobile, isIOS } = useMobile()

  // Загружаем системные настройки
  useEffect(() => {
    const loadSystemSettings = async () => {
      try {
        const response = await fetch("/api/settings?type=system")
        if (response.ok) {
          const settings = await response.json()
          setSystemSettings({
            minBet: settings.minBet || 1,
            maxBet: settings.maxBet || 100
          })
          // Устанавливаем начальную ставку как минимальную
          setBetAmount(settings.minBet || 1)
        }
      } catch (error) {
        console.error("Ошибка загрузки системных настроек:", error)
      }
    }

    loadSystemSettings()
  }, [])

  const handleCreateGame = async () => {
    if (!userData) {
      alert("Please log in to play")
      return
    }

    // Проверяем минимальную и максимальную ставку
    if (betAmount < systemSettings.minBet) {
      alert(`Minimum bet: $${systemSettings.minBet}`)
      return
    }

    if (betAmount > systemSettings.maxBet) {
      alert(`Maximum bet: $${systemSettings.maxBet}`)
      return
    }

    if (userData.balance < betAmount) {
      setShowDepositModal(true)
      return
    }

    // Закрываем модальное окно перед созданием игры
    setShowGameModal(false)
    
    try {
      // Создаем мультиплеер игру вместо игры против ИИ
      await onCreateMultiplayerGame(betAmount)
    } catch (error) {
      console.error('Error creating game:', error)
      alert('Failed to create game. Please try again.')
      // Можно снова показать модальное окно при ошибке
      setShowGameModal(true)
    }
  }

  return (
    <div
      className={`flex min-h-screen flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 ${isIOS ? "safe-area-top" : ""}`}
    >
      {/* Header */}
      <header
        className={`sticky top-0 z-10 border-b border-gray-200/50 bg-white/90 p-4 backdrop-blur-lg dark:border-gray-800/50 dark:bg-gray-900/90 ${isIOS ? "pt-safe" : ""}`}
      >
        {userData && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-white to-gray-50 p-4 shadow-lg dark:from-gray-800 dark:to-gray-700">
            <div className="flex items-center">
              {userData.avatar ? (
                <img
                  src={userData.avatar || "/placeholder.svg"}
                  alt={userData.username}
                  className="h-12 w-12 rounded-full border-2 border-white shadow-md dark:border-gray-700"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md">
                  {userData.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="ml-3">
                <span className="font-bold text-gray-900 dark:text-white">{userData.username}</span>
                <div className="text-xs text-gray-500 dark:text-gray-400">Player</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 dark:text-gray-400">Balance</div>
              <div className="font-bold text-2xl text-green-600 dark:text-green-400">${userData.balance.toFixed(2)}</div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Tic Tac Toe
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Challenge opponents and win big!
            </p>
            </div>

          {/* Main Game Card */}
          <Card className="overflow-hidden border-0 shadow-2xl transition-all hover:shadow-3xl dark:bg-gray-800">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
              <div className="flex items-center justify-between">
              <div>
                  <h3 className="text-xl font-bold">Ready to Play?</h3>
                  <p className="text-green-100">Start your adventure now</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Play className="h-6 w-6" />
                </div>
              </div>
            </div>
            <div className="p-6">
              <Button
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 py-4 text-lg font-semibold shadow-lg transition-all duration-200 transform hover:scale-105"
                onClick={() => setShowGameModal(true)}
              >
                <Play className="mr-3 h-5 w-5" />
                Start Game
              </Button>
            </div>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
          <Card className="overflow-hidden border-0 shadow-lg transition-all hover:shadow-xl dark:bg-gray-800">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">Leaderboard</h4>
                    <p className="text-xs text-blue-100">Top Players</p>
                  </div>
                  <Trophy className="h-5 w-5" />
                </div>
            </div>
            <div className="p-4">
                <Button 
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
                  onClick={() => onNavigate("leaderboard")}
                >
                  View Rankings
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden border-0 shadow-lg transition-all hover:shadow-xl dark:bg-gray-800">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">Multiplayer</h4>
                    <p className="text-xs text-orange-100">Find Opponents</p>
                  </div>
                  <Users className="h-5 w-5" />
                </div>
            </div>
            <div className="p-4">
              <Button
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
                  onClick={() => onNavigate("lobby")}
              >
                  Find Match
              </Button>
            </div>
          </Card>
          </div>

          {/* Admin Panel - только для админов */}
          {userData?.isAdmin && (
            <Card className="overflow-hidden border-0 shadow-lg transition-all hover:shadow-xl dark:bg-gray-800">
              <div className="bg-gradient-to-r from-purple-500 to-pink-600 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">Admin Panel</h4>
                    <p className="text-xs text-purple-100">Manage System</p>
                  </div>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="p-4">
                {userData?.isAdmin && (
                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700"
                      onClick={onAdminRequest}
                    >
                      Admin Dashboard
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-purple-500 text-purple-600 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-900"
                      onClick={onMainSiteRequest}
                    >
                      Return to Main Site
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </main>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <Card className="w-full max-w-sm border-0 shadow-2xl animate-fade-in dark:bg-gray-800">
            <div className="bg-gradient-to-r from-red-500 to-pink-600 p-4 text-white">
              <h3 className="text-lg font-semibold">Insufficient Funds</h3>
            </div>
            <div className="p-4">
              <p className="mb-4 text-gray-600 dark:text-gray-300">
                You don't have enough funds to place a bet of ${betAmount}. Current balance: $
                {userData?.balance.toFixed(2)}
              </p>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  className="border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                  onClick={() => setShowDepositModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-gradient-to-r from-red-500 to-pink-600 text-white hover:from-red-600 hover:to-pink-700"
                  onClick={() => {
                    setShowDepositModal(false)
                    onNavigate("profile")
                  }}
                >
                  Add Funds
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Game Creation Modal */}
      {showGameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <Card className="w-full max-w-sm border-0 shadow-2xl animate-fade-in dark:bg-gray-800">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 text-white">
              <h3 className="text-lg font-semibold">Set Your Bet</h3>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <Label htmlFor="betAmount" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Bet Amount
                </Label>
                <Input
                  id="betAmount"
                  type="number"
                  min={systemSettings.minBet}
                  max={systemSettings.maxBet}
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  className="mt-1"
                  placeholder={`$${systemSettings.minBet} - $${systemSettings.maxBet}`}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Available: ${userData?.balance.toFixed(2)}
                </p>
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  className="border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                  onClick={() => setShowGameModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700"
                  onClick={handleCreateGame}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Playing
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
