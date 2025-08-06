import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('LobbyAPI')

// GET - получить список доступных игр
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') || 'waiting'
    const betMin = searchParams.get('betMin')
    const betMax = searchParams.get('betMax')
    const limit = parseInt(searchParams.get('limit') || '50')

    const directSupabase = getSupabaseServerClient()

    let query = directSupabase
      .from('games')
      .select(`
        id,
        status,
        bet_amount,
        pot,
        created_at,
        player_x,
        player_o,
        players
      `)
      .eq('status', statusFilter as any)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Фильтр по ставке
    if (betMin) {
      query = query.gte('bet_amount', parseInt(betMin))
    }
    if (betMax) {
      query = query.lte('bet_amount', parseInt(betMax))
    }

    const { data: games, error } = await query

    if (error) {
      logger.error(`Error fetching games: ${error.message}`)
      return NextResponse.json(
        { error: 'Failed to fetch games' },
        { status: 500 }
      )
    }

    // Получаем информацию о пользователях для игр
    const gamesWithPlayers = await Promise.all(
      games.map(async (game) => {
        const gameData = game as any
        
        // Получаем информацию о создателе игры
        let creator = null
        if (gameData.player_x) {
          const { data: user } = await directSupabase
            .from('users')
            .select('id, username, avatar')
            .eq('id', gameData.player_x)
            .single()
          creator = user
        }

        return {
          id: gameData.id,
          status: gameData.status,
          betAmount: gameData.bet_amount,
          pot: gameData.pot,
          createdAt: gameData.created_at,
          creator,
          hasSecondPlayer: !!gameData.player_o,
          players: gameData.players
        }
      })
    )

    logger.info(`Fetched ${gamesWithPlayers.length} games for lobby`)
    return NextResponse.json(gamesWithPlayers)

  } catch (error) {
    logger.error(`Unexpected error in lobby GET: ${error}`)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - создать новую игру
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, betAmount } = body

    if (!userId || !betAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const directSupabase = getSupabaseServerClient()

    // Проверяем баланс пользователя
    const { data: user, error: userError } = await directSupabase
      .from('users')
      .select('balance, username')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      logger.error(`User not found: ${userId}`)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if ((user as any).balance < betAmount) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      )
    }

    // Создаем новую игру
    const gameData = {
      player_x: userId,
      player_o: null,
      bet_amount: betAmount,
      pot: betAmount,
      status: 'waiting',
      board: JSON.stringify(Array(9).fill(null)),
      current_player: 'X',
      created_at: new Date().toISOString(),
      players: {
        X: {
          id: userId,
          username: (user as any).username,
          avatar: null
        },
        O: null
      }
    }

    const { data: game, error: gameError } = await directSupabase
      .from('games')
      .insert(gameData as any)
      .select()
      .single()

    if (gameError) {
      logger.error(`Error creating game: ${gameError.message}`)
      return NextResponse.json(
        { error: 'Failed to create game' },
        { status: 500 }
      )
    }

    // Списываем ставку с баланса пользователя
    const { error: balanceError } = await directSupabase
      .from('users')
      .update({ balance: (user as any).balance - betAmount } as any)
      .eq('id', userId)

    if (balanceError) {
      logger.error(`Error updating balance: ${balanceError.message}`)
      // Откатываем создание игры
      await directSupabase
        .from('games')
        .delete()
        .eq('id', (game as any).id)
      
      return NextResponse.json(
        { error: 'Failed to process bet' },
        { status: 500 }
      )
    }

    // Создаем транзакцию
    const { error: transactionError } = await directSupabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'bet',
        amount: -betAmount,
        game_id: (game as any).id,
        description: `Bet placed for multiplayer game`
      } as any)

    if (transactionError) {
      logger.error(`Error creating transaction: ${transactionError.message}`)
      // Не откатываем игру, так как транзакция не критична
    }

    logger.info(`Created new multiplayer game ${(game as any).id} by user ${userId}`)
    
    return NextResponse.json({
      success: true,
      message: 'Game created successfully',
      game: {
        id: (game as any).id,
        status: (game as any).status,
        betAmount: (game as any).bet_amount,
        pot: (game as any).pot,
        createdAt: (game as any).created_at,
        creator: {
          id: userId,
          username: (user as any).username,
          avatar: null
        }
      }
    })

  } catch (error) {
    logger.error(`Unexpected error in lobby POST: ${error}`)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 