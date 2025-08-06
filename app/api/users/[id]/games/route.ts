import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Получаем игры где пользователь был игроком X или O
    const { data: games, error } = await supabase
      .from("games")
      .select(`
        *,
        player_x_user:users!player_x(username, avatar),
        player_o_user:users!player_o(username, avatar)
      `)
      .or(`player_x.eq.${userId},player_o.eq.${userId}`)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Error fetching user games:", error)
      return NextResponse.json({ error: "Failed to fetch user games" }, { status: 500 })
    }

    // Форматируем данные для фронтенда
    const formattedGames = (games as any[]).map((game) => {
      // Определяем имя игрока O
      let playerOName = "Unknown"
      if (game.players?.O?.username) {
        // Приоритет отдаем данным из поля players
        playerOName = game.players.O.username
      } else if (game.player_o_user?.username) {
        playerOName = game.player_o_user.username
      } else if (game.player_o && game.player_o.startsWith('ai_')) {
        // Если это ИИ, но нет имени, используем случайное имя
        const fakeUsernames = [
          'Alex', 'Maria', 'John', 'Sarah', 'Mike', 'Emma', 'David', 'Lisa',
          'Tom', 'Anna', 'Chris', 'Sophie', 'Paul', 'Kate', 'Mark', 'Julia'
        ]
        playerOName = fakeUsernames[Math.floor(Math.random() * fakeUsernames.length)]
      }

      return {
        id: game.id,
        status: game.status,
        winner: game.winner,
        betAmount: game.bet_amount,
        potAmount: game.pot_amount,
        createdAt: game.created_at,
        completedAt: game.completed_at,
        playerX: {
          id: game.player_x,
          username: game.player_x_user?.username || "Unknown",
          avatar: game.player_x_user?.avatar
        },
        playerO: {
          id: game.player_o,
          username: playerOName,
          avatar: game.player_o_user?.avatar
        },
        board: game.board,
        currentPlayer: game.current_player
      }
    })

    return NextResponse.json({
      games: formattedGames,
      total: formattedGames.length,
      hasMore: formattedGames.length === limit
    })
  } catch (error) {
    console.error("Error in user games API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 