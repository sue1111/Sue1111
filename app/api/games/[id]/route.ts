import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('GameAPI')

// GET - получить информацию об игре
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id

    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' },
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

    logger.info(`Retrieved game ${gameId}`)
    
    return NextResponse.json({
      id: (game as any).id,
      status: (game as any).status,
      betAmount: (game as any).bet_amount,
      pot: (game as any).pot,
      board: (game as any).board,
      currentPlayer: (game as any).current_player,
      players: (game as any).players,
      winner: (game as any).winner,
      createdAt: (game as any).created_at,
      updatedAt: (game as any).updated_at
    })

  } catch (error) {
    logger.error(`Unexpected error in game GET: ${error}`)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - удалить игру
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id

    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' },
        { status: 400 }
      )
    }

    const directSupabase = getSupabaseServerClient()

    // Получаем игру для проверки
    const { data: game, error: gameError } = await directSupabase
      .from('games')
      .select('*')
      .eq('id', gameId as any)
      .single()

    if (gameError || !game) {
      logger.error(`Game not found for deletion: ${gameId}`)
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      )
    }

    // Если игра в статусе waiting, возвращаем ставку
    if ((game as any).status === 'waiting' && (game as any).player_x) {
      const { data: user, error: userError } = await directSupabase
        .from('users')
        .select('balance')
        .eq('id', (game as any).player_x)
        .single()

      if (!userError && user) {
        const newBalance = (user as any).balance + (game as any).bet_amount
        
        await directSupabase
          .from('users')
          .update({ balance: newBalance } as any)
          .eq('id', (game as any).player_x)

        logger.info(`Refunded bet for user ${(game as any).player_x}: ${(game as any).bet_amount}`)
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
        { error: 'Failed to delete game' },
        { status: 500 }
      )
    }

    logger.info(`Deleted game ${gameId}`)
    
    return NextResponse.json({
      success: true,
      message: 'Game deleted successfully'
    })

  } catch (error) {
    logger.error(`Unexpected error in game DELETE: ${error}`)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
