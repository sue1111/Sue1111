"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Save, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface AdminSettingsProps {
  adminId: string
}

interface SystemSettings {
  minBet: number
  maxBet: number
  minWithdrawal: number
  maintenanceMode: boolean
  depositWalletAddress: string
  depositFee: number
  // New fields
  botWinPercentage: number
  maxWinsPerUser: number
}

interface GameSettings {
  botWinProbability: number
}

export default function AdminSettings({ adminId }: AdminSettingsProps) {
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null)
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingSystem, setIsSavingSystem] = useState(false)
  const [isSavingGame, setIsSavingGame] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Fetch system settings
      const systemResponse = await fetch("/api/settings?type=system", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      })

      if (systemResponse.ok) {
        const systemData = await systemResponse.json()
        setSystemSettings(systemData)
      } else {
        const errorData = await systemResponse.json()
        console.error("Failed to fetch system settings:", errorData)
        setError("Failed to fetch system settings. Please try again.")
      }

      // Fetch game settings
      const gameResponse = await fetch("/api/settings?type=game", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      })

      if (gameResponse.ok) {
        const gameData = await gameResponse.json()
        setGameSettings(gameData)
      } else {
        const errorData = await gameResponse.json()
        console.error("Failed to fetch game settings:", errorData)
        setError("Failed to fetch game settings. Please try again.")
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
      setError("An error occurred while fetching settings. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const saveSystemSettings = async () => {
    if (!systemSettings) return

    setIsSavingSystem(true)
    setError(null)
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "system",
          ...systemSettings,
        }),
      })

      const responseData = await response.json()

      if (response.ok) {
        const updatedSettings = responseData
        setSystemSettings(updatedSettings)
        toast({
          title: "Системные настройки сохранены",
          description: "Системные настройки были успешно обновлены.",
          variant: "default",
        })
      } else {
        console.error("Failed to save system settings:", responseData)
        const errorMessage = responseData.error || "Неизвестная ошибка при сохранении настроек"
        setError(errorMessage)
        toast({
          title: "Ошибка сохранения настроек",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving system settings:", error)
      const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
      setError(errorMessage)
      toast({
        title: "Ошибка сохранения настроек",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSavingSystem(false)
    }
  }

  const saveGameSettings = async () => {
    if (!gameSettings) return

    setIsSavingGame(true)
    setError(null)
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "game",
          ...gameSettings,
        }),
      })

      const responseData = await response.json()

      if (response.ok) {
        const updatedSettings = responseData
        setGameSettings(updatedSettings)
        toast({
          title: "Настройки игры сохранены",
          description: "Настройки игры были успешно обновлены.",
          variant: "default",
        })
      } else {
        console.error("Failed to save game settings:", responseData)
        const errorMessage = responseData.error || "Неизвестная ошибка при сохранении настроек"
        setError(errorMessage)
        toast({
          title: "Ошибка сохранения настроек",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving game settings:", error)
      const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
      setError(errorMessage)
      toast({
        title: "Ошибка сохранения настроек",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSavingGame(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue="system" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="system">System Settings</TabsTrigger>
          <TabsTrigger value="game">Game Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>Configure bet limits and other system settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {systemSettings && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="minBet">Minimum Bet ($)</Label>
                    <Input
                      id="minBet"
                      type="number"
                      min="0"
                      value={systemSettings.minBet}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          minBet: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxBet">Maximum Bet ($)</Label>
                    <Input
                      id="maxBet"
                      type="number"
                      min="0"
                      value={systemSettings.maxBet}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          maxBet: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minWithdrawal">Minimum Withdrawal ($)</Label>
                    <Input
                      id="minWithdrawal"
                      type="number"
                      min="0"
                      value={systemSettings.minWithdrawal}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          minWithdrawal: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="depositWalletAddress">Deposit Wallet Address</Label>
                    <Input
                      id="depositWalletAddress"
                      value={systemSettings.depositWalletAddress}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          depositWalletAddress: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="depositFee">Deposit Fee (%)</Label>
                    <Input
                      id="depositFee"
                      type="number"
                      min="0"
                      max="50"
                      value={systemSettings.depositFee}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          depositFee: Number(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentage fee taken from deposits (users receive 100% - fee%)
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="maintenanceMode"
                      checked={systemSettings.maintenanceMode}
                      onCheckedChange={(checked) =>
                        setSystemSettings({
                          ...systemSettings,
                          maintenanceMode: checked,
                        })
                      }
                    />
                    <Label htmlFor="maintenanceMode">Maintenance Mode</Label>
                  </div>

                  {/* New fields */}
                  <div className="space-y-2">
                    <Label htmlFor="botWinPercentage">Bot Win Percentage (%)</Label>
                    <Input
                      id="botWinPercentage"
                      type="number"
                      min="0"
                      max="100"
                      value={systemSettings.botWinPercentage}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          botWinPercentage: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxWinsPerUser">Maximum Wins Per User</Label>
                    <Input
                      id="maxWinsPerUser"
                      type="number"
                      min="0"
                      value={systemSettings.maxWinsPerUser}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          maxWinsPerUser: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <Button className="w-full mt-4" onClick={saveSystemSettings} disabled={isSavingSystem}>
                    {isSavingSystem ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save System Settings
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="game">
          <Card>
            <CardHeader>
              <CardTitle>Game Settings</CardTitle>
              <CardDescription>Configure game-specific settings and parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {gameSettings && (
                <>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between">
                        <Label htmlFor="botWinProbability">Bot Win Probability</Label>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(gameSettings.botWinProbability * 100)}%
                        </span>
                      </div>
                      <Slider
                        id="botWinProbability"
                        min={0}
                        max={1}
                        step={0.01}
                        value={[gameSettings.botWinProbability]}
                        onValueChange={(value) =>
                          setGameSettings({
                            ...gameSettings,
                            botWinProbability: value[0],
                          })
                        }
                        className="mt-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Easy</span>
                        <span>Hard</span>
                      </div>
                    </div>
                  </div>
                  <Button className="w-full mt-8" onClick={saveGameSettings} disabled={isSavingGame}>
                    {isSavingGame ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Game Settings
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <div className="flex justify-end">
        <Button variant="outline" onClick={fetchSettings}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Settings
        </Button>
      </div>
    </div>
  )
}
