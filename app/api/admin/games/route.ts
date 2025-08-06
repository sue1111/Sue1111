import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"
import { verifyAdmin } from "@/lib/utils/auth"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get("adminId")
    const status = searchParams.get("status")
    const search = searchParams.get("search")

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID is required" }, { status: 400 })
    }

    // Verify admin status
    const isAdmin = await verifyAdmin(adminId)

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = getSupabaseServerClient()

    // Fetch games with player information using a join
    let query = supabase
      .from("games")
      .select(`
        *,
        player_x_user:users!games_player_x_fkey(id, username, avatar),
        player_o_user:users!games_player_o_fkey(id, username, avatar)
      `)
      .order("created_at", { ascending: false })

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    if (search) {
      // We can't directly search on joined fields, so we'll filter after fetching
      query = query.limit(100) // Increase limit to ensure we have enough data to filter
    } else {
      query = query.limit(50)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching games:", error)
      return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 })
    }

    // Filter by search term if provided
    let filteredData = data
    if (search && filteredData) {
      const searchLower = search.toLowerCase()
      filteredData = filteredData.filter(game => {
        const playerXUsername = game.player_x_user?.username?.toLowerCase() || ""
        const playerOUsername = game.player_o_user?.username?.toLowerCase() || ""
        const gameId = game.id.toLowerCase()
        
        return gameId.includes(searchLower) || 
               playerXUsername.includes(searchLower) || 
               playerOUsername.includes(searchLower)
      })
    }

    // Transform data to match the GameState type
    const games = filteredData.map((item) => ({
      id: item.id,
      board: item.board as (string | null)[],
      currentPlayer: item.current_player as "X" | "O",
      players: {
        X: item.player_x_user ? {
          id: item.player_x_user.id,
          username: item.player_x_user.username,
          avatar: item.player_x_user.avatar,
        } : {
          id: item.player_x,
          username: "Unknown Player",
          avatar: null,
        },
        O: item.player_o_user ? {
          id: item.player_o_user.id,
          username: item.player_o_user.username,
          avatar: item.player_o_user.avatar,
        } : item.player_o ? {
          id: item.player_o,
          username: "Unknown Player",
          avatar: null,
        } : null,
      },
      status: item.status as "playing" | "completed" | "draw",
      betAmount: item.bet_amount,
      pot: item.pot,
      winner: item.winner as string | null,
      createdAt: item.created_at,
      endedAt: item.ended_at || undefined,
    }))

    // Add cache control headers to prevent caching
    const response = NextResponse.json(games)
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (error) {
    console.error("Error fetching games:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
