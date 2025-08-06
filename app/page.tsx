"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useWebApp } from "@/hooks/use-web-app"
import UserInterface from "@/components/user-interface"
import LoginScreen from "@/components/login-screen"
import type { UserData } from "@/lib/types"
import PWAInstallPrompt from "@/components/pwa-install-prompt"
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'

export default function TicTacToeBet() {
  const { isTelegramAvailable } = useWebApp()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = useSupabaseClient()
  const user = useUser()

  // Проверяем активную сессию при загрузке
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Получаем текущую сессию Supabase
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (session && session.user) {
          // Получаем профиль пользователя из БД
          const { data: userProfile, error: profileError } = await supabase
            .from("users")
            .select("*")
            .eq("id", session.user.id)
            .single()

          if (userProfile && !profileError) {
            const userDataObj = {
              id: userProfile.id,
              username: userProfile.username,
              password: "",
              balance: userProfile.balance,
              avatar: userProfile.avatar,
              gamesPlayed: userProfile.games_played,
              gamesWon: userProfile.games_won,
              walletAddress: userProfile.wallet_address || undefined,
              isAdmin: userProfile.is_admin,
              status: userProfile.status,
              createdAt: userProfile.created_at,
              lastLogin: userProfile.last_login,
              totalWinnings: userProfile.total_winnings || 0,
            }
            
            setUserData(userDataObj)
          }
        }
      } catch (error) {
        console.error("Failed to check session:", error)
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [supabase.auth, router])

  const handleUserLogin = (newUserData: UserData) => {
    setUserData(newUserData)
  }

  const handleAdminRequest = () => {
    if (userData?.isAdmin) {
      localStorage.setItem("isInAdminPanel", "true")
      router.push("/admin")
    }
  }

  const handleMainSiteRequest = () => {
    localStorage.removeItem("isInAdminPanel")
    router.push("/")
  }

  // Track admin navigation state - client-side only
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Set admin flag when entering admin panel
      if (window.location.pathname.startsWith("/admin")) {
        localStorage.setItem("isInAdminPanel", "true")
      } else {
        localStorage.removeItem("isInAdminPanel")
      }
    }
  }, [])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error("Failed to logout:", error)
    }
    
    setUserData(null)
    router.push("/") // Redirect to home on logout
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-800">Loading...</p>
      </div>
    )
  }

  return (
    <>
      {!userData ? (
        <LoginScreen onLogin={handleUserLogin} telegramAuthAvailable={isTelegramAvailable} />
      ) : (
        <UserInterface
          userData={userData}
          setUserData={setUserData}
          onLogout={handleLogout}
          onAdminRequest={handleAdminRequest}
          onMainSiteRequest={handleMainSiteRequest}
        />
      )}
      <PWAInstallPrompt />
    </>
  )
}
