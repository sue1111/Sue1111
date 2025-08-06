"use client"

import { useState, useEffect } from "react"
import { Search, Filter, MoreHorizontal, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Transaction } from "@/lib/types"

interface AdminTransactionsProps {
  adminId?: string
}

export default function AdminTransactions({ adminId }: AdminTransactionsProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Fetch transactions from the database
  const fetchTransactions = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Если adminId не передан, пытаемся получить через session
      let finalAdminId = adminId
      if (!finalAdminId) {
        const sessionResponse = await fetch("/api/admin/session")
        if (!sessionResponse.ok) {
          setError("Admin authentication required")
          return
        }
        const sessionData = await sessionResponse.json()
        finalAdminId = sessionData.adminId
      }

      if (!finalAdminId) {
        setError("Admin authentication required")
        return
      }

      // Construct the API URL with query parameters
      const url = new URL("/api/admin/transactions", window.location.origin)
      url.searchParams.append("adminId", finalAdminId)
      url.searchParams.append("page", currentPage.toString())

      if (typeFilter !== "all") {
        url.searchParams.append("type", typeFilter)
      }

      if (statusFilter !== "all") {
        url.searchParams.append("status", statusFilter)
      }

      if (searchQuery) {
        url.searchParams.append("search", searchQuery)
      }

      const response = await fetch(url.toString(), {
        headers: {
          "Cache-Control": "no-cache",
        },
      })

      if (!response.ok) {
        throw new Error(`Error fetching transactions: ${response.status}`)
      }

      const data = await response.json()
      setTransactions(data.transactions)
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      console.error("Failed to fetch transactions:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch transactions")
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch transactions on component mount and when filters change
  useEffect(() => {
    fetchTransactions()

    // Set up auto-refresh interval
    const intervalId = setInterval(fetchTransactions, 30000) // Refresh every 30 seconds

    return () => clearInterval(intervalId)
  }, [typeFilter, statusFilter, searchQuery, currentPage, adminId])

  const handleViewDetails = (tx: Transaction) => {
    setSelectedTransaction(tx)
    setShowDetailsDialog(true)
  }

  const handleApproveTransaction = async (tx: Transaction) => {
    if (confirm(`Are you sure you want to approve this ${tx.type} of ${tx.amount} ${tx.currency}?`)) {
      try {
        // Проверяем сессию админа
        const sessionResponse = await fetch("/api/admin/session")
        if (!sessionResponse.ok) {
          alert("Admin authentication required")
          return
        }
        const sessionData = await sessionResponse.json()
        const adminId = sessionData.adminId

        const response = await fetch("/api/admin/transactions", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            adminId,
            transactionId: tx.id,
            status: "completed",
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to approve transaction")
        }

        alert(`Transaction ${tx.id} approved successfully`)
        fetchTransactions() // Refresh the list

        if (showDetailsDialog) {
          setShowDetailsDialog(false)
        }
      } catch (err) {
        console.error("Error approving transaction:", err)
        alert(err instanceof Error ? err.message : "Failed to approve transaction")
      }
    }
  }

  const handleRejectTransaction = async (tx: Transaction) => {
    if (confirm(`Are you sure you want to reject this ${tx.type} of ${tx.amount} ${tx.currency}?`)) {
      try {
        // Проверяем сессию админа
        const sessionResponse = await fetch("/api/admin/session")
        if (!sessionResponse.ok) {
          alert("Admin authentication required")
          return
        }
        const sessionData = await sessionResponse.json()
        const adminId = sessionData.adminId

        const response = await fetch("/api/admin/transactions", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            adminId,
            transactionId: tx.id,
            status: "failed",
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to reject transaction")
        }

        alert(`Transaction ${tx.id} rejected successfully`)
        fetchTransactions() // Refresh the list

        if (showDetailsDialog) {
          setShowDetailsDialog(false)
        }
      } catch (err) {
        console.error("Error rejecting transaction:", err)
        alert(err instanceof Error ? err.message : "Failed to reject transaction")
      }
    }
  }

  return (
    <div>
      <Card className="border-0 apple-shadow">
        <div className="p-4">
          <div className="mb-4 flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <h2 className="text-xl font-bold text-gray-900">Transaction Management</h2>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="apple-input"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  <SelectItem value="bet">Bet</SelectItem>
                  <SelectItem value="win">Win</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={fetchTransactions} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </div>

          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-gray-900"></div>
            </div>
          )}

          {error && <div className="rounded-md bg-red-50 p-4 text-center text-red-800">{error}</div>}

          {!isLoading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">ID</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">User</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Type</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Status</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Date</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-900">{tx.id}</td>
                      <td className="px-4 py-3 text-gray-900">{tx.username || tx.userId}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            tx.type === "deposit"
                              ? "bg-green-100 text-green-800"
                              : tx.type === "withdrawal"
                                ? "bg-blue-100 text-blue-800"
                                : tx.type === "bet"
                                  ? "bg-amber-100 text-amber-800"
                                  : tx.type === "win"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {tx.type === "deposit" || tx.type === "win" ? "+" : "-"}
                        {tx.amount} {tx.currency}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            tx.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : tx.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end space-x-1">
                          {tx.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                                onClick={() => handleApproveTransaction(tx)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => handleRejectTransaction(tx)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(tx)}>View Details</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && !error && transactions.length === 0 && (
            <div className="py-8 text-center text-gray-500">No transactions found matching your criteria</div>
          )}

          {/* Pagination */}
          {!isLoading && !error && totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Transaction Details Dialog */}
      {selectedTransaction && (
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
              <DialogDescription>Complete information about this transaction</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-sm font-medium text-gray-500">ID</div>
                <div className="col-span-2 font-mono text-xs text-gray-900">{selectedTransaction.id}</div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-sm font-medium text-gray-500">User ID</div>
                <div className="col-span-2 text-gray-900">{selectedTransaction.userId}</div>
              </div>
              {selectedTransaction.username && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-sm font-medium text-gray-500">Username</div>
                  <div className="col-span-2 text-gray-900">{selectedTransaction.username}</div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-sm font-medium text-gray-500">Type</div>
                <div className="col-span-2 text-gray-900">{selectedTransaction.type}</div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-sm font-medium text-gray-500">Amount</div>
                <div className="col-span-2 text-gray-900">
                  {selectedTransaction.amount} {selectedTransaction.currency}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-sm font-medium text-gray-500">Status</div>
                <div className="col-span-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      selectedTransaction.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : selectedTransaction.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {selectedTransaction.status}
                  </span>
                </div>
              </div>
              {selectedTransaction.walletAddress && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-sm font-medium text-gray-500">Wallet</div>
                  <div className="col-span-2 font-mono text-xs text-gray-900 break-all">
                    {selectedTransaction.walletAddress}
                  </div>
                </div>
              )}
              {selectedTransaction.txHash && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-sm font-medium text-gray-500">TX Hash</div>
                  <div className="col-span-2 font-mono text-xs text-gray-900 break-all">
                    {selectedTransaction.txHash}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-sm font-medium text-gray-500">Created</div>
                <div className="col-span-2 text-gray-900">
                  {new Date(selectedTransaction.createdAt).toLocaleString()}
                </div>
              </div>
              {selectedTransaction.completedAt && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-sm font-medium text-gray-500">Completed</div>
                  <div className="col-span-2 text-gray-900">
                    {new Date(selectedTransaction.completedAt).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowDetailsDialog(false)}>Close</Button>
              {selectedTransaction.status === "pending" && (
                <>
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => {
                      handleRejectTransaction(selectedTransaction)
                      setShowDetailsDialog(false)
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    className="bg-green-600 text-white hover:bg-green-700"
                    onClick={() => {
                      handleApproveTransaction(selectedTransaction)
                      setShowDetailsDialog(false)
                    }}
                  >
                    Approve
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
