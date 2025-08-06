import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"
import { createNotification } from "@/lib/db-actions"

export async function POST(request: Request) {
  try {
    const notificationData = await request.json()

    if (!notificationData.userId || !notificationData.type || !notificationData.message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get username for the notification
    const supabase = getSupabaseServerClient()
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("username")
      .eq("id", notificationData.userId)
      .single()

    if (userError || !userData) {
      console.error("Error fetching user:", userError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const notification = await createNotification({
      type: notificationData.type,
      userId: notificationData.userId,
      amount: notificationData.amount,
      status: notificationData.status || "pending",
      message: notificationData.message,
    })

    if (!notification) {
      return NextResponse.json({ error: "Failed to create notification" }, { status: 500 })
    }

    // Add username to the response
    notification.username = userData.username

    return NextResponse.json(notification)
  } catch (error) {
    console.error("Error creating notification:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const supabase = getSupabaseServerClient()

    let query = supabase
      .from("notifications")
      .select("*, users:users(username)")
      .order("created_at", { ascending: false })

    if (status) {
      query = query.eq("status", status)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching notifications:", error)
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
    }

    const notifications = data.map((item) => ({
      id: item.id,
      type: item.type,
      userId: item.user_id,
      username: item.users?.username || "",
      amount: item.amount || undefined,
      status: item.status,
      message: item.message,
      createdAt: item.created_at,
    }))

    return NextResponse.json(notifications)
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
