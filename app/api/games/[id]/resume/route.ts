import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('GameResumeAPI')

// POST - возобновить игру
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

    logger.info(`Game ${gameId} resume requested by user ${userId}`)

    return NextResponse.json({
      success: true,
      message: 'Game resumed successfully'
    })

  } catch (error) {
    logger.error(`Unexpected error in resume API: ${error}`)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 