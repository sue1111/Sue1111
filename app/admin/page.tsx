"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import AdminDashboard from "@/components/admin/admin-dashboard"
import { getSupabaseClient } from "@/lib/supabase"

export default function AdminPage() {
  const [userData, setUserData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function fetchUserData() {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      console.log("🔍 Admin check - Session:", session)
      
      if (!session) {
        console.log("❌ No session, redirecting to login")
        router.push("/login")
        return
      }
      
      const { data: user, error } = await supabase.from("users").select("*").eq("id", session.user.id).single()
      
      console.log("🔍 Admin check - User data:", user)
      console.log("🔍 Admin check - User is_admin:", user?.is_admin)
      
      if (error || !user) {
        console.log("❌ User not found or error:", error)
        router.push("/login")
        return
      }
      
      if (!user.is_admin) {
        console.log("❌ User is not admin, redirecting to home")
        router.push("/")
        return
      }
      
      console.log("✅ User is admin, showing admin panel")
      // Пользователь админ - показываем админку
      setIsAdmin(true)
      setUserData({
        id: user.id,
        username: user.username,
        isAdmin: user.is_admin,
        balance: user.balance,
        avatar: user.avatar,
        gamesPlayed: user.games_played,
        gamesWon: user.games_won,
        walletAddress: user.wallet_address,
        status: user.status,
        createdAt: user.created_at,
        lastLogin: user.last_login,
      })
      setIsLoading(false)
    }
    fetchUserData()
  }, [router])

  const handleLogout = async () => {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Загрузка админ-панели...</h2>
          <p className="text-gray-500">Пожалуйста, подождите</p>
        </div>
      </div>
    )
  }

  // Если пользователь не админ, показываем сообщение
  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Доступ запрещен</h2>
          <p className="text-gray-500">У вас нет прав для доступа к админ-панели</p>
        </div>
      </div>
    )
  }

  return userData ? <AdminDashboard userData={userData} onLogout={handleLogout} /> : null
}
