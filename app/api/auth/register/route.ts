import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Создаем клиент с service role для обхода RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Проверяем, существует ли пользователь
    const { data: existingUser, error: findError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('username', username)
      .single()

    if (findError && findError.code !== 'PGRST116') {
      // PGRST116 = no rows found, это нормально
      throw findError
    }

    if (existingUser) {
      // Пользователь существует - проверяем пароль
      if (existingUser.password && existingUser.password !== password) {
        return NextResponse.json(
          { error: 'Invalid username or password' },
          { status: 401 }
        )
      }

      // Обновляем время последнего входа
      await supabaseAdmin
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', existingUser.id)

      return NextResponse.json({
        success: true,
        user: {
          id: existingUser.id,
          username: existingUser.username,
          balance: existingUser.balance || 0,
          avatar: existingUser.avatar,
          gamesPlayed: existingUser.games_played || 0,
          gamesWon: existingUser.games_won || 0,
          walletAddress: existingUser.wallet_address,
          isAdmin: existingUser.is_admin || false,
          status: existingUser.status || 'active',
          createdAt: existingUser.created_at,
          lastLogin: new Date().toISOString(),
          totalWinnings: existingUser.total_winnings || 0,
        }
      })
    } else {
      // Регистрируем нового пользователя
      const newUser = {
        username,
        password, // В реальном приложении нужно хешировать
        avatar: null,
        balance: 0,
        games_played: 0,
        games_won: 0,
        wallet_address: null,
        is_admin: false,
        status: 'active',
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        total_winnings: 0,
      }

      const { data: createdUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert(newUser)
        .select()
        .single()

      if (createError) {
        if (createError.message.includes('duplicate') || createError.message.includes('unique')) {
          return NextResponse.json(
            { error: 'Username already exists' },
            { status: 409 }
          )
        }
        throw createError
      }

      return NextResponse.json({
        success: true,
        user: {
          id: createdUser.id,
          username: createdUser.username,
          balance: 0,
          avatar: null,
          gamesPlayed: 0,
          gamesWon: 0,
          walletAddress: undefined,
          isAdmin: false,
          status: 'active',
          createdAt: createdUser.created_at,
          lastLogin: createdUser.last_login,
          totalWinnings: 0,
        }
      })
    }
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 