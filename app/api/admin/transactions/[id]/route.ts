import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"
import { isAdmin } from "@/lib/utils/auth"
import { updateUserBalance } from "@/lib/db-actions"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const { adminId, status } = await request.json()

    // Verify admin permissions
    if (!adminId || !(await isAdmin(adminId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseServerClient()

    // First, get the current transaction to check its status and type
    const { data: currentTransaction, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError) {
      console.error("Error fetching transaction:", fetchError)
      return NextResponse.json({ error: "Failed to fetch transaction" }, { status: 500 })
    }

    if (!currentTransaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    // Only allow status updates for pending transactions
    if (currentTransaction.status !== "pending") {
      return NextResponse.json({ error: "Only pending transactions can be updated" }, { status: 400 })
    }

    // Update the transaction status
    const updateData: any = {
      status,
    }

    // If the status is being set to completed, add the completed_at timestamp
    if (status === "completed") {
      updateData.completed_at = new Date().toISOString()
    }

    const { data, error } = await supabase.from("transactions").update(updateData).eq("id", id).select().single()

    if (error) {
      console.error("Error updating transaction:", error)
      return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 })
    }

    // If the transaction is now completed, update the user's balance
    if (status === "completed") {
      const userId = currentTransaction.user_id
      const amount = currentTransaction.amount

      // For deposits and wins, add to balance
      if (currentTransaction.type === "deposit" || currentTransaction.type === "win") {
        await updateUserBalance(userId, amount)
      }
      // For withdrawals and bets, subtract from balance
      else if (currentTransaction.type === "withdrawal" || currentTransaction.type === "bet") {
        await updateUserBalance(userId, -amount)
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error updating transaction:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
