"use client"

import { useState, useEffect } from "react"
import { Users, BarChart3, Settings, LogOut, Wallet, GamepadIcon, Percent, Bell, User, Gamepad2, DollarSign, Users as UsersIcon, AlertTriangle, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import AdminUsers from "@/components/admin/admin-users"
import AdminTransactions from "@/components/admin/admin-transactions"
import AdminSettings from "@/components/admin/admin-settings"
import AdminGames from "@/components/admin/admin-games"
import AdminGameSettings from "@/components/admin/admin-game-settings"
import AdminNotifications from "@/components/admin/admin-notifications"
import type { UserData, Notification, Transaction } from "@/lib/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase"

interface AdminStats {
  totalUsers: number
  activeUsers: number
  totalGames: number
  gamesLast24Hours: number
  totalVolume: number
  pendingWithdrawals: number
  pendingDeposits: number
}

interface AdminDashboardProps {
  userData: UserData
  onLogout: () => void
}

export default function AdminDashboard({ userData, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [adminStats, setAdminStats] = useState<AdminStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalGames: 0,
    gamesLast24Hours: 0,
    totalVolume: 0,
    pendingWithdrawals: 0,
    pendingDeposits: 0,
  })
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [recentUsers, setRecentUsers] = useState<UserData[]>([])
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0)
  const [pendingVerifications, setPendingVerifications] = useState(0)

  const fetchDashboardData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const adminId = userData.id
      const responses = await Promise.all([
        fetch(`/api/admin/stats?adminId=${adminId}`),
        fetch(`/api/admin/users/recent?adminId=${adminId}`),
        fetch(`/api/admin/transactions/recent?adminId=${adminId}`),
        fetch(`/api/admin/notifications?adminId=${adminId}`),
      ])

      for (const response of responses) {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to fetch data: ${response.statusText}`)
        }
      }

      const [statsData, usersData, transactionsData, notificationsData] = await Promise.all(
        responses.map((res) => res.json()),
      )

      setAdminStats(statsData)
      setRecentUsers(usersData.users || [])
      setRecentTransactions(transactionsData.transactions || [])
      setNotifications(notificationsData || [])

      // Оживляем Pending Actions
      const supabase = getSupabaseClient()
      const { count: withdrawalsCount, error: withdrawalsError } = await supabase
        .from("withdraw_requests")
        .select("*", { count: "exact" })
        .eq("status", "pending")

      if (withdrawalsError) {
        console.error("Ошибка получения pending-запросов:", withdrawalsError)
      }
      setPendingWithdrawals(withdrawalsCount || 0)

      const { count: unverifiedCount, error: unverifiedError } = await supabase
        .from("users")
        .select("*", { count: "exact" })
        .eq("verified", false)

      if (unverifiedError) {
        console.error("Ошибка получения непроверенных пользователей:", unverifiedError)
      }
      setPendingVerifications(unverifiedCount || 0)
    } catch (err) {
      console.error("Error fetching dashboard data:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred while fetching dashboard data.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!userData || !userData.id) {
      console.error("Admin ID is missing")
      setError("Admin ID is missing. Cannot fetch data.")
      setIsLoading(false)
      return
    }

    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [userData])

  const unreadNotifications = notifications.filter((n) => n.status === "pending").length

  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown"
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins} min ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour ago`
    return date.toLocaleDateString()
  }

  if (!userData.isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
        <Card className="w-full max-w-md border-0 p-6 text-center shadow-2xl">
          <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-gray-600">You don't have permission to access the admin panel.</p>
          <Button className="mt-4 bg-primary hover:bg-primary/90" onClick={onLogout}>
            Back to Home
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 p-4 backdrop-blur-lg dark:border-gray-800 dark:bg-gray-900/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
            <div className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary dark:bg-primary/20">
              v1.0
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="relative text-gray-500"
              onClick={() => setActiveTab("notifications")}
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                  {unreadNotifications}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-500" onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:block">
          <div className="mb-6 flex items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
              <span className="text-sm font-medium">{userData.username.charAt(0).toUpperCase()}</span>
            </div>
            <div className="ml-3">
              <div className="font-medium text-gray-900 dark:text-white">{userData.username}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Administrator</div>
            </div>
          </div>
          <nav className="space-y-1">
            <Button
              variant="ghost"
              className={`w-full justify-start ${
                activeTab === "dashboard" ? "bg-primary/10 text-primary dark:bg-primary/20" : ""
              }`}
              onClick={() => setActiveTab("dashboard")}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start ${
                activeTab === "users" ? "bg-primary/10 text-primary dark:bg-primary/20" : ""
              }`}
              onClick={() => setActiveTab("users")}
            >
              <Users className="mr-2 h-4 w-4" />
              Users
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start ${
                activeTab === "games" ? "bg-primary/10 text-primary dark:bg-primary/20" : ""
              }`}
              onClick={() => setActiveTab("games")}
            >
              <GamepadIcon className="mr-2 h-4 w-4" />
              Games
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start ${
                activeTab === "transactions" ? "bg-primary/10 text-primary dark:bg-primary/20" : ""
              }`}
              onClick={() => setActiveTab("transactions")}
            >
              <Wallet className="mr-2 h-4 w-4" />
              Transactions
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start ${
                activeTab === "notifications" ? "bg-primary/10 text-primary dark:bg-primary/20" : ""
              }`}
              onClick={() => setActiveTab("notifications")}
            >
              <Bell className="mr-2 h-4 w-4" />
              Notifications
              {unreadNotifications > 0 && (
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                  {unreadNotifications}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start ${
                activeTab === "game-settings" ? "bg-primary/10 text-primary dark:bg-primary/20" : ""
              }`}
              onClick={() => setActiveTab("game-settings")}
            >
              <Percent className="mr-2 h-4 w-4" />
              Game Settings
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start ${
                activeTab === "settings" ? "bg-primary/10 text-primary dark:bg-primary/20" : ""
              }`}
              onClick={() => setActiveTab("settings")}
            >
              <Settings className="mr-2 h-4 w-4" />
              System Settings
            </Button>
          </nav>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {activeTab === "dashboard" && (
            <div className="animate-fade-in">
              <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h2>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {/* Stat Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="flex flex-col items-center justify-center p-6">
                  <UsersIcon className="mb-2 h-8 w-8 text-blue-500" />
                  <div className="text-sm text-gray-500 font-medium">Total Users</div>
                  <div className="text-3xl font-bold">{adminStats.totalUsers}</div>
                  <div className="text-xs text-green-600 mt-1">{adminStats.activeUsers} active today</div>
                </Card>
                <Card className="flex flex-col items-center justify-center p-6">
                  <Gamepad2 className="mb-2 h-8 w-8 text-indigo-500" />
                  <div className="text-sm text-gray-500 font-medium">Total Games</div>
                  <div className="text-3xl font-bold">{adminStats.totalGames}</div>
                  <div className="text-xs text-green-600 mt-1">{adminStats.gamesLast24Hours} games today</div>
                </Card>
                <Card className="flex flex-col items-center justify-center p-6">
                  <DollarSign className="mb-2 h-8 w-8 text-sky-500" />
                  <div className="text-sm text-gray-500 font-medium">Total Volume</div>
                  <div className="text-3xl font-bold">${adminStats.totalVolume.toFixed(2)}</div>
                </Card>
              </div>
              {/* Recent Users & Transactions */}
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Card className="p-4">
                  <div className="font-semibold text-lg mb-2">Recent Users</div>
                  {recentUsers.length === 0 ? (
                    <div className="text-gray-400">No recent users found</div>
                  ) : (
                    <ul>
                      {recentUsers.slice(0, 4).map((user) => (
                        <li key={user.id} className="flex items-center py-2 border-b last:border-b-0">
                          <User className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="font-medium">{user.username}</span>
                          <span className="ml-auto text-xs text-gray-500">{formatDate(user.createdAt || (user as any).created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {recentUsers.length > 4 && (
                    <div className="flex justify-center mt-2">
                      <Button size="sm" variant="outline" onClick={() => setActiveTab("users")}>Show all</Button>
                    </div>
                  )}
                </Card>
                <Card className="p-4">
                  <div className="font-semibold text-lg mb-2">Recent Transactions</div>
                  {recentTransactions.length === 0 ? (
                    <div className="text-gray-400">No recent transactions found</div>
                  ) : (
                    <ul>
                      {recentTransactions.slice(0, 4).map((tx) => (
                        <li key={tx.id} className="flex items-center py-2 border-b last:border-b-0">
                          <DollarSign className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="font-medium">{tx.type}</span>
                          <span className="ml-2">${tx.amount}</span>
                          <span className="ml-auto text-xs text-gray-500">{formatDate(tx.createdAt || (tx as any).created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {recentTransactions.length > 4 && (
                    <div className="flex justify-center mt-2">
                      <Button size="sm" variant="outline" onClick={() => setActiveTab("transactions")}>Show all</Button>
                    </div>
                  )}
                </Card>
              </div>
              
              {/* Admin Tools */}
              <div className="mt-6">
                <Card className="p-4">
                  <div className="font-semibold text-lg mb-2">Admin Tools</div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={async () => {
                        try {
                          const response = await fetch("/api/debug/fix-game-status", {
                            method: "POST"
                          });
                          const result = await response.json();
                          if (result.success) {
                            alert(`Fixed ${result.waitingGamesFixed} games!`);
                            // Refresh dashboard data
                            fetchDashboardData();
                          } else {
                            alert("Failed to fix game statuses");
                          }
                        } catch (error) {
                          alert("Error fixing game statuses");
                        }
                      }}
                    >
                      Fix Game Statuses
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={async () => {
                        try {
                          const response = await fetch("/api/debug/check-games");
                          const result = await response.json();
                          console.log("Games analysis:", result.analysis);
                          alert(`Games Analysis:\nTotal: ${result.analysis.total}\nBy Status: ${JSON.stringify(result.analysis.byStatus)}\nBy Winner: ${JSON.stringify(result.analysis.byWinner)}`);
                        } catch (error) {
                          alert("Error checking games");
                        }
                      }}
                    >
                      Check Games
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}
          {activeTab === "users" && <AdminUsers />}
          {activeTab === "games" && <AdminGames adminId={userData.id} />}
          {activeTab === "transactions" && <AdminTransactions adminId={userData.id} />}
          {activeTab === "notifications" && <AdminNotifications adminId={userData.id} notifications={notifications} />}
          {activeTab === "game-settings" && <AdminGameSettings adminId={userData.id} />}
          {activeTab === "settings" && <AdminSettings />}
        </div>
      </main>
    </div>
  )
}
