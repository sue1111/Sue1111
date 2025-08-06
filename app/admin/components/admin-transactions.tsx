"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Search, Check, X, AlertCircle } from "lucide-react"
import type { Transaction } from "@/lib/types"

export default function AdminTransactions({ adminId }: { adminId: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async () => {
    if (!adminId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/transactions?adminId=${adminId}&status=${statusFilter}&type=${typeFilter}&search=${searchQuery}&page=${page}`,
        {
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        },
      )

      if (!response.ok) {
        throw new Error("Failed to fetch transactions")
      }

      const data = await response.json()
      setTransactions(data.transactions || [])
      setTotalPages(data.totalPages || 1)
    } catch (error) {
      console.error("Error fetching transactions:", error)
      setError("Failed to load transactions. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }, [adminId, statusFilter, typeFilter, searchQuery, page])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchTransactions()
    }, 30000)

    return () => clearInterval(intervalId)
  }, [fetchTransactions])

  const handleUpdateStatus = async (transactionId: string, newStatus: string) => {
    if (!adminId) return

    setIsUpdating(true)
    setUpdateError(null)

    try {
      const response = await fetch(`/api/admin/transactions/${transactionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminId,
          status: newStatus,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update transaction status")
      }

      // Refresh transactions after update
      fetchTransactions()
      setSelectedTransaction(null)
    } catch (error) {
      console.error("Error updating transaction:", error)
      setUpdateError("Failed to update transaction status. Please try again.")
    } finally {
      setIsUpdating(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>
      case "failed":
        return <Badge className="bg-red-500">Failed</Badge>
      default:
        return <Badge className="bg-gray-500">{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "deposit":
        return <Badge className="bg-blue-500">Deposit</Badge>
      case "withdrawal":
        return <Badge className="bg-purple-500">Withdrawal</Badge>
      case "bet":
        return <Badge className="bg-orange-500">Bet</Badge>
      case "win":
        return <Badge className="bg-green-500">Win</Badge>
      default:
        return <Badge className="bg-gray-500">{type}</Badge>
    }
  }

  return (
    <Card className="col-span-1 h-[calc(100vh-2rem)] overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Transactions</CardTitle>
          <Button size="sm" variant="outline" onClick={fetchTransactions} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-2">
        <div className="mb-4 flex flex-wrap gap-2 px-2">
          <div className="flex flex-1 items-center space-x-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by user or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 flex-1"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="deposit">Deposit</SelectItem>
              <SelectItem value="withdrawal">Withdrawal</SelectItem>
              <SelectItem value="bet">Bet</SelectItem>
              <SelectItem value="win">Win</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-500">
            <div className="flex items-center">
              <AlertCircle className="mr-2 h-4 w-4" />
              {error}
            </div>
          </div>
        )}

        <div className="h-[calc(100vh-15rem)] overflow-y-auto rounded-md border">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-500">No transactions found</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500">
                  <th className="px-4 py-2 text-left">ID</th>
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b text-sm hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{transaction.id.substring(0, 8)}...</td>
                    <td className="px-4 py-2">{transaction.username || transaction.userId.substring(0, 8)}</td>
                    <td className="px-4 py-2">{getTypeBadge(transaction.type)}</td>
                    <td className="px-4 py-2 font-medium">
                      {transaction.type === "deposit" || transaction.type === "win" ? "+" : "-"}$
                      {transaction.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2">{getStatusBadge(transaction.status)}</td>
                    <td className="px-4 py-2 text-xs">{formatDate(transaction.createdAt)}</td>
                    <td className="px-4 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedTransaction(transaction)}
                        className="h-7 text-xs"
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between px-2">
          <div className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isLoading}
            >
              Next
            </Button>
          </div>
        </div>

        {/* Transaction Detail Modal */}
        {selectedTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <Card className="w-full max-w-lg">
              <CardHeader>
                <CardTitle>Transaction Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-500">ID</div>
                      <div className="font-mono text-sm">{selectedTransaction.id}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">User ID</div>
                      <div className="font-mono text-sm">{selectedTransaction.userId}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Type</div>
                      <div>{getTypeBadge(selectedTransaction.type)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Amount</div>
                      <div className="font-medium">
                        {selectedTransaction.type === "deposit" || selectedTransaction.type === "win" ? "+" : "-"}$
                        {selectedTransaction.amount.toFixed(2)} {selectedTransaction.currency}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Status</div>
                      <div>{getStatusBadge(selectedTransaction.status)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Created At</div>
                      <div className="text-sm">{formatDate(selectedTransaction.createdAt)}</div>
                    </div>
                    {selectedTransaction.completedAt && (
                      <div>
                        <div className="text-sm font-medium text-gray-500">Completed At</div>
                        <div className="text-sm">{formatDate(selectedTransaction.completedAt)}</div>
                      </div>
                    )}
                    {selectedTransaction.walletAddress && (
                      <div className="col-span-2">
                        <div className="text-sm font-medium text-gray-500">Wallet Address</div>
                        <div className="break-all font-mono text-xs">{selectedTransaction.walletAddress}</div>
                      </div>
                    )}
                    {selectedTransaction.txHash && (
                      <div className="col-span-2">
                        <div className="text-sm font-medium text-gray-500">Transaction Hash</div>
                        <div className="break-all font-mono text-xs">{selectedTransaction.txHash}</div>
                      </div>
                    )}
                  </div>

                  {updateError && (
                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-500">
                      <div className="flex items-center">
                        <AlertCircle className="mr-2 h-4 w-4" />
                        {updateError}
                      </div>
                    </div>
                  )}

                  {selectedTransaction.status === "pending" && (
                    <div className="flex space-x-2">
                      <Button
                        className="flex-1 bg-green-500 hover:bg-green-600"
                        onClick={() => handleUpdateStatus(selectedTransaction.id, "completed")}
                        disabled={isUpdating}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        className="flex-1 bg-red-500 hover:bg-red-600"
                        onClick={() => handleUpdateStatus(selectedTransaction.id, "failed")}
                        disabled={isUpdating}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setSelectedTransaction(null)}
                    disabled={isUpdating}
                  >
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
