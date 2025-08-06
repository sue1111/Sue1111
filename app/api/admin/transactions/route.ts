import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"
import { isAdmin } from "@/lib/utils/auth"
import { verifyAdmin } from "@/lib/utils/auth"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get("adminId")
    const status = searchParams.get("status") || "all"
    const type = searchParams.get("type") || "all"
    const search = searchParams.get("search") || ""
    const page = Number.parseInt(searchParams.get("page") || "1")
    const pageSize = 20

    // Verify admin permissions
    if (!adminId || !(await isAdmin(adminId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseServerClient()
    let query = supabase.from("transactions").select("*, users!inner(username)", { count: "exact" })

    // Apply filters
    if (status !== "all") {
      query = query.eq("status", status)
    }

    if (type !== "all") {
      query = query.eq("type", type)
    }

    if (search) {
      query = query.or(`user_id.ilike.%${search}%,id.ilike.%${search}%,users.username.ilike.%${search}%`)
    }

    // Apply pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.order("created_at", { ascending: false }).range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching transactions:", error)
      return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 })
    }

    const transactions = data.map((item) => ({
      id: item.id,
      userId: item.user_id,
      username: item.users?.username,
      type: item.type,
      amount: item.amount,
      currency: item.currency,
      status: item.status,
      walletAddress: item.wallet_address || undefined,
      txHash: item.tx_hash || undefined,
      createdAt: item.created_at,
      completedAt: item.completed_at || undefined,
    }))

    const totalPages = Math.ceil((count || 0) / pageSize)

    // Add cache control headers to prevent caching
    const response = NextResponse.json({ transactions, totalPages, count })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (error) {
    console.error("Error fetching transactions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { adminId, transactionId, status } = await request.json()

    if (!adminId || !transactionId || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify admin status
    const isAdminResult = await verifyAdmin(adminId)

    if (!isAdminResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = getSupabaseServerClient()

    // Get transaction details
    const { data: transaction, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single()

    if (fetchError || !transaction) {
      console.error("Error fetching transaction:", fetchError)
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    // Update transaction status
    const updates: Record<string, any> = { status }

    if (status === "completed") {
      updates.completed_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase.from("transactions").update(updates).eq("id", transactionId)

    if (updateError) {
      console.error("Error updating transaction:", updateError)
      return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 })
    }

    // If transaction is approved, update user balance
    if (status === "completed") {
      if (transaction.type === "deposit") {
        // Add funds to user balance
        await supabase
          .from("users")
          .update({
            balance: supabase.rpc("increment", { x: transaction.amount }),
          })
          .eq("id", transaction.user_id)
      } else if (transaction.type === "withdrawal") {
        // Subtract funds from user balance
        await supabase
          .from("users")
          .update({
            balance: supabase.rpc("decrement", { x: transaction.amount }),
          })
          .eq("id", transaction.user_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating transaction:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
