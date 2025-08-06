"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Settings, GamepadIcon as GameController, Trophy } from "lucide-react"

interface GameSettings {
  difficultyLevel: string
  maxWinsPerUser: number
}

interface AdminGameSettingsProps {
  adminId?: string
}

export default function AdminGameSettings({ adminId }: AdminGameSettingsProps) {
  const [settings, setSettings] = useState<GameSettings>({
    difficultyLevel: "medium",
    maxWinsPerUser: 3,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true)
      try {
        // Check if adminId exists before making the API call
        if (adminId) {
          const response = await fetch(`/api/settings?type=game&adminId=${adminId}`)
          if (!response.ok) {
            throw new Error("Failed to fetch game settings")
          }
          const data = await response.json()
          // Make sure we have valid settings data before updating state
          if (data && data.settings) {
            setSettings(data.settings)
          } else {
            console.warn("Received invalid settings data:", data)
            // Keep using default settings
          }
        } else {
          console.warn("Admin ID is missing, using default settings")
        }
      } catch (error) {
        console.error("Error fetching game settings:", error)
        toast({
          title: "Error",
          description: "Failed to load game settings. Using default values.",
          variant: "destructive",
        })
        // We'll continue using the default settings
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [adminId])

  const handleSaveSettings = async () => {
    if (!adminId) {
      console.error("Admin ID is required to save game settings")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminId,
          settings,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save game settings")
      }

      toast({
        title: "Settings saved",
        description: "Game settings have been updated successfully.",
      })
    } catch (error) {
      console.error("Error saving game settings:", error)
      toast({
        title: "Error",
        description: "Failed to save game settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    )
  }

  // Make sure settings is never undefined when rendering
  const safeSettings = settings || {
    difficultyLevel: "medium",
    maxWinsPerUser: 3,
  }

  // Calculate difficulty level text based on percentage
  const getDifficultyText = (percentage: number) => {
    if (percentage < 25) return "Очень легко"
    if (percentage < 50) return "Легко"
    if (percentage < 75) return "Средне"
    if (percentage < 90) return "Сложно"
    return "Очень сложно"
  }

  const difficultyPercentage = Number.parseInt(safeSettings.difficultyLevel) || 50
  const difficultyText = getDifficultyText(difficultyPercentage)

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Game Settings</h2>
      </div>

      <Card className="overflow-hidden border-2 border-muted shadow-lg">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 border-b border-muted flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300">Game Configuration</h3>
        </div>

        <div className="p-6 space-y-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-muted shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <GameController className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <Label htmlFor="botWinPercentage" className="text-base font-medium">
                Bot Win Percentage
              </Label>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-muted-foreground">Легко</span>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{difficultyText}</span>
                <span className="text-sm font-medium text-muted-foreground">Сложно</span>
              </div>

              <div className="flex items-center space-x-4">
                <input
                  type="range"
                  id="botWinPercentage"
                  min="1"
                  max="100"
                  step="1"
                  value={difficultyPercentage}
                  onChange={(e) => setSettings({ ...settings, difficultyLevel: e.target.value })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  style={{
                    background: `linear-gradient(to right, #60a5fa ${difficultyPercentage}%, #e5e7eb ${difficultyPercentage}%)`,
                  }}
                />
                <span className="w-16 text-center font-medium px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded-md text-blue-800 dark:text-blue-200">
                  {difficultyPercentage}%
                </span>
              </div>

              <p className="text-sm text-muted-foreground">
                Процент выигрыша бота при игре против человека. Чем выше значение, тем сложнее будет игроку победить.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-muted shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <Label htmlFor="maxWinsPerUser" className="text-base font-medium">
                Maximum Wins Per User
              </Label>
            </div>

            <div className="space-y-4">
              <select
                id="maxWinsPerUser"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={safeSettings.maxWinsPerUser}
                onChange={(e) => setSettings({ ...settings, maxWinsPerUser: Number.parseInt(e.target.value) })}
              >
                <option value="1">1 win maximum</option>
                <option value="2">2 wins maximum</option>
                <option value="3">3 wins maximum</option>
                <option value="0">Unlimited wins</option>
              </select>

              <p className="text-sm text-muted-foreground">
                Максимальное количество побед для одного пользователя. Установите "Unlimited wins" для снятия
                ограничений.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <Button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {isSaving ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></span>
                  Сохранение...
                </>
              ) : (
                "Сохранить настройки"
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
