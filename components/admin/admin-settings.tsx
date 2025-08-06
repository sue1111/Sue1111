"use client"

import { useState, useEffect } from "react"
import { Save, AlertTriangle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { SystemSettings } from "@/lib/types"

export default function AdminSettings() {
  // Mock system settings
  const [settings, setSettings] = useState<SystemSettings>({
    minBet: 5,
    maxBet: 100,
    minWithdrawal: 10,
    maintenanceMode: false,
    depositWalletAddress: "TJDENsfBJs4RFETt1X1W8wMDc8M5XnJhCe",
    depositFee: 20
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setIsSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Функция для загрузки настроек с сервера
  const fetchSettings = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/settings?type=system")

      if (!response.ok) {
        throw new Error("Не удалось загрузить настройки системы")
      }

      const data = await response.json()
      setSettings(data)
    } catch (err) {
      console.error("Ошибка при загрузке настроек:", err)
      setError("Не удалось загрузить настройки. Пожалуйста, попробуйте позже.")
    } finally {
      setIsLoading(false)
    }
  }

  // Загрузка настроек при монтировании компонента
  useEffect(() => {
    fetchSettings()
  }, [])

  // Обновим функцию handleSaveSettings для лучшей обработки ошибок и добавим логирование

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true)
      setError(null)

      // Логируем данные, которые отправляем на сервер
      console.log("Отправляем настройки на сервер:", {
        type: "system",
        ...settings,
      })

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "system",
          ...settings,
        }),
      })

      // Получаем текст ответа для анализа
      const responseText = await response.text()

      // Пытаемся распарсить JSON
      let updatedSettings
      try {
        updatedSettings = JSON.parse(responseText)
      } catch (e) {
        console.error("Не удалось распарсить ответ как JSON:", responseText)
        throw new Error("Некорректный ответ от сервера")
      }

      if (!response.ok) {
        console.error("Ошибка сервера:", updatedSettings)
        throw new Error(updatedSettings.error || "Не удалось сохранить настройки")
      }

      console.log("Получены обновленные настройки:", updatedSettings)
      setSettings(updatedSettings)
      setIsSaveSuccess(true)

      // Скрыть сообщение об успехе через 3 секунды
      setTimeout(() => setIsSaveSuccess(false), 3000)
    } catch (err) {
      console.error("Ошибка при сохранении настроек:", err)
      setError(`Не удалось сохранить настройки: ${err.message || "Неизвестная ошибка"}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <Card className="border-0 apple-shadow">
        <div className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">System Settings</h2>
            <Button className="apple-button" onClick={handleSaveSettings} disabled={isSaving || isLoading}>
              {isSaving ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>

          {isLoading && (
            <div className="mb-4 rounded-lg bg-blue-50 p-3 text-blue-800">
              <div className="flex items-center">
                <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></span>
                </div>
                <span>Загрузка настроек...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-800">
              <div className="flex items-center">
                <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-100">
                  <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <span>{error}</span>
              </div>
            </div>
          )}

          {saveSuccess && (
            <div className="mb-4 rounded-lg bg-green-50 p-3 text-green-800">
              <div className="flex items-center">
                <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>Настройки успешно сохранены!</span>
              </div>
            </div>
          )}

          <Tabs defaultValue="general">
            <TabsList className="grid w-full grid-cols-4 bg-gray-100">
              <TabsTrigger value="general" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                General
              </TabsTrigger>
              <TabsTrigger value="payments" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                Payments
              </TabsTrigger>
              <TabsTrigger
                value="maintenance"
                className="data-[state=active]:bg-primary data-[state=active]:text-white"
              >
                Maintenance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="min-bet">Minimum Bet (USDT)</Label>
                  <Input
                    id="min-bet"
                    type="number"
                    value={settings.minBet}
                    onChange={(e) => setSettings({ ...settings, minBet: Number(e.target.value) })}
                    min={1}
                    className="apple-input"
                  />
                  <p className="text-xs text-gray-500">Minimum amount users can bet per game</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-bet">Maximum Bet (USDT)</Label>
                  <Input
                    id="max-bet"
                    type="number"
                    value={settings.maxBet}
                    onChange={(e) => setSettings({ ...settings, maxBet: Number(e.target.value) })}
                    min={settings.minBet}
                    className="apple-input"
                  />
                  <p className="text-xs text-gray-500">Maximum amount users can bet per game</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="payments" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deposit-wallet">Deposit Wallet Address (USDT TRC20)</Label>
                <Input
                  id="deposit-wallet"
                  value={settings.depositWalletAddress}
                  onChange={(e) => setSettings({ ...settings, depositWalletAddress: e.target.value })}
                  className="apple-input font-mono text-sm"
                />
                <p className="text-xs text-gray-500">TRC20 wallet address where users will send USDT deposits</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit-fee">Deposit Fee (%)</Label>
                <Input
                  id="deposit-fee"
                  type="number"
                  value={settings.depositFee || 20}
                  onChange={(e) => setSettings({ ...settings, depositFee: Number(e.target.value) })}
                  min={0}
                  max={50}
                  className="apple-input"
                />
                <p className="text-xs text-gray-500">Percentage fee taken from deposits (users receive 100% - fee%)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="min-withdrawal">Minimum Withdrawal (USDT)</Label>
                <Input
                  id="min-withdrawal"
                  type="number"
                  value={settings.minWithdrawal}
                  onChange={(e) => setSettings({ ...settings, minWithdrawal: Number(e.target.value) })}
                  min={1}
                  className="apple-input"
                />
                <p className="text-xs text-gray-500">Minimum amount users can withdraw</p>
              </div>
            </TabsContent>

            <TabsContent value="maintenance" className="mt-4 space-y-4">
              <Card className="border border-yellow-200 bg-yellow-50 p-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600" />
                  <div>
                    <h3 className="font-medium text-yellow-800">Maintenance Mode</h3>
                    <p className="text-sm text-yellow-700">
                      Enabling maintenance mode will prevent users from accessing the app. Only admins will be able to
                      log in.
                    </p>
                  </div>
                </div>
              </Card>
              <div className="flex items-center space-x-2">
                <Switch
                  id="maintenance-mode"
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) => setSettings({ ...settings, maintenanceMode: checked })}
                />
                <Label htmlFor="maintenance-mode">Enable Maintenance Mode</Label>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  )
}
