"use client"

import LoginScreen from "@/components/login-screen"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()

  // Обработка успешного логина
  const handleLogin = (userData: any) => {
    // Можно сохранить userData в localStorage, если нужно
    if (userData.isAdmin) {
      router.push("/admin")
    } else {
      router.push("/")
    }
  }

  return <LoginScreen onLogin={handleLogin} telegramAuthAvailable={false} />
}
