"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, CheckCircle, XCircle } from "lucide-react"
import { formatDate, formatCurrency } from "@/lib/utils/format"

interface AdminNotificationsProps {
  adminId: string
}

interface Notification {
  id: string
  type: string
  userId: string
  username: string
  amount?: number
  status: string
  message: string
  createdAt: string
}

export default function AdminNotifications({ adminId }: AdminNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("pending")

  const fetchNotifications = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/admin/notifications?adminId=${adminId}&type=${typeFilter}&status=${statusFilter}`,
      )
      if (response.ok) {
        const data = await response.json()
        setNotifications(data)
      } else {
        console.error("Failed to fetch notifications")
      }
    } catch (error) {
      console.error("Error fetching notifications:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [adminId, typeFilter, statusFilter])

  const updateNotificationStatus = async (notificationId: string, status: string) => {
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminId,
          notificationId,
          status,
        }),
      })

      if (response.ok) {
        // Update local state
        setNotifications(
          notifications.map((notification) =>
            notification.id === notificationId ? { ...notification, status } : notification,
          ),
        )
      } else {
        console.error("Failed to update notification status")
      }
    } catch (error) {
      console.error("Error updating notification status:", error)
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "deposit_request":
        return <Badge className="bg-green-500">Deposit Request</Badge>
      case "withdrawal_request":
        return <Badge className="bg-orange-500">Withdrawal Request</Badge>
      case "system":
        return <Badge className="bg-blue-500">System</Badge>
      default:
        return <Badge>{type}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-500">
            Pending
          </Badge>
        )
      case "approved":
        return (
          <Badge variant="outline" className="border-green-500 text-green-500">
            Approved
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="outline" className="border-red-500 text-red-500">
            Rejected
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-4">
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="deposit_request">Deposit Requests</SelectItem>
              <SelectItem value="withdrawal_request">Withdrawal Requests</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={fetchNotifications} size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading notifications...
                </TableCell>
              </TableRow>
            ) : notifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  No notifications found
                </TableCell>
              </TableRow>
            ) : (
              notifications.map((notification) => (
                <TableRow key={notification.id}>
                  <TableCell className="font-medium">{notification.username}</TableCell>
                  <TableCell>{getTypeBadge(notification.type)}</TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate">
                      {notification.message}
                      {notification.amount && (
                        <span className="font-semibold ml-1">({formatCurrency(notification.amount)})</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{formatDate(notification.createdAt)}</TableCell>
                  <TableCell>{getStatusBadge(notification.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {notification.status === "pending" && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateNotificationStatus(notification.id, "approved")}
                            title="Approve Request"
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateNotificationStatus(notification.id, "rejected")}
                            title="Reject Request"
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
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
