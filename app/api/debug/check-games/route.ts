import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseServerClient()
    
    // Получаем все игры для анализа
    const { data: allGames, error: fetchError } = await supabase
      .from("games")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)
    
    if (fetchError) {
      console.error("Error fetching games:", fetchError)
      return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 })
    }
    
    // Анализируем игры
    const analysis = {
      total: allGames?.length || 0,
      byStatus: {} as Record<string, number>,
      byWinner: {} as Record<string, number>,
      waitingGames: [] as any[],
      completedGames: [] as any[],
      playingGames: [] as any[]
    }
    
    allGames?.forEach(game => {
      const gameData = game as any
      // Подсчитываем по статусу
      analysis.byStatus[gameData.status] = (analysis.byStatus[gameData.status] || 0) + 1
      
      // Подсчитываем по победителю
      if (gameData.winner) {
        analysis.byWinner[gameData.winner] = (analysis.byWinner[gameData.winner] || 0) + 1
      }
      
      // Группируем игры
      if (gameData.status === "waiting") {
        analysis.waitingGames.push({
          id: gameData.id,
          created_at: gameData.created_at,
          player_x: gameData.player_x,
          player_o: gameData.player_o,
          winner: gameData.winner,
          board: gameData.board
        })
      } else if (gameData.status === "completed") {
        analysis.completedGames.push({
          id: gameData.id,
          created_at: gameData.created_at,
          player_x: gameData.player_x,
          player_o: gameData.player_o,
          winner: gameData.winner,
          board: gameData.board
        })
      } else if (gameData.status === "playing") {
        analysis.playingGames.push({
          id: gameData.id,
          created_at: gameData.created_at,
          player_x: gameData.player_x,
          player_o: gameData.player_o,
          winner: gameData.winner,
          board: gameData.board
        })
      }
    })
    
    return NextResponse.json({
      analysis,
      games: allGames
    })
  } catch (error) {
    console.error("Error in check-games:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 