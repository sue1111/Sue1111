import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Создаем прямое подключение к Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const directSupabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET() {
  const startTime = Date.now()
  
  let databaseStatus = "unknown"
  
  try {
    // Проверяем подключение к базе данных
    const { data, error } = await directSupabase.from("users").select("count").limit(1)
    
    if (error) {
      console.error("Database health check error:", error)
      databaseStatus = "error"
    } else {
      databaseStatus = "connected"
    }
  } catch (error) {
    console.error("Database connection error:", error)
    databaseStatus = "connection_failed"
  }
  
  const responseTime = Date.now() - startTime
  
  return NextResponse.json({
    status: "healthy",
    database: databaseStatus,
    socket: "not initialized", // Можно добавить проверку сокета, если нужно
    responseTime: `${responseTime}ms`,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    supabaseUrl: supabaseUrl ? "configured" : "missing",
    serviceKey: supabaseServiceKey ? "configured" : "missing"
  })
}

export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const checkDatabase = body.check_database === true
    
    let databaseStatus = "not_checked"
    let databaseDetails = null
    
    if (checkDatabase) {
      try {
        // Проверяем подключение к базе данных
        const { data, error } = await directSupabase.from("users").select("count").limit(1)
        
        if (error) {
          console.error("Database health check error:", error)
          databaseStatus = "error"
          databaseDetails = { error: error.message, code: error.code }
        } else {
          databaseStatus = "connected"
          
          // Проверяем наличие таблиц
          const { data: tablesData, error: tablesError } = await directSupabase.rpc('get_tables')
          
          if (tablesError) {
            databaseDetails = { userCount: data?.[0]?.count || 0, tablesError: tablesError.message }
          } else {
            databaseDetails = { 
              userCount: data?.[0]?.count || 0,
              tables: tablesData || []
            }
            
            // Проверяем структуру таблицы games
            const { data: gamesData, error: gamesError } = await directSupabase
              .from("games")
              .select("count")
              .limit(1)
              
            if (gamesError) {
              databaseDetails.gamesTableError = gamesError.message
            } else {
              databaseDetails.gamesCount = gamesData?.[0]?.count || 0
            }
          }
        }
      } catch (error) {
        console.error("Database connection error:", error)
        databaseStatus = "connection_failed"
        databaseDetails = { error: error instanceof Error ? error.message : "Unknown error" }
      }
    }
    
    const responseTime = Date.now() - startTime
    
    return NextResponse.json({
      status: "healthy",
      database: databaseStatus,
      databaseDetails,
      socket: "not initialized",
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      supabaseUrl: supabaseUrl ? "configured" : "missing",
      serviceKey: supabaseServiceKey ? "configured" : "missing"
    })
  } catch (error) {
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
