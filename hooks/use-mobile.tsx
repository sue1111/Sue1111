"use client"

import { useState, useEffect } from "react"

export function useMobile() {
  const [isMobile, setIsMobile] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Определяем мобильное устройство
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
      setIsMobile(mobileRegex.test(userAgent))

      // Проверяем iOS
      const iosRegex = /iPhone|iPad|iPod/i
      setIsIOS(iosRegex.test(userAgent))

      // Проверяем режим standalone (PWA)
      setIsStandalone(
        window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true,
      )
    }

    checkMobile()

    // Добавляем слушатель изменения размера окна
    const handleResize = () => {
      checkMobile()
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return { isMobile, isIOS, isStandalone }
}
