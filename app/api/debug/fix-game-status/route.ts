import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseServerClient()
    
    // Получаем все игры со статусом "waiting" где player_o = null (игры против AI)
    const { data: waitingGames, error: fetchError } = await supabase
      .from("games")
      .select("*")
      .eq("status", "waiting" as any)
      .is("player_o", null)
    
    if (fetchError) {
      console.error("Error fetching waiting games:", fetchError)
      return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 })
    }
    

    
    // Обновляем статус на "playing"
    const { error: updateError } = await supabase
      .from("games")
      .update({ status: "playing" } as any)
      .eq("status", "waiting" as any)
      .is("player_o", null)
    
    if (updateError) {
      console.error("Error updating game status:", updateError)
      return NextResponse.json({ error: "Failed to update games" }, { status: 500 })
    }
    
    // Проверяем игры которые должны быть завершены
    const { data: completedGames, error: completedError } = await supabase
      .from("games")
      .select("*")
      .eq("status", "playing" as any)
      .not("winner", "is", null)
    
    if (completedError) {
      console.error("Error fetching completed games:", completedError)
    } else {
  
      
      // Обновляем статус на "completed" для игр с победителями
      const { error: completeError } = await supabase
        .from("games")
        .update({ status: "completed" } as any)
        .eq("status", "playing" as any)
        .not("winner", "is", null)
      
      if (completeError) {
        console.error("Error completing games:", completeError)
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Game statuses updated successfully",
      waitingGamesFixed: waitingGames?.length || 0
    })
  } catch (error) {
    console.error("Error in fix-game-status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 