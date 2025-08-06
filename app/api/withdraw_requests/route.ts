import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, amount, walletAddress } = body
    if (!userId || !amount || !walletAddress) {
      console.error("Missing required fields", body)
      return NextResponse.json({ error: "Missing required fields", body }, { status: 400 })
    }
    const supabase = getSupabaseServerClient()
    const { error } = await supabase.from("withdraw_requests").insert({
      user_id: userId,
      amount,
      wallet_address: walletAddress,
      status: "pending",
      created_at: new Date().toISOString(),
    })
    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Internal server error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error", details: error }, { status: 500 })
  }
} 