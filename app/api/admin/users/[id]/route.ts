import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"
import { verifyAdmin } from "@/lib/utils/auth"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = params.id
    const updateData = await request.json()

    // Get admin ID from request headers or cookies
    const adminId = request.headers.get("x-admin-id") || "admin_user" // Replace with actual admin ID extraction

    // Verify admin status
    const isAdmin = await verifyAdmin(adminId)

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Validate the update data
    const validFields = ["username", "status", "is_admin"]
    const filteredData: Record<string, any> = {}

    Object.keys(updateData).forEach((key) => {
      if (validFields.includes(key)) {
        filteredData[key] = updateData[key]
      }
    })

    if (Object.keys(filteredData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Update the user
    const { data, error } = await supabase.from("users").update(filteredData).eq("id", userId).select().single()

    if (error) {
      console.error("Error updating user:", error)
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.id,
        username: data.username,
        balance: data.balance,
        avatar: data.avatar,
        gamesPlayed: data.games_played,
        gamesWon: data.games_won,
        walletAddress: data.wallet_address || undefined,
        isAdmin: data.is_admin,
        status: data.status,
        createdAt: data.created_at,
        lastLogin: data.last_login || undefined,
      },
    })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
