"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BellIcon as BrandTelegram } from "lucide-react"
import type { UserData } from "@/lib/types"
import { useSupabaseClient } from '@supabase/auth-helpers-react'

interface LoginScreenProps {
  onLogin: (userData: UserData) => void
  telegramAuthAvailable: boolean
}

export default function LoginScreen({ onLogin, telegramAuthAvailable }: LoginScreenProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const supabase = useSupabaseClient()

  const handleTelegramLogin = () => {
    setIsLoading(true)
    // This is a placeholder for actual Telegram login logic
    alert("Telegram login is not implemented in this example.")
    setIsLoading(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      if (!username || !password) {
        throw new Error("Please enter username and password.")
      }

      // Сначала проверяем, существует ли пользователь с таким username
      const { data: existingUser, error: findError } = await supabase
        .from("users")
        .select("*")
        .eq("username", username)
        .single()

      if (findError && findError.code !== "PGRST116") {
        // PGRST116 = no rows found, это нормально для регистрации
        throw findError
      }

      if (existingUser) {
        // Пользователь существует - пытаемся войти
        // Простая проверка пароля (в реальном приложении нужна более безопасная система)
        if (existingUser.password && existingUser.password !== password) {
          throw new Error("Invalid username or password.")
        }

        // Обновляем время последнего входа
        await supabase
          .from("users")
          .update({ last_login: new Date().toISOString() })
          .eq("id", existingUser.id)

        onLogin({
          id: existingUser.id,
          username: existingUser.username,
          password: "",
          balance: existingUser.balance || 0,
          avatar: existingUser.avatar,
          gamesPlayed: existingUser.games_played || 0,
          gamesWon: existingUser.games_won || 0,
          walletAddress: existingUser.wallet_address,
          isAdmin: existingUser.is_admin || false,
          status: existingUser.status || "active",
          createdAt: existingUser.created_at,
          lastLogin: new Date().toISOString(),
          totalWinnings: existingUser.total_winnings || 0,
        })
      } else {
        // Пользователь не существует - регистрируем нового
        const newUser = {
          id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          username,
          password: password, // В реальном приложении нужно хешировать
          email: `${username}@temp.local`, // Временный email для совместимости со схемой
          avatar: null,
          balance: 0,
          games_played: 0,
          games_won: 0,
          wallet_address: null,
          is_admin: false,
          status: "active",
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
          total_winnings: 0,
        }

        const { data: createdUser, error: createError } = await supabase
          .from("users")
          .insert(newUser)
          .select()
          .single()

        if (createError) {
          if (createError.message.includes("duplicate") || createError.message.includes("unique")) {
            throw new Error("Username already exists. Please try logging in or choose a different username.")
          }
          throw createError
        }

        onLogin({
          id: newUser.id,
          username: newUser.username,
          password: "",
          balance: 0,
          avatar: null,
          gamesPlayed: 0,
          gamesWon: 0,
          walletAddress: undefined,
          isAdmin: false,
          status: "active",
          createdAt: newUser.created_at,
          lastLogin: newUser.last_login,
          totalWinnings: 0,
        })
      }
    } catch (err) {
      console.error("Login error:", err)
      let errorMessage = "An unknown error occurred."
      
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (typeof err === 'object' && err !== null) {
        errorMessage = JSON.stringify(err)
      }
      
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100 p-4">
      <Card className="w-full max-w-md overflow-hidden border-0 shadow-xl">
        <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-center text-white">
          <h1 className="text-3xl font-bold">Tic-Tac-Toe</h1>
          <p className="mt-2 text-white/80">Login or Register to start playing</p>
        </div>

        <div className="p-6">
          {telegramAuthAvailable && (
            <div className="mb-6">
              <Button
                className="w-full bg-[#0088cc] hover:bg-[#0088cc]/90 text-white"
                onClick={handleTelegramLogin}
                disabled={isLoading}
              >
                <BrandTelegram className="mr-2 h-5 w-5" />
                {isLoading ? "Logging in..." : "Login with Telegram"}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">or</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1"
                placeholder="Enter your username"
                disabled={isLoading}
                required
              />
            </div>
            <div className="mb-4">
              <Label htmlFor="password">Password</Label>
              <Input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
                placeholder="Enter password"
                required
              />
            </div>
            {error && <div className="mb-4 p-2 text-sm text-red-600 bg-red-50 rounded border-red-200">{error}</div>}
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={isLoading || !username || !password}
            >
              {isLoading ? "Processing..." : "Login / Register"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            By proceeding, you agree to the game rules and privacy policy.
          </p>
        </div>
      </Card>
    </div>
  )
}
