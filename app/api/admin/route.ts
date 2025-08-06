import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"
import { verifyAdmin } from "@/lib/utils/auth"
import type { Database } from "@/lib/database.types"
import type { PostgrestError } from "@supabase/supabase-js"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Verify admin status
    const isAdmin = await verifyAdmin(userId)

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Get admin stats
    const supabase = getSupabaseServerClient()

    // Get total users
    const { count: totalUsers } = await supabase.from("users").select("*", { count: "exact", head: true })

    // Get active users (played games or made transactions within the last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: activeGameUserIds, error: gameError } = await supabase
      .from("games")
      .select("player_x, player_o")
      .gt("created_at", twentyFourHoursAgo) as { 
        data: { player_x: string; player_o: string }[] | null, 
        error: PostgrestError | null 
      }

    const { data: activeTransactionUserIds, error: txError } = await supabase
      .from("transactions")
      .select("user_id")
      .gt("created_at", twentyFourHoursAgo) as { 
        data: { user_id: string }[] | null, 
        error: PostgrestError | null 
      }

    if (gameError) {
      console.error("Error fetching active game users:", gameError)
    }

    if (txError) {
      console.error("Error fetching active transaction users:", txError)
    }

    // Combine and deduplicate user IDs
    const combinedActiveUserIds = new Set([
      ...(activeGameUserIds?.flatMap(game => [game.player_x, game.player_o]).filter(Boolean) || []),
      ...(activeTransactionUserIds?.map(tx => tx.user_id).filter(Boolean) || [])
    ])

    const activeUsers = combinedActiveUserIds.size

    // Get total games
    const { count: totalGames } = await supabase.from("games").select("*", { count: "exact", head: true })

    // Get total volume
    const transactionTypes = ["deposit", "withdrawal", "bet", "win"] as const
    const { data: transactions, error: transactionsError } = await supabase
      .from("transactions")
      .select("amount")
      .in("type", transactionTypes as any) as { 
        data: { amount: number }[] | null, 
        error: PostgrestError | null 
      }

    if (transactionsError) {
      console.error("Error fetching transactions:", transactionsError)
    }

    const totalVolume = transactions?.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) || 0

    // Get pending withdrawals
    const { count: pendingWithdrawals, error: withdrawalError } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("type", "withdrawal" as any)
      .eq("status", "pending" as any)

    if (withdrawalError) {
      console.error("Error fetching pending withdrawals:", withdrawalError)
    }

    // Get pending deposits
    const { count: pendingDeposits, error: depositError } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("type", "deposit" as any)
      .eq("status", "pending" as any)

    if (depositError) {
      console.error("Error fetching pending deposits:", depositError)
    }

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      totalGames: totalGames || 0,
      totalVolume,
      pendingWithdrawals: pendingWithdrawals || 0,
      pendingDeposits: pendingDeposits || 0,
    })
  } catch (error) {
    console.error("Error fetching admin stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
