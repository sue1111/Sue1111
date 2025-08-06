import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"
import { verifyAdmin } from "@/lib/utils/auth"

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseServerClient()
    const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(10)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { adminId, notificationId, status } = await request.json()

    if (!adminId || !notificationId || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify admin status
    const isAdmin = await verifyAdmin(adminId)

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = getSupabaseServerClient()

    // Get notification details
    const { data: notification, error: fetchError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .single()

    if (fetchError || !notification) {
      console.error("Error fetching notification:", fetchError)
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }

    // Update notification status
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ status } as any)
      .eq("id", notificationId)

    if (updateError) {
      console.error("Error updating notification:", updateError)
      return NextResponse.json({ error: "Failed to update notification" }, { status: 500 })
    }

    // If it's a deposit request and it's approved, create a transaction and update balance
    const notificationData = notification as any
    if (notificationData.type === "deposit_request" && status === "approved" && notificationData.amount) {
      // Get current user balance
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("balance")
        .eq("id", notificationData.user_id)
        .single()

      if (userError || !userData) {
        console.error("User not found for deposit approve:", userError)
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      // Get system settings for deposit fee
      const { data: systemSettings, error: settingsError } = await supabase
        .from("system_settings")
        .select("deposit_fee")
        .single()

      if (settingsError) {
        console.error("Error fetching system settings:", settingsError)
      }

      // Calculate commission using configurable percentage (default 20%)
      const depositAmount = Number(notificationData.amount)
      const depositFeePercentage = systemSettings?.deposit_fee || 20
      const commission = depositAmount * (depositFeePercentage / 100)
      const amountToCredit = depositAmount - commission
      
      const userDataTyped = userData as any
      const newBalance = Number(userDataTyped.balance) + amountToCredit
      console.log(`Approving deposit: user ${notificationData.user_id}, old balance: ${userDataTyped.balance}, deposit: ${depositAmount}, fee: ${depositFeePercentage}%, commission: ${commission}, amount to credit: ${amountToCredit}, new balance: ${newBalance}`)

      // Update user balance (deposit amount minus commission)
      const { error: balError } = await supabase
        .from("users")
        .update({ balance: newBalance } as any)
        .eq("id", notificationData.user_id)
        
      if (balError) {
        console.error("Failed to update balance on deposit approve:", balError)
        return NextResponse.json({ error: "Failed to update balance" }, { status: 500 })
      }

      // Create transaction record for user (credited amount)
      const { error: txError } = await supabase.from("transactions").insert({
        user_id: notificationData.user_id,
        type: "deposit",
        amount: amountToCredit,
        currency: "USD",
        status: "completed",
        completed_at: new Date().toISOString(),
      } as any)
      
      if (txError) {
        console.error("Error creating transaction:", txError)
        return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 })
      }

      // Create platform commission transaction
      const { error: commissionTxError } = await supabase.from("transactions").insert({
        user_id: notificationData.user_id,
        type: "platform_fee",
        amount: commission,
        currency: "USD",
        status: "completed",
        completed_at: new Date().toISOString(),
      } as any)
      
      if (commissionTxError) {
        console.error("Error creating commission transaction:", commissionTxError)
        // Don't fail the whole operation if commission recording fails
      }
    }

    // If rejected, just update status
    if (notification.type === "deposit_request" && status === "rejected") {
      console.log(`Deposit request ${notificationId} rejected by admin ${adminId}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in PATCH /admin/notifications:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
