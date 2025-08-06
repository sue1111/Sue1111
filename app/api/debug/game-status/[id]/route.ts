import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const gameId = params.id
    const directSupabase = getSupabaseServerClient()
    
    // Получаем данные игры из базы данных
    const { data: game, error } = await directSupabase
      .from("games")
      .select("*")
      .eq("id", gameId as any)
      .single()
    
    if (error) {
      return NextResponse.json({ error: "Failed to fetch game", details: error }, { status: 500 })
    }
    
    return NextResponse.json({ game })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 