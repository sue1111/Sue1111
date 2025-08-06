import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from "./database.types"

// Create a single supabase client for the browser (Next.js recommended way)
const createBrowserClient = () => {
  return createPagesBrowserClient<Database>()
}

// Create a single supabase client for server components
import { createClient } from "@supabase/supabase-js"
const createServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    },
  })
}

// Singleton pattern for client-side Supabase client
let browserClient: ReturnType<typeof createBrowserClient> | null = null

export const getSupabaseBrowserClient = () => {
  if (!browserClient) {
    browserClient = createBrowserClient()
  }
  return browserClient
}

export const getSupabaseServerClient = () => {
  return createServerClient()
}

export const getSupabaseClient = () => {
  return getSupabaseBrowserClient()
}

// Для совместимости (если где-то используется напрямую)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

export const supabase = createPagesBrowserClient<Database>()
