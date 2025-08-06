"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { formatDate } from "@/lib/utils/format"

interface AdminRecentUsersProps {
  adminId: string
}

interface User {
  id: string
  username: string
  avatar: string | null
  status: string
  createdAt: string
  lastLogin?: string
}

export default function AdminRecentUsers({ adminId }: AdminRecentUsersProps) {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchRecentUsers = async () => {
    if (!adminId) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/users/recent?adminId=${adminId}&limit=5`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      } else {
        console.error("Failed to fetch recent users")
      }
    } catch (error) {
      console.error("Error fetching recent users:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRecentUsers()
    // Auto-refresh every 30 seconds
    const intervalId = setInterval(fetchRecentUsers, 30000)
    return () => clearInterval(intervalId)
  }, [adminId])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Активен</Badge>
      case "banned":
        return <Badge className="bg-red-500">Заблокирован</Badge>
      case "pending":
        return <Badge className="bg-yellow-500">Ожидает</Badge>
      default:
        return <Badge className="bg-gray-500">{status}</Badge>
    }
  }

  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase()
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Недавние пользователи</CardTitle>
          <Button size="sm" variant="outline" onClick={fetchRecentUsers} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-2">
        {isLoading ? (
          <div className="flex h-[200px] items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-gray-500">Пользователи не найдены</div>
        ) : (
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.avatar || undefined} />
                    <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{user.username}</p>
                    <p className="text-xs text-gray-500">Создан: {formatDate(user.createdAt)}</p>
                  </div>
                </div>
                <div>{getStatusBadge(user.status)}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
