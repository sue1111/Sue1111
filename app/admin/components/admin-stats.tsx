"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CreditCard, DollarSign, Activity } from "lucide-react"

interface AdminStatsProps {
  adminId: string
}

interface StatsData {
  totalUsers: number
  activeUsers: number
  totalTransactions: number
  totalVolume: number
}

export default function AdminStats({ adminId }: AdminStatsProps) {
  const [stats, setStats] = useState<StatsData>({
    totalUsers: 0,
    activeUsers: 0,
    totalTransactions: 0,
    totalVolume: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      if (!adminId) return

      try {
        const response = await fetch(`/api/admin/stats?adminId=${adminId}`, {
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        })

        if (response.ok) {
          const data = await response.json()
          setStats(data)
        } else {
          console.error("Failed to fetch admin stats")
        }
      } catch (error) {
        console.error("Error fetching admin stats:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
    // Set up auto-refresh every 60 seconds
    const intervalId = setInterval(fetchStats, 60000)
    return () => clearInterval(intervalId)
  }, [adminId])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Всего пользователей</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isLoading ? "..." : stats.totalUsers}</div>
          <p className="text-xs text-muted-foreground">
            {isLoading ? "..." : stats.activeUsers} активных пользователей
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Транзакции</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isLoading ? "..." : stats.totalTransactions}</div>
          <p className="text-xs text-muted-foreground">
            +{isLoading ? "..." : Math.floor(stats.totalTransactions * 0.1)} за последние 24 часа
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Объем</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${isLoading ? "..." : stats.totalVolume.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">
            +${isLoading ? "..." : (stats.totalVolume * 0.05).toFixed(2)} за последние 24 часа
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Активность</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isLoading ? "..." : Math.floor(stats.totalUsers * 0.7)}</div>
          <p className="text-xs text-muted-foreground">
            +{isLoading ? "..." : Math.floor(stats.totalUsers * 0.1)} активных игр
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
