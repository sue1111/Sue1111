"use client"

import { useState, useEffect } from "react"
import { Search, Filter, MoreHorizontal, Ban, Edit, Wallet, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { UserData } from "@/lib/types"
import { toast } from "@/components/ui/use-toast"

export default function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showBalanceDialog, setShowBalanceDialog] = useState(false)
  const [balanceAmount, setBalanceAmount] = useState(0)
  const [balanceOperation, setBalanceOperation] = useState<"add" | "subtract">("add")
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [users, setUsers] = useState<UserData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch users from the database
  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(
        `/api/admin/users?status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`,
        {
          method: "GET",
          headers: {
            "Cache-Control": "no-cache",
          },
          credentials: "include",
        },
      )

      if (!response.ok) {
        throw new Error(`Error fetching users: ${response.status}`)
      }

      const data = await response.json()
      setUsers(data.users || [])
    } catch (err) {
      console.error("Failed to fetch users:", err)
      setError("Failed to load users. Please try again.")
      toast({
        title: "Error",
        description: "Failed to load users. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Load users when component mounts or filters change
  useEffect(() => {
    fetchUsers()

    // Set up periodic refresh
    const intervalId = setInterval(fetchUsers, 30000) // Refresh every 30 seconds

    return () => clearInterval(intervalId)
  }, [statusFilter, searchQuery])

  const handleEditUser = (user: UserData) => {
    setSelectedUser(user)
    setShowEditDialog(true)
  }

  const handleManageBalance = (user: UserData) => {
    setSelectedUser(user)
    setBalanceAmount(0)
    setBalanceOperation("add")
    setShowBalanceDialog(true)
  }

  const handleViewDetails = (user: UserData) => {
    setSelectedUser(user)
    setShowDetailsDialog(true)
  }

  const handleBanUser = async (user: UserData) => {
    if (confirm(`Are you sure you want to ${user.status === "banned" ? "unban" : "ban"} ${user.username}?`)) {
      try {
        const newStatus = user.status === "banned" ? "active" : "banned"

        const response = await fetch(`/api/admin/users/${user.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error(`Error updating user: ${response.status}`)
        }

        toast({
          title: "Success",
          description: `User ${user.status === "banned" ? "unbanned" : "banned"} successfully`,
        })

        // Refresh the users list
        fetchUsers()
      } catch (err) {
        console.error("Failed to update user status:", err)
        toast({
          title: "Error",
          description: "Failed to update user status. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  const handleSaveUserEdit = async () => {
    if (!selectedUser) return

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: selectedUser.username,
          status: selectedUser.status,
        }),
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error(`Error updating user: ${response.status}`)
      }

      toast({
        title: "Success",
        description: `User ${selectedUser.username} updated successfully`,
      })

      setShowEditDialog(false)
      fetchUsers()
    } catch (err) {
      console.error("Failed to update user:", err)
      toast({
        title: "Error",
        description: "Failed to update user. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleBalanceUpdate = async () => {
    if (!selectedUser) return

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/balance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: balanceOperation === "add" ? balanceAmount : -balanceAmount,
          type: balanceOperation === "add" ? "deposit" : "withdrawal",
          status: "completed",
        }),
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error(`Error updating balance: ${response.status}`)
      }

      toast({
        title: "Success",
        description: `${balanceOperation === "add" ? "Added" : "Subtracted"} ${balanceAmount} ${
          balanceOperation === "add" ? "to" : "from"
        } ${selectedUser.username}'s balance`,
      })

      setShowBalanceDialog(false)
      fetchUsers()
    } catch (err) {
      console.error("Failed to update balance:", err)
      toast({
        title: "Error",
        description: "Failed to update balance. Please try again.",
        variant: "destructive",
      })
    }
  }

  // We don't need to filter users here since we're doing it on the server
  const filteredUsers = users

  return (
    <div>
      <Card className="border-0 apple-shadow">
        <div className="p-4">
          <div className="mb-4 flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <h2 className="text-xl font-bold text-gray-900">User Management</h2>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="apple-input"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="banned">Banned</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : error ? (
              <div className="py-8 text-center text-red-500">{error}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">User</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Balance</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Games</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Status</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Joined</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-2">
                            <div className="font-medium text-gray-900">{user.username}</div>
                            <div className="text-xs text-gray-500">ID: {user.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">${user.balance.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{user.gamesPlayed} played</div>
                        <div className="text-xs text-gray-500">{user.gamesWon} won</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            user.status === "active"
                              ? "bg-green-100 text-green-800"
                              : user.status === "banned"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <button
                                className="flex w-full items-center px-2 py-1.5 text-sm hover:bg-gray-100"
                                onClick={() => handleViewDetails(user)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </button>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <button
                                className="flex w-full items-center px-2 py-1.5 text-sm hover:bg-gray-100"
                                onClick={() => handleEditUser(user)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit User
                              </button>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <button
                                className="flex w-full items-center px-2 py-1.5 text-sm hover:bg-gray-100"
                                onClick={() => handleManageBalance(user)}
                              >
                                <Wallet className="mr-2 h-4 w-4" />
                                Manage Balance
                              </button>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <button
                                className="flex w-full items-center px-2 py-1.5 text-sm hover:bg-gray-100"
                                onClick={() => handleBanUser(user)}
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                {user.status === "banned" ? "Unban User" : "Ban User"}
                              </button>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!isLoading && !error && filteredUsers.length === 0 && (
            <div className="py-8 text-center text-gray-500">No users found matching your criteria</div>
          )}
        </div>
      </Card>

      {/* Edit User Dialog */}
      {selectedUser && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user information for {selectedUser.username}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="username" className="text-right">
                  Username
                </Label>
                <Input
                  id="username"
                  value={selectedUser.username}
                  className="col-span-3 apple-input"
                  onChange={(e) => setSelectedUser({ ...selectedUser, username: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                <Select
                  value={selectedUser.status}
                  onValueChange={(value: any) => setSelectedUser({ ...selectedUser, status: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveUserEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Manage Balance Dialog */}
      {selectedUser && (
        <Dialog open={showBalanceDialog} onOpenChange={setShowBalanceDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Balance</DialogTitle>
              <DialogDescription>Adjust balance for {selectedUser.username}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="current-balance" className="text-right">
                  Current Balance
                </Label>
                <div className="col-span-3 font-medium text-gray-900">${selectedUser.balance.toFixed(2)}</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="operation" className="text-right">
                  Operation
                </Label>
                <Select value={balanceOperation} onValueChange={(value: any) => setBalanceOperation(value)}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select operation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add Funds</SelectItem>
                    <SelectItem value="subtract">Subtract Funds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Amount
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={balanceAmount}
                  min={0}
                  className="col-span-3 apple-input"
                  onChange={(e) => setBalanceAmount(Number(e.target.value))}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-balance" className="text-right">
                  New Balance
                </Label>
                <div className="col-span-3 font-medium text-gray-900">
                  $
                  {(balanceOperation === "add"
                    ? selectedUser.balance + balanceAmount
                    : Math.max(0, selectedUser.balance - balanceAmount)
                  ).toFixed(2)}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBalanceDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleBalanceUpdate}>Update Balance</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* User Details Dialog */}
      {selectedUser && (
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
              <DialogDescription>Complete information about {selectedUser.username}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-sm font-medium text-gray-500">ID</div>
                <div className="col-span-2 font-mono text-xs text-gray-900">{selectedUser.id}</div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-sm font-medium text-gray-500">Username</div>
                <div className="col-span-2 text-gray-900">{selectedUser.username}</div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-sm font-medium text-gray-500">Balance</div>
                <div className="col-span-2 text-gray-900">${selectedUser.balance.toFixed(2)}</div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-sm font-medium text-gray-500">Status</div>
                <div className="col-span-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      selectedUser.status === "active"
                        ? "bg-green-100 text-green-800"
                        : selectedUser.status === "banned"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {selectedUser.status}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-sm font-medium text-gray-500">Games Played</div>
                <div className="col-span-2 text-gray-900">{selectedUser.gamesPlayed}</div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-sm font-medium text-gray-500">Games Won</div>
                <div className="col-span-2 text-gray-900">{selectedUser.gamesWon}</div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-sm font-medium text-gray-500">Win Rate</div>
                <div className="col-span-2 text-gray-900">
                  {selectedUser.gamesPlayed > 0
                    ? `${((selectedUser.gamesWon / selectedUser.gamesPlayed) * 100).toFixed(1)}%`
                    : "N/A"}
                </div>
              </div>
              {selectedUser.createdAt && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-sm font-medium text-gray-500">Joined</div>
                  <div className="col-span-2 text-gray-900">{new Date(selectedUser.createdAt).toLocaleString()}</div>
                </div>
              )}
              {selectedUser.lastLogin && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-sm font-medium text-gray-500">Last Login</div>
                  <div className="col-span-2 text-gray-900">{new Date(selectedUser.lastLogin).toLocaleString()}</div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowDetailsDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
