import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseServerClient()
    const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false }).limit(10)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ users: data || [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
