import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('GameActivityAPI')

// Простое хранилище активности в памяти (для демонстрации)
const activityStore = new Map<string, { [userId: string]: { lastActivity: Date, playerSymbol: string } }>()

// POST - обновить активность игрока
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id
    const body = await request.json()
    const { userId, playerSymbol } = body

    if (!gameId || !userId || !playerSymbol) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Сохраняем активность в памяти
    if (!activityStore.has(gameId)) {
      activityStore.set(gameId, {})
    }
    
    const gameActivity = activityStore.get(gameId)!
    gameActivity[userId] = {
      lastActivity: new Date(),
      playerSymbol
    }

    logger.info(`Activity updated for game ${gameId}, user ${userId}`)

    return NextResponse.json({
      success: true,
      game_paused: false
    })

  } catch (error) {
    logger.error(`Unexpected error in activity API: ${error}`)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - получить статус активности игры
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id

    // Получаем активность из памяти
    const gameActivity = activityStore.get(gameId) || {}
    const activities = Object.entries(gameActivity).map(([userId, data]) => ({
      user_id: userId,
      player_symbol: data.playerSymbol,
      last_activity: data.lastActivity.toISOString()
    }))

    // Проверяем, кто неактивен
    const now = new Date()
    const inactivePlayers = activities.filter(activity => {
      const lastActivity = new Date(activity.last_activity)
      const diffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60)
      return diffMinutes > 2 // Неактивен более 2 минут
    })

    return NextResponse.json({
      activities,
      inactive_players: inactivePlayers,
      should_pause: inactivePlayers.length > 0
    })

  } catch (error) {
    logger.error(`Unexpected error in activity GET: ${error}`)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 