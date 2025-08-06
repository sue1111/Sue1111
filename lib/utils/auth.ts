import { getSupabaseServerClient } from "@/lib/supabase"

// Helper function to verify admin status based on DB flag
export async function verifyAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseServerClient()
    const { data, error } = await supabase.from("users").select("is_admin").eq("id", userId).single()

    if (error || !data) {
      console.error("Error verifying admin status:", error?.message)
      return false
    }

    return data.is_admin === true
  } catch (error) {
    console.error("Exception in verifyAdmin:", error)
    return false
  }
}

// Helper function to verify user exists
export async function verifyUser(userId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseServerClient()
    const { data, error } = await supabase.from("users").select("id").eq("id", userId).single()

    if (error || !data) {
      console.error("Error verifying user:", error?.message)
      return false
    }

    return true
  } catch (error) {
    console.error("Exception in verifyUser:", error)
    return false
  }
}

// Helper function to check if a user is an admin
export async function isAdmin(userId: string): Promise<boolean> {
  return await verifyAdmin(userId)
}
