import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseServerClient()
    
    // Get user statistics
    const { count: totalUsers } = await supabase.from("users").select("id", { count: "exact", head: true })
    
    // Get total games count
    const { count: totalGames } = await supabase.from("games").select("id", { count: "exact", head: true })
    
    // Calculate games played in the last 24 hours
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayISOString = yesterday.toISOString()
    
    const { count: gamesLast24Hours } = await supabase
      .from("games")
      .select("id", { count: "exact", head: true })
      .gte("created_at", yesterdayISOString)
    
    // Calculate total transaction volume
    const { data: transactionData, error: transactionError } = await supabase
      .from("transactions")
      .select("amount")
      .eq("status", "completed")
    
    let totalVolume = 0
    if (!transactionError && transactionData) {
      totalVolume = transactionData.reduce((sum, tx) => sum + (tx.amount || 0), 0)
    }
    
    // Get pending withdrawals and deposits
    const { count: pendingWithdrawals } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("type", "withdrawal")
      .eq("status", "pending")
    
    const { count: pendingDeposits } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("type", "deposit")
      .eq("status", "pending")
    
    return NextResponse.json({
      totalUsers: totalUsers || 0,
      activeUsers: 0,
      totalGames: totalGames || 0,
      gamesLast24Hours: gamesLast24Hours || 0,
      totalVolume: totalVolume,
      pendingWithdrawals: pendingWithdrawals || 0,
      pendingDeposits: pendingDeposits || 0,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
