import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const search = searchParams.get("search")

    const supabase = getSupabaseServerClient()
    let query = supabase.from("users").select("*", { count: "exact" }).order("created_at", { ascending: false })
    if (status && status !== "all") {
      query = query.eq("status", status)
    }
    if (search) {
      query = query.or(`username.ilike.%${search}%,id.ilike.%${search}%`)
    }
    const { data, error, count } = await query
    if (error) {
      return NextResponse.json({ error: "Failed to fetch users", details: error }, { status: 500 })
    }
    const users = data.map((user) => ({
      id: user.id,
      username: user.username,
      balance: user.balance,
      avatar: user.avatar,
      gamesPlayed: user.games_played || 0,
      gamesWon: user.games_won || 0,
      walletAddress: user.wallet_address || undefined,
      isAdmin: user.is_admin,
      status: user.status,
      createdAt: user.created_at,
      lastLogin: user.last_login || undefined,
    }))
    return NextResponse.json({ users, count })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error", details: error }, { status: 500 })
  }
}
