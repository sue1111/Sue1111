"use client"

import { useState } from "react"
import { Bell, Check, X, AlertTriangle, Info, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Notification } from "@/lib/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface AdminNotificationsProps {
  adminId: string
  notifications: Notification[]
}

export default function AdminNotifications({ adminId, notifications = [] }: AdminNotificationsProps) {
  const [activeTab, setActiveTab] = useState("all")
  const [isLoading, setIsLoading] = useState(false)
  const [localNotifications, setLocalNotifications] = useState<Notification[]>(notifications)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMessage, setDialogMessage] = useState("")

  // Фильтрация уведомлений по статусу
  const allNotifications = localNotifications
  const pendingNotifications = localNotifications.filter((n) => n.status === "pending")
  const completedNotifications = localNotifications.filter((n) => n.status === "approved" || n.status === "rejected")

  // Обработка действия с уведомлением
  const handleNotificationAction = async (notificationId: string, action: "approve" | "reject") => {
    if (!adminId) {
      console.error("Admin ID is required to handle notifications")
      return
    }

    // Сохраняем текущий список для возможного отката
    const prevNotifications = localNotifications

    // Мгновенно удаляем заявку из UI (оптимистичный UI)
    setLocalNotifications((prev) =>
      prev.filter((notification) => notification.id !== notificationId)
    )

    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/notifications`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminId,
          notificationId,
          status: action === "approve" ? "approved" : "rejected",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update notification")
      }

      // Показываем диалоговое окно с результатом
      setDialogMessage(action === "approve" ? "Заявка одобрена!" : "Заявка успешно отклонена.")
      setDialogOpen(true)
    } catch (error) {
      // Если ошибка — возвращаем заявку обратно
      setLocalNotifications(prevNotifications)
      setDialogMessage("Ошибка при обновлении заявки")
      setDialogOpen(true)
      console.error("Error updating notification:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Получение иконки в зависимости от типа уведомления
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "withdrawal":
      case "deposit":
        return <DollarSign className="h-5 w-5 text-blue-500" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />
      case "system":
        return <Info className="h-5 w-5 text-gray-500" />
      default:
        return <Bell className="h-5 w-5 text-primary" />
    }
  }

  // Получение цвета фона в зависимости от типа уведомления
  const getNotificationBgColor = (type: string, status: string) => {
    if (status === "completed") return "bg-gray-50 dark:bg-gray-800/50"

    switch (type) {
      case "withdrawal":
        return "bg-amber-50 dark:bg-amber-900/20"
      case "deposit":
        return "bg-blue-50 dark:bg-blue-900/20"
      case "warning":
        return "bg-red-50 dark:bg-red-900/20"
      case "system":
        return "bg-gray-50 dark:bg-gray-800/50"
      default:
        return "bg-white dark:bg-gray-800"
    }
  }

  // Форматирование даты
  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown"

    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`

    return date.toLocaleDateString()
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Notifications</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Здесь можно добавить логику для обновления уведомлений
              console.log("Refresh notifications")
            }}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Здесь можно добавить логику для пометки всех уведомлений как прочитанных
              console.log("Mark all as read")
            }}
            disabled={isLoading || pendingNotifications.length === 0}
          >
            Mark all as read
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 grid w-full grid-cols-3">
          <TabsTrigger value="all">
            All
            <span className="ml-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs dark:bg-gray-700">
              {allNotifications.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending
            <span className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              {pendingNotifications.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed
            <span className="ml-1 rounded-full bg-green-200 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-300">
              {completedNotifications.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-0">
          {renderNotificationList(allNotifications)}
        </TabsContent>

        <TabsContent value="pending" className="mt-0">
          {renderNotificationList(pendingNotifications)}
        </TabsContent>

        <TabsContent value="completed" className="mt-0">
          {renderNotificationList(completedNotifications)}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Результат заявки</DialogTitle>
            <DialogDescription>{dialogMessage}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  )

  function renderNotificationList(notificationList: Notification[]) {
    if (isLoading) {
      return (
        <div className="flex justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        </div>
      )
    }

    if (notificationList.length === 0) {
      return (
        <Card className="flex flex-col items-center justify-center p-8 text-center">
          <Bell className="mb-2 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No notifications</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeTab === "pending"
              ? "There are no pending notifications that require your attention."
              : activeTab === "completed"
                ? "There are no completed notifications to display."
                : "You don't have any notifications yet."}
          </p>
        </Card>
      )
    }

    return (
      <div className="space-y-3">
        {notificationList.map((notification) => (
          <Card
            key={notification.id}
            className={`overflow-hidden ${getNotificationBgColor(notification.type, notification.status)}`}
          >
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm dark:bg-gray-800">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{notification.type === "deposit_request" ? "Deposit Request" : notification.type === "withdrawal_request" ? "Withdrawal Request" : "System"}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{notification.message}</p>
                    {notification.type === "withdrawal_request" && notification.amount && (
                      <div className="mt-1 font-medium text-amber-600 dark:text-amber-400">
                        Withdrawal request: ${notification.amount}
                      </div>
                    )}
                    {notification.type === "deposit_request" && notification.amount && (
                      <div className="mt-1 font-medium text-blue-600 dark:text-blue-400">
                        Deposit request: ${notification.amount}
                        <div className="text-xs text-gray-500 mt-1">
                          After 20% fee: ${(notification.amount * 0.8).toFixed(2)} will be credited
                        </div>
                      </div>
                    )}
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(notification.createdAt)}
                    </div>
                  </div>
                </div>

                {notification.status === "pending" && (
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-green-500 text-green-500 hover:bg-green-50 hover:text-green-600 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
                      onClick={() => handleNotificationAction(notification.id, "approve")}
                      disabled={isLoading}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                      onClick={() => handleNotificationAction(notification.id, "reject")}
                      disabled={isLoading}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}

                {(notification.status === "approved" || notification.status === "rejected") && (
                  <div className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {notification.status === "approved" ? "Approved" : "Rejected"}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }
}
