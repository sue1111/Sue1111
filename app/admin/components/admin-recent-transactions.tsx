"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { formatDate } from "@/lib/utils/format"

interface AdminRecentTransactionsProps {
  adminId: string
}

interface Transaction {
  id: string
  userId: string
  username?: string
  type: string
  amount: number
  currency: string
  status: string
  createdAt: string
}

export default function AdminRecentTransactions({ adminId }: AdminRecentTransactionsProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchRecentTransactions = async () => {
    if (!adminId) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/transactions/recent?adminId=${adminId}&limit=5`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setTransactions(data)
      } else {
        console.error("Failed to fetch recent transactions")
      }
    } catch (error) {
      console.error("Error fetching recent transactions:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRecentTransactions()
    // Auto-refresh every 30 seconds
    const intervalId = setInterval(fetchRecentTransactions, 30000)
    return () => clearInterval(intervalId)
  }, [adminId])

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "deposit":
        return <Badge className="bg-blue-500">Депозит</Badge>
      case "withdrawal":
        return <Badge className="bg-purple-500">Вывод</Badge>
      case "bet":
        return <Badge className="bg-orange-500">Ставка</Badge>
      case "win":
        return <Badge className="bg-green-500">Выигрыш</Badge>
      default:
        return <Badge className="bg-gray-500">{type}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="outline" className="border-green-500 text-green-500">
            Завершено
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-500">
            В обработке
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="outline" className="border-red-500 text-red-500">
            Отклонено
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Недавние транзакции</CardTitle>
          <Button size="sm" variant="outline" onClick={fetchRecentTransactions} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-2">
        {isLoading ? (
          <div className="flex h-[200px] items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-gray-500">Транзакции не найдены</div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {getTypeBadge(tx.type)}
                    <span className="text-sm font-medium">{tx.username || tx.userId.substring(0, 8)}</span>
                  </div>
                  <p className="text-xs text-gray-500">{formatDate(tx.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium ${tx.type === "deposit" || tx.type === "win" ? "text-green-500" : "text-red-500"}`}
                  >
                    {tx.type === "deposit" || tx.type === "win" ? "+" : "-"}${tx.amount.toFixed(2)}
                  </span>
                  {getStatusBadge(tx.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
