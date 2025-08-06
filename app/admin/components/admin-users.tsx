"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, RefreshCw, Ban, CheckCircle } from "lucide-react"
import { formatDate } from "@/lib/utils/format"

interface AdminUsersProps {
  adminId: string
}

interface User {
  id: string
  username: string
  balance: number
  avatar: string | null
  gamesPlayed: number
  gamesWon: number
  walletAddress?: string
  isAdmin: boolean
  status: string
  createdAt: string
  lastLogin?: string
}

export default function AdminUsers({ adminId }: AdminUsersProps) {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

  // Create a memoized fetchUsers function to avoid recreation on each render
  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/users?adminId=${adminId}&status=${statusFilter}&search=${searchQuery}`, {
        // Add cache control to prevent browser caching
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      })

      if (response.ok) {
        const data = await response.json()
        // Handle both formats: direct array or object with users property
        setUsers(Array.isArray(data) ? data : data.users || [])
      } else {
        console.error("Failed to fetch users")
      }
    } catch (error) {
      console.error("Error fetching users:", error)
    } finally {
      setIsLoading(false)
    }
  }, [adminId, statusFilter, searchQuery])

  // Set up auto-refresh when component mounts
  useEffect(() => {
    // Initial fetch
    fetchUsers()

    // Set up refresh interval (every 30 seconds)
    const interval = setInterval(() => {
      fetchUsers()
    }, 30000)

    setRefreshInterval(interval)

    // Clean up interval on unmount
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [fetchUsers])

  // Update interval when filters change
  useEffect(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }

    const interval = setInterval(() => {
      fetchUsers()
    }, 30000)

    setRefreshInterval(interval)

    return () => {
      clearInterval(interval)
    }
  }, [statusFilter, searchQuery, fetchUsers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUsers()
  }

  const updateUserStatus = async (userId: string, status: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      })

      if (response.ok) {
        // Update local state
        setUsers(users.map((user) => (user.id === userId ? { ...user, status } : user)))
      } else {
        console.error("Failed to update user status")
      }
    } catch (error) {
      console.error("Error updating user status:", error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>
      case "banned":
        return <Badge className="bg-red-500">Banned</Badge>
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>
      default:
        return <Badge className="bg-gray-500">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search by username or ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64"
          />
          <Button type="submit" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="banned">Banned</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={fetchUsers} size="icon" title="Refresh users list">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead className="hidden md:table-cell">Games</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {user.isAdmin && <Badge className="bg-blue-500">Admin</Badge>}
                      {user.username}
                    </div>
                  </TableCell>
                  <TableCell>${user.balance.toFixed(2)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {user.gamesPlayed} ({user.gamesWon} wins)
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{formatDate(user.createdAt)}</TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {user.status !== "active" && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateUserStatus(user.id, "active")}
                          title="Activate User"
                        >
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        </Button>
                      )}
                      {user.status !== "banned" && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateUserStatus(user.id, "banned")}
                          title="Ban User"
                        >
                          <Ban className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
