import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('JoinGameAPI')

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id
    const { userId, username } = await request.json()

    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' },
        { status: 400 }
      )
    }

    if (!userId || !username) {
      return NextResponse.json(
        { error: 'User ID and username are required' },
        { status: 400 }
      )
    }

    const directSupabase = getSupabaseServerClient()

    // Получаем игру
    const { data: game, error: gameError } = await directSupabase
      .from('games')
      .select('*')
      .eq('id', gameId as any)
      .single()

    if (gameError || !game) {
      logger.error(`Game not found: ${gameId}`)
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      )
    }

    // Проверяем, что игра в статусе waiting
    if ((game as any).status !== 'waiting') {
      logger.error(`Game ${gameId} is not waiting for players`)
      return NextResponse.json(
        { error: 'Game is not waiting for players' },
        { status: 400 }
      )
    }

    // Проверяем, что игрок не пытается присоединиться к своей игре
    if ((game as any).player_x === userId) {
      logger.error(`User ${userId} cannot join their own game`)
      return NextResponse.json(
        { error: 'Cannot join your own game' },
        { status: 400 }
      )
    }

    // Проверяем, что второй игрок еще не присоединился
    if ((game as any).player_o) {
      logger.error(`Game ${gameId} already has two players`)
      return NextResponse.json(
        { error: 'Game already has two players' },
        { status: 400 }
      )
    }

    // Получаем данные пользователя
    const { data: userData, error: userError } = await directSupabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      logger.error(`User not found: ${userId}`)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Проверяем баланс пользователя
    if ((userData as any).balance < (game as any).bet_amount) {
      logger.error(`Insufficient balance: ${(userData as any).balance} < ${(game as any).bet_amount}`)
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      )
    }

    // Списываем средства у второго игрока
    const newBalance = (userData as any).balance - (game as any).bet_amount
    const { error: balanceError } = await directSupabase
      .from('users')
      .update({ balance: newBalance } as any)
      .eq('id', userId)

    if (balanceError) {
      logger.error(`Error updating user balance: ${balanceError.message}`)
      return NextResponse.json(
        { error: 'Failed to update balance' },
        { status: 500 }
      )
    }

    // Обновляем игру
    const updatedPlayers = {
      X: (game as any).players?.X || {
        id: (game as any).player_x,
        username: 'Unknown',
        avatar: null
      },
      O: {
        id: userId,
        username: username,
        avatar: (userData as any).avatar
      }
    }

    const { data: updatedGame, error: updateError } = await directSupabase
      .from('games')
      .update({
        player_o: userId,
        status: 'playing',
        players: updatedPlayers,
        pot: (game as any).bet_amount * 2
      } as any)
      .eq('id', gameId as any)
      .select()
      .single()

    if (updateError) {
      logger.error(`Error updating game: ${updateError.message}`)
      
      // Возвращаем средства если не удалось обновить игру
      await directSupabase
        .from('users')
        .update({ balance: (userData as any).balance } as any)
        .eq('id', userId)
      
      return NextResponse.json(
        { error: 'Failed to join game' },
        { status: 500 }
      )
    }

    logger.info(`User ${username} (${userId}) joined game ${gameId}`)

    return NextResponse.json({
      success: true,
      game: updatedGame,
      message: 'Successfully joined game'
    })

  } catch (error) {
    logger.error(`Unexpected error in join game: ${error}`)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 