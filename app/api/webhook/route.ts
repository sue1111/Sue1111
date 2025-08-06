import { NextResponse } from "next/server"
import { createTransaction, updateUserBalance } from "@/lib/db-actions"

// This endpoint would handle webhooks from payment processors
export async function POST(request: Request) {
  try {
    // Verify webhook signature (implementation depends on payment processor)
    const payload = await request.json()

    // Example structure for a deposit webhook
    // { type: 'deposit', userId: 'user_id', amount: 100, txHash: '0x123...', status: 'completed' }

    if (!payload.type || !payload.userId || !payload.amount) {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 })
    }

    // Create transaction record
    const transaction = await createTransaction({
      userId: payload.userId,
      type: payload.type,
      amount: payload.amount,
      currency: payload.currency || "USDT",
      status: payload.status || "pending",
      walletAddress: payload.walletAddress,
      txHash: payload.txHash,
    })

    if (!transaction) {
      return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 })
    }

    // If transaction is completed, update user balance
    if (transaction.status === "completed") {
      if (transaction.type === "deposit" || transaction.type === "win") {
        await updateUserBalance(transaction.userId, transaction.amount)
      } else if (transaction.type === "withdrawal" || transaction.type === "bet") {
        await updateUserBalance(transaction.userId, -transaction.amount)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error processing webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
