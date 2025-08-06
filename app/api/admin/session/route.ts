import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"
import { cookies } from "next/headers"

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const sessionToken = cookieStore.get("admin_session_token")?.value

    if (!sessionToken) {
      return NextResponse.json({ error: "No admin session" }, { status: 401 })
    }

    const supabase = getSupabaseServerClient()
    
    // Проверяем сессию админа
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, is_admin")
      .eq("id", sessionToken)
      .single()

    if (error || !user || !user.is_admin) {
      return NextResponse.json({ error: "Invalid admin session" }, { status: 401 })
    }

    return NextResponse.json({
      adminId: user.id,
      username: user.username,
      isAdmin: user.is_admin
    })
  } catch (error) {
    console.error("Error checking admin session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 