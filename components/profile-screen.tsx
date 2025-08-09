"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Plus, ArrowUpRight, Clock, Trophy, LogOut, History, User, DollarSign, Target, Star, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { UserData, Transaction } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import GameHistoryModal from "./game-history-modal"

interface ProfileScreenProps {
  userData: UserData
  onNavigate: (screen: "home" | "game" | "profile" | "lobby" | "leaderboard") => void
  onLogout: () => void
  setUserData: (user: UserData) => void
}

export default function ProfileScreen({ userData, onNavigate, onLogout, setUserData }: ProfileScreenProps) {
  const { toast } = useToast()
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [amount, setAmount] = useState(100)
  const [withdrawAmount, setWithdrawAmount] = useState(10)
  const [walletAddress, setWalletAddress] = useState(userData.walletAddress || "")
  const [withdrawWalletAddress, setWithdrawWalletAddress] = useState("")
  const [depositSent, setDepositSent] = useState(false)
  const [withdrawSent, setWithdrawSent] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  const [transactionError, setTransactionError] = useState<string | null>(null)
  const [showGameHistoryModal, setShowGameHistoryModal] = useState(false)
  const [systemSettings, setSystemSettings] = useState({
    depositWalletAddress: "TJDENsfBJs4RFETt1X1W8wMDc8M5XnJhCe",
    minWithdrawal: 10,
    depositFee: 20
  })
  const [leaderboardPosition, setLeaderboardPosition] = useState(0)
  const [topWinningsPosition, setTopWinningsPosition] = useState(0)

  // Загружаем системные настройки
  useEffect(() => {
    const loadSystemSettings = async () => {
      try {
        const response = await fetch("/api/settings?type=system")
        if (response.ok) {
          const settings = await response.json()
          setSystemSettings({
            depositWalletAddress: settings.depositWalletAddress || "TJDENsfBJs4RFETt1X1W8wMDc8M5XnJhCe",
            minWithdrawal: settings.minWithdrawal || 10,
            depositFee: settings.depositFee || 20
          })
        }
      } catch (error) {
        console.error("Ошибка загрузки системных настроек:", error)
      }
    }

    loadSystemSettings()
  }, [])

  // Загружаем позиции из БД
  useEffect(() => {
    const loadPositions = async () => {
      if (!userData?.id) return
      try {
        // Получаем позицию в лидерборде
        const leaderboardResponse = await fetch('/api/leaderboard')
        if (leaderboardResponse.ok) {
          const leaderboardData = await leaderboardResponse.json()
          const userIndex = leaderboardData.findIndex((user: any) => user.id === userData.id)
          if (userIndex !== -1) {
            setLeaderboardPosition(userIndex + 1)
          }
        }

        // Получаем позицию по выигрышам
        const winningsResponse = await fetch('/api/leaderboard?sort=totalWinnings')
        if (winningsResponse.ok) {
          const winningsData = await winningsResponse.json()
          const userIndex = winningsData.findIndex((user: any) => user.id === userData.id)
          if (userIndex !== -1) {
            setTopWinningsPosition(userIndex + 1)
          }
        }
      } catch (error) {
        console.error("Ошибка загрузки позиций:", error)
      }
    }

    loadPositions()
  }, [userData?.id])

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!userData.id) return
      setIsLoadingTransactions(true)
      setTransactionError(null)
      try {
        const response = await fetch(`/api/transactions?userId=${userData.id}`)
        if (!response.ok) throw new Error("Failed to fetch transactions")
        const data = await response.json()
        // Фильтруем только пополнения и выводы
        const filteredTransactions = data.filter((tx: Transaction) => 
          tx.type === "deposit" || tx.type === "withdrawal"
        )
        setTransactions(filteredTransactions)
      } catch (error) {
        setTransactionError("Failed to load transaction history")
      } finally {
        setIsLoadingTransactions(false)
      }
    }
    fetchTransactions()
  }, [userData.id])

  // Подгружаем актуальный баланс из базы при открытии профиля
  useEffect(() => {
    async function fetchFreshUserData() {
      if (!userData?.id) return
      const response = await fetch(`/api/users/${userData.id}`)
      if (response.ok) {
        const freshUser = await response.json()
        setUserData(freshUser)
      }
    }
    fetchFreshUserData()
  }, [userData?.id, setUserData])

  const createStarsPayment = async (amount: number) => {
    setDepositSent(true)
    try {
      const response = await fetch("/api/telegram/stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userData.id,
          amount: amount,
          description: `Game balance top-up for ${userData.username}`,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create payment link.")
      }

      const data = await response.json()
      
      if (data.success && data.invoiceLink) {
        // Открываем ссылку для оплаты в новом окне
        window.open(data.invoiceLink, '_blank')
        
        toast({
          title: "Payment Link Created",
          description: `Payment link opened. Complete payment in Telegram to add ⭐${amount} to your balance.`,
        })
        
        setShowDepositModal(false)
      } else {
        throw new Error("Invalid response from server.")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      })
    } finally {
      setDepositSent(false)
    }
  }

  const createWithdrawRequest = async (amount: number, walletAddress: string) => {
    setWithdrawSent(true)
    try {
      const response = await fetch("/api/withdraw_requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userData.id,
          amount: amount,
          walletAddress: walletAddress,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to send withdrawal request.")
      }

      toast({
        title: "Request Sent",
        description: "Your withdrawal request has been sent to the administrator for review.",
      })
      setShowWithdrawModal(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      })
    } finally {
      setWithdrawSent(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date)
  }

  const winRate = userData.gamesPlayed > 0 ? Math.round((userData.gamesWon / userData.gamesPlayed) * 100) : 0

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" className="text-gray-600 hover:bg-gray-100" onClick={() => onNavigate("home")}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-bold text-gray-900">Player Profile</h1>
          <div className="w-6"></div>
        </div>
      </header>

      {/* Main Content - Centered Rectangle */}
      <div className="flex justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Profile Banner */}
          <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-r from-blue-500 to-purple-600 mb-6">
            <div className="p-6 text-white">
              <div className="flex items-end justify-between">
                <div className="flex items-center">
                  {userData.avatar ? (
                    <img
                      src={userData.avatar || "/placeholder.svg"}
                      alt={userData.username}
                      className="h-20 w-20 rounded-full shadow-lg"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 shadow-lg text-white text-2xl font-bold">
                      {userData.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="ml-4">
                    <h2 className="text-2xl font-bold">{userData.username}</h2>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white/80">Balance</div>
                  <div className="text-3xl font-bold">${userData.balance.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Top Winnings Ranking */}
          <Card className="border-0 shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 mb-6">
            <div className="p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <TrendingUp className="h-6 w-6 mr-3" />
                  <div>
                    <div className="text-sm text-white/80">Top Winnings</div>
                    <div className="text-2xl font-bold">#{topWinningsPosition || "N/A"}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white/80">Leaderboard Position</div>
                  <div className="text-2xl font-bold">#{leaderboardPosition || "N/A"}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Performance Stats */}
          <Card className="border-0 shadow-lg bg-white mb-6">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Performance</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                    <Trophy className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Games Won</div>
                    <div className="text-xl font-bold text-gray-900">{userData.gamesWon || 0}</div>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Games Played</div>
                    <div className="text-xl font-bold text-gray-900">{userData.gamesPlayed || 0}</div>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                    <div className="text-lg font-bold text-purple-600">%</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Win Rate</div>
                    <div className="text-xl font-bold text-gray-900">{winRate}%</div>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                    <DollarSign className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Total Winnings</div>
                    <div className="text-xl font-bold text-gray-900">${(userData.totalWinnings || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Button 
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 py-3"
              onClick={() => setShowDepositModal(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Deposit
            </Button>
            <Button 
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700 py-3"
              onClick={() => setShowWithdrawModal(true)}
            >
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Withdraw
            </Button>
          </div>

          {/* Transaction History */}
          <Card className="border-0 shadow-lg bg-white mb-6">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Transaction History</h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-200 text-gray-700 hover:bg-gray-100"
                  onClick={() => setShowGameHistoryModal(true)}
                >
                  <History className="mr-2 h-4 w-4" />
                  Game History
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                {isLoadingTransactions ? (
                  <div className="text-center text-gray-500 py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="mt-2">Loading transactions...</p>
                  </div>
                ) : transactionError ? (
                  <div className="text-center text-red-500 py-8">{transactionError}</div>
                ) : transactions.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No transactions yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {transactions.slice(0, 10).map((tx) => {
                      let sign = "";
                      let color = "";
                      let icon = null;
                      
                      if (tx.type === "deposit") {
                        sign = "+";
                        color = "text-green-600";
                        icon = <Plus className="h-4 w-4" />;
                      } else if (tx.type === "withdrawal") {
                        sign = "-";
                        color = "text-red-600";
                        icon = <ArrowUpRight className="h-4 w-4" />;
                      }
                      
                      return (
                        <div key={tx.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                                tx.type === "deposit" ? "bg-green-100" : "bg-red-100"
                              }`}>
                                {icon}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 capitalize">
                                  {tx.type}
                                </div>
                                <div className="text-sm text-gray-500">{formatDate(tx.createdAt)}</div>
                              </div>
                            </div>
                            <div className={`font-bold ${color}`}>
                              {sign}${tx.amount.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Logout Button */}
          <Button
            variant="outline"
            className="w-full border-gray-200 text-gray-700 hover:bg-gray-100"
            onClick={onLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Telegram Stars Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-sm border-0 shadow-2xl bg-white">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white">
              <h3 className="text-lg font-semibold flex items-center">
                ⭐ Telegram Stars Deposit
              </h3>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <p className="mb-2 text-gray-600">Top up your balance using Telegram Stars:</p>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-800">
                    <p>• Fast and secure payment</p>
                    <p>• Instant balance update</p>
                    <p>• 1 Star = $1 game credit</p>
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-gray-700">Amount (Stars)</label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  min={1}
                  max={2500}
                  placeholder="Enter amount of stars"
                />
                {amount > 0 && (
                  <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-sm text-green-800">
                      <div className="flex justify-between">
                        <span>Stars to pay:</span>
                        <span>⭐ {amount}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-green-600 border-t border-green-300 pt-1 mt-1">
                        <span>Game balance:</span>
                        <span>+${amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  className="border-gray-200 text-gray-700 hover:bg-gray-100"
                  onClick={() => setShowDepositModal(false)}
                >
                  Close
                </Button>
                <Button
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
                  onClick={() => createStarsPayment(amount)}
                  disabled={depositSent || amount <= 0}
                >
                  {depositSent ? "Creating..." : `Pay ⭐${amount}`}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-sm border-0 shadow-2xl bg-white">
            <div className="bg-gradient-to-r from-orange-500 to-red-600 p-4 text-white">
              <h3 className="text-lg font-semibold">Withdraw USDT (TRC20)</h3>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <p className="mb-2 text-gray-600">Enter your TRC20 wallet address and withdrawal amount:</p>
                <p className="text-sm text-gray-500">
                  Minimum withdrawal: ${systemSettings.minWithdrawal}. Processing time: 1-24 hours.
                </p>
              </div>
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-gray-700">Your TRC20 Wallet Address</label>
                <Input
                  type="text"
                  value={withdrawWalletAddress}
                  onChange={(e) => setWithdrawWalletAddress(e.target.value)}
                  placeholder="Enter your TRC20 wallet address"
                  className="font-mono text-sm"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-gray-700">Withdrawal Amount (USDT)</label>
                <Input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                  min={systemSettings.minWithdrawal}
                  max={userData.balance}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Available balance: ${userData.balance.toFixed(2)}
                </p>
              </div>
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  className="border-gray-200 text-gray-700 hover:bg-gray-100"
                  onClick={() => setShowWithdrawModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700"
                  onClick={() => {
                    if (!withdrawWalletAddress || withdrawWalletAddress.length < 30) {
                      toast({
                        title: "Validation Error",
                        description: "Please enter a valid TRC20 wallet address.",
                        variant: "destructive",
                      })
                      return
                    }
                    if (withdrawAmount < systemSettings.minWithdrawal) {
                      toast({
                        title: "Validation Error",
                        description: `Minimum withdrawal amount is $${systemSettings.minWithdrawal}.`,
                        variant: "destructive",
                      })
                      return
                    }
                    if (withdrawAmount > userData.balance) {
                      toast({
                        title: "Validation Error",
                        description: "Withdrawal amount cannot exceed your balance.",
                        variant: "destructive",
                      })
                      return
                    }
                    createWithdrawRequest(withdrawAmount, withdrawWalletAddress)
                  }}
                  disabled={withdrawSent}
                >
                  {withdrawSent ? "Sending..." : "Request Withdrawal"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Game History Modal */}
      <GameHistoryModal
        userData={userData}
        isOpen={showGameHistoryModal}
        onClose={() => setShowGameHistoryModal(false)}
      />
    </div>
  )
}
