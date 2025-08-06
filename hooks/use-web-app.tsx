"use client"

import { useEffect, useState } from "react"

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    query_id: string
    user: TelegramUser
    auth_date: string
    hash: string
  }
  colorScheme: "light" | "dark"
  viewportHeight: number
  viewportStableHeight: number
  isExpanded: boolean
  MainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    isProgressVisible: boolean
    setText: (text: string) => void
    onClick: (callback: () => void) => void
    show: () => void
    hide: () => void
    enable: () => void
    disable: () => void
    showProgress: (leaveActive: boolean) => void
    hideProgress: () => void
  }
  BackButton: {
    isVisible: boolean
    onClick: (callback: () => void) => void
    show: () => void
    hide: () => void
  }
  ready: () => void
  expand: () => void
  close: () => void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}

export function useWebApp() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null)
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [isTelegramAvailable, setIsTelegramAvailable] = useState(false)

  useEffect(() => {
    // Проверяем доступность Telegram WebApp
    if (window.Telegram?.WebApp) {
      const tgWebApp = window.Telegram.WebApp
      setWebApp(tgWebApp)
      setIsTelegramAvailable(true)

      // Получаем данные пользователя, если они доступны
      if (tgWebApp.initDataUnsafe?.user) {
        setUser(tgWebApp.initDataUnsafe.user)
      }

      // Сообщаем Telegram WebApp, что мы готовы
      tgWebApp.ready()
    }
  }, [])

  return { webApp, user, isTelegramAvailable }
}
