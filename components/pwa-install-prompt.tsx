"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download, X } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export default function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const { isMobile, isIOS, isStandalone } = useMobile()

  useEffect(() => {
    // Только для мобильных устройств, которые не в режиме standalone
    if (!isMobile || isStandalone) return

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    // Проверяем, не iOS ли это устройство (для которого нет события beforeinstallprompt)
    if (isIOS && !isStandalone) {
      // Показываем инструкцию для iOS через 3 секунды после загрузки
      const timer = setTimeout(() => {
        setShowPrompt(true)
      }, 3000)

      return () => clearTimeout(timer)
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }
  }, [isMobile, isIOS, isStandalone])

  const handleInstall = async () => {
    if (!installPrompt) return

    await installPrompt.prompt()
    const choiceResult = await installPrompt.userChoice

    if (choiceResult.outcome === "accepted") {
      console.log("User accepted the install prompt")
    } else {
      console.log("User dismissed the install prompt")
    }

    setInstallPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 px-4 py-2 animate-slide-up">
      <Card className="border-0 apple-shadow p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">Установите приложение</h3>
            {isIOS ? (
              <p className="mt-1 text-sm text-gray-500">
                Нажмите{" "}
                <span className="inline-block">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M12 5V19M5 12H19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>{" "}
                и выберите "На экран «Домой»"
              </p>
            ) : (
              <p className="mt-1 text-sm text-gray-500">Установите приложение для быстрого доступа</p>
            )}
          </div>

          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!isIOS && (
          <Button className="mt-3 w-full apple-button" onClick={handleInstall}>
            <Download className="mr-2 h-4 w-4" />
            Установить
          </Button>
        )}
      </Card>
    </div>
  )
}
