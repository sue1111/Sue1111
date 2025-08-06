import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = params.id
    const { amount, type, status } = await request.json()

    const supabase = getSupabaseServerClient()

    // First, get the current user balance
    const { data: userData, error: fetchError } = await supabase
      .from("users")
      .select("balance")
      .eq("id", userId)
      .single()

    if (fetchError) {
      console.error("Error fetching user balance:", fetchError)
      return NextResponse.json({ error: "Failed to fetch user balance" }, { status: 500 })
    }

    const currentBalance = userData?.balance || 0
    const newBalance = currentBalance + amount

    // Ensure balance doesn't go negative
    if (newBalance < 0) {
      return NextResponse.json({ error: "Cannot update balance: would result in negative balance" }, { status: 400 })
    }

    // Update the user's balance
    const { error: updateError } = await supabase.from("users").update({ balance: newBalance }).eq("id", userId)

    if (updateError) {
      console.error("Error updating user balance:", updateError)
      return NextResponse.json({ error: "Failed to update user balance" }, { status: 500 })
    }

    // Create a transaction record
    const { error: transactionError } = await supabase.from("transactions").insert({
      user_id: userId,
      type,
      amount: Math.abs(amount),
      currency: "USDT",
      status,
      created_at: new Date().toISOString(),
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })

    if (transactionError) {
      console.error("Error creating transaction record:", transactionError)
      // We don't return an error here because the balance was already updated
    }

    return NextResponse.json({ success: true, newBalance })
  } catch (error) {
    console.error("Error updating user balance:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
