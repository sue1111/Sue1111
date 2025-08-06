import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('JoinAIAPI')

// POST - подключить ИИ к игре
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id
    const body = await request.json()
    const { userId } = body

    if (!gameId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const directSupabase = getSupabaseServerClient()

    // Получаем игру
    logger.info(`Looking for game: ${gameId}`)
    const { data: game, error: gameError } = await directSupabase
      .from('games')
      .select('*')
      .eq('id', gameId as any)
      .single()

    if (gameError || !game) {
      logger.error(`Game not found: ${gameId}, error: ${gameError?.message}`)
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      )
    }

    logger.info(`Found game: ${gameId}, status: ${(game as any).status}`)

    // Проверяем, что игра в статусе waiting
    if ((game as any).status !== 'waiting') {
      return NextResponse.json(
        { error: 'Game is not available for joining' },
        { status: 400 }
      )
    }

    // Проверяем, что пользователь является создателем игры
    if ((game as any).player_x !== userId) {
      return NextResponse.json(
        { error: 'You can only join your own game' },
        { status: 403 }
      )
    }

    // Случайная задержка от 1 до 3 секунд для реалистичности
    const randomDelay = Math.floor(Math.random() * 2000) + 1000
    logger.info(`Adding realistic delay: ${randomDelay}ms`)
    await new Promise(resolve => setTimeout(resolve, randomDelay))

    // Создаем фиктивного пользователя для маскировки ИИ
    const fakeUsernames = [
      'Alex', 'Maria', 'John', 'Sarah', 'Mike', 'Emma', 'David', 'Lisa',
      'Tom', 'Anna', 'Chris', 'Sophie', 'Paul', 'Kate', 'Mark', 'Julia',
      'Ryan', 'Emily', 'James', 'Olivia', 'Daniel', 'Sophia', 'Matthew', 'Ava',
      'Christopher', 'Isabella', 'Andrew', 'Mia', 'Joshua', 'Charlotte', 'Nathan', 'Amelia'
    ]
    
    const randomUsername = fakeUsernames[Math.floor(Math.random() * fakeUsernames.length)]
    
    // Создаем ИИ под маской случайного пользователя
    const aiPlayer = {
      id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      username: randomUsername,
      avatar: null,
      isAI: true
    }

    logger.info(`AI player created: ${aiPlayer.username}`)

    // Обновляем игру - только статус и players
    const updatedGameData = {
      status: 'playing',
      players: {
        X: (game as any).players.X,
        O: aiPlayer
      }
    }

    logger.info(`Updating game with data:`, updatedGameData)

    const { data: updatedGame, error: updateError } = await directSupabase
      .from('games')
      .update(updatedGameData as any)
      .eq('id', gameId as any)
      .select()
      .single()

    if (updateError) {
      logger.error(`Error updating game: ${updateError.message}`)
      logger.error(`Error details:`, updateError)
      return NextResponse.json(
        { error: 'Failed to join AI to game' },
        { status: 500 }
      )
    }

    logger.info(`Game updated successfully`)

    logger.info(`AI joined game ${gameId} as ${aiPlayer.username}`)
    
    return NextResponse.json({
      success: true,
      message: 'AI joined the game',
      game: {
        id: (updatedGame as any).id,
        status: (updatedGame as any).status,
        players: (updatedGame as any).players,
        betAmount: (updatedGame as any).bet_amount,
        pot: (updatedGame as any).pot
      },
      aiPlayer
    })

  } catch (error) {
    logger.error(`Unexpected error in join AI: ${error}`)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 