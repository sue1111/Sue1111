import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"

// This endpoint would be called by a cron job to perform maintenance tasks
export async function GET(request: Request) {
  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization")

    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseServerClient()

    // Clean up abandoned games (created more than 1 hour ago and still in waiting status)
    const { error: cleanupError } = await supabase
      .from("games")
      .delete()
      .eq("status", "waiting")
      .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())

    if (cleanupError) {
      console.error("Error cleaning up abandoned games:", cleanupError)
    }

    // Update user statuses (mark users as inactive if they haven't logged in for 30 days)
    const { error: updateError } = await supabase
      .from("users")
      .update({ status: "inactive" })
      .eq("status", "active")
      .lt("last_login", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    if (updateError) {
      console.error("Error updating user statuses:", updateError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in cron job:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
