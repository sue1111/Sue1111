import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('CancelGameAPI')

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id
    const { userId } = await request.json()

    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
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
      logger.error(`Game ${gameId} is not waiting, cannot cancel`)
      return NextResponse.json(
        { error: 'Game is not waiting, cannot cancel' },
        { status: 400 }
      )
    }

    // Проверяем, что пользователь является создателем игры
    if ((game as any).player_x !== userId) {
      logger.error(`User ${userId} is not the creator of game ${gameId}`)
      return NextResponse.json(
        { error: 'Only game creator can cancel the game' },
        { status: 403 }
      )
    }

    // Возвращаем баланс создателю игры
    const { data: userData, error: userError } = await directSupabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single()

    if (!userError && userData) {
      const newBalance = (userData as any).balance + (game as any).bet_amount
      
      const { error: balanceError } = await directSupabase
        .from('users')
        .update({ balance: newBalance } as any)
        .eq('id', userId)

      if (balanceError) {
        logger.error(`Error returning balance: ${balanceError.message}`)
      } else {
        logger.info(`Returned ${(game as any).bet_amount} to user ${userId}`)
      }
    }

    // Удаляем игру
    const { error: deleteError } = await directSupabase
      .from('games')
      .delete()
      .eq('id', gameId as any)

    if (deleteError) {
      logger.error(`Error deleting game: ${deleteError.message}`)
      return NextResponse.json(
        { error: 'Failed to cancel game' },
        { status: 500 }
      )
    }

    logger.info(`Game ${gameId} cancelled by user ${userId}`)

    return NextResponse.json({
      success: true,
      message: 'Game cancelled successfully',
      refundedAmount: (game as any).bet_amount
    })

  } catch (error) {
    logger.error(`Unexpected error in cancel game: ${error}`)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 