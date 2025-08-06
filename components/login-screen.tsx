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
  const [showPasswordField, setShowPasswordField] = useState(false)
  const [error, setError] = useState("")
  const [email, setEmail] = useState("")

  const supabase = useSupabaseClient()

  const handleTelegramLogin = () => {
    setIsLoading(true)
    // This is a placeholder for actual Telegram login logic
    alert("Telegram login is not implemented in this example.")
    setIsLoading(false)
  }

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setUsername(value)
    if (value.trim() !== "") {
      setShowPasswordField(true)
    } else {
      setShowPasswordField(false)
      setPassword("")
    }
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Проверяем, какой способ входа используется
      if (email && password) {
        // === SUPABASE AUTH (EMAIL) ===
        try {
          // Сначала пробуем войти
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          // Если вход успешен
          if (!signInError && signInData) {
            // Получаем профиль пользователя
            const { data: userProfile, error: userProfileError } = await supabase
              .from("users")
              .select("*")
              .eq("email", email)
              .single()

            if (userProfileError || !userProfile) {
              // Если профиль не найден — создаём его
              const userId = signInData.user?.id
              const { data: createdProfile, error: createProfileError } = await supabase
                .from("users")
                .insert({
                  id: userId,
                  username: username || email.split("@")[0],
                  email,
                  avatar: null,
                  balance: 0,
                  games_played: 0,
                  games_won: 0,
                  wallet_address: null,
                  is_admin: false,
                  status: "active",
                  created_at: new Date().toISOString(),
                  last_login: new Date().toISOString(),
                })
                .select()
                .single()

              if (createProfileError || !createdProfile) {
                throw new Error(createProfileError?.message || "Failed to create user profile")
              }

              onLogin({
                id: createdProfile.id,
                username: createdProfile.username,
                password: "",
                balance: createdProfile.balance,
                avatar: createdProfile.avatar,
                gamesPlayed: createdProfile.games_played,
                gamesWon: createdProfile.games_won,
                walletAddress: createdProfile.wallet_address || undefined,
                isAdmin: createdProfile.is_admin,
                status: createdProfile.status,
                createdAt: createdProfile.created_at,
                lastLogin: createdProfile.last_login,
                totalWinnings: createdProfile.total_winnings || 0,
              })
              return
            }

            // Если профиль найден, логиним пользователя
            onLogin({
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
            })
            return
          }

          // Если ошибка входа, пробуем зарегистрировать
          if (signInError) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email,
              password,
            })

            if (signUpError) {
              // Если пользователь уже существует, пробуем войти еще раз
              if (
                signUpError.message.includes("User already registered") ||
                signUpError.message.includes("User already exists") ||
                signUpError.message.includes("User already in use")
              ) {
                // Пробуем войти еще раз
                const { data: retrySignIn, error: retryError } = await supabase.auth.signInWithPassword({
                  email,
                  password,
                })

                if (retryError) {
                  throw new Error("Invalid email or password")
                }

                // Получаем профиль пользователя
                const { data: userProfile, error: userProfileError } = await supabase
                  .from("users")
                  .select("*")
                  .eq("email", email)
                  .single()

                if (userProfileError || !userProfile) {
                  throw new Error("Failed to fetch user profile")
                }

                onLogin({
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
                })
                return
              } else {
                throw signUpError
              }
            }

            // Успешная регистрация, создаем профиль
            if (signUpData && signUpData.user) {
              const { data: userProfile, error: userProfileError } = await supabase
                .from("users")
                .insert({
                  id: signUpData.user.id,
                  username: username || email.split("@")[0],
                  email,
                  avatar: null,
                  balance: 0,
                  games_played: 0,
                  games_won: 0,
                  wallet_address: null,
                  is_admin: false,
                  status: "active",
                  created_at: new Date().toISOString(),
                  last_login: new Date().toISOString(),
                })
                .select()
                .single()

              if (userProfileError) {
                throw userProfileError
              }

              onLogin({
                id: signUpData.user.id,
                username: username || email.split("@")[0],
                password: "",
                balance: 0,
                avatar: null,
                gamesPlayed: 0,
                gamesWon: 0,
                walletAddress: undefined,
                isAdmin: false,
                status: "active",
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                totalWinnings: 0,
              })
              return
            }
          }

          // Если дошли до сюда, значит была другая ошибка
          throw signInError || new Error("Unknown authentication error")
        } catch (authError) {
          console.error("Authentication error:", authError)
          throw authError
        }
      } else {
        throw new Error("Please enter email and password.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                className="mt-1"
                placeholder="Enter your email"
                disabled={isLoading}
                required
              />
            </div>
            <div className="mb-4">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
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
                onChange={handlePasswordChange}
                className="mt-1"
                placeholder="Enter password"
                required
              />
            </div>
            {error && <div className="mb-4 p-2 text-sm text-red-600 bg-red-50 rounded border-red-200">{error}</div>}
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={isLoading || (!username && !email) || !password}
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
