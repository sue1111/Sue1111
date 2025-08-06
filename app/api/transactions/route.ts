import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"
import { createTransaction, updateUserBalance } from "@/lib/db-actions"

export async function POST(request: Request) {
  try {
    const transactionData = await request.json()

    if (!transactionData.userId || !transactionData.type || !transactionData.amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const transaction = await createTransaction({
      userId: transactionData.userId,
      type: transactionData.type,
      amount: transactionData.amount,
      currency: transactionData.currency || "USDT",
      status: transactionData.status || "pending",
      walletAddress: transactionData.walletAddress,
      txHash: transactionData.txHash,
    })

    if (!transaction) {
      return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 })
    }

    // If transaction is a completed deposit or win, update user balance
    if (transaction.status === "completed" && (transaction.type === "deposit" || transaction.type === "win")) {
      await updateUserBalance(transaction.userId, transaction.amount)
    }

    // If transaction is a completed withdrawal or bet, update user balance
    if (transaction.status === "completed" && (transaction.type === "withdrawal" || transaction.type === "bet")) {
      await updateUserBalance(transaction.userId, -transaction.amount)
    }

    return NextResponse.json(transaction)
  } catch (error) {
    console.error("Error creating transaction:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching transactions:", error)
      return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 })
    }

    const transactions = data.map((item) => ({
      id: item.id,
      userId: item.user_id,
      type: item.type,
      amount: item.amount,
      currency: item.currency,
      status: item.status,
      walletAddress: item.wallet_address || undefined,
      txHash: item.tx_hash || undefined,
      createdAt: item.created_at,
      completedAt: item.completed_at || undefined,
    }))

    // Add cache control headers to prevent caching
    const response = NextResponse.json(transactions)
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (error) {
    console.error("Error fetching transactions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
