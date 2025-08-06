import { NextResponse } from "next/server";
import { directSupabase, logWithTimestamp } from "@/lib/db-actions";

export async function GET(request: Request) {
  try {
    logWithTimestamp("Testing Supabase connection");
    
    // Check if environment variables are set
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    logWithTimestamp("Environment variables:", { 
      supabaseUrlSet: !!supabaseUrl, 
      supabaseKeySet: !!supabaseKey 
    });
    
    // Check status constraint in games table
    const { data: statusConstraint, error: constraintError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'games' AND c.conname = 'games_status_check';"
    });
    
    logWithTimestamp("Status constraint:", { 
      success: !constraintError, 
      constraint: statusConstraint,
      error: constraintError ? constraintError.message : null
    });
    
    // Check status enum values
    const { data: statusEnum, error: enumError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT unnest(enum_range(NULL::text)) AS status FROM (SELECT 'playing'::text) t WHERE 1=0;"
    });
    
    logWithTimestamp("Status enum values:", { 
      success: !enumError, 
      values: statusEnum,
      error: enumError ? enumError.message : null
    });
    
    // Check current status values in games table
    const { data: currentStatus, error: currentStatusError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT DISTINCT status FROM games;"
    });
    
    logWithTimestamp("Current status values in games table:", { 
      success: !currentStatusError, 
      values: currentStatus,
      error: currentStatusError ? currentStatusError.message : null
    });
    
    // Get table structure for games
    const { data: tableStructure, error: tableError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'games' ORDER BY ordinal_position;"
    });
    
    // Test inserting a game
    const { data: insertResult, error: insertError } = await directSupabase.rpc('exec_sql', {
      sql: `
        INSERT INTO games 
        (board, current_player, player_x, player_o, status, bet_amount, pot, created_at, players)
        VALUES 
        ('${JSON.stringify(Array(9).fill(null))}'::jsonb, 'X', '00000000-0000-0000-0000-000000000000'::uuid, NULL, 
        'playing', 10, 10, '${new Date().toISOString()}', '{"X":{"id":"00000000-0000-0000-0000-000000000000","username":"Test","avatar":null},"O":null}'::jsonb)
        RETURNING id;
      `
    });
    
    logWithTimestamp("Test game inserted successfully:", insertError || insertResult);
    
    // Get recent games
    const { data: recentGames, error: gamesError } = await directSupabase
      .from("games")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    
    // Get recent games with SQL to ensure we get all fields
    const { data: sqlGames, error: sqlGamesError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT * FROM games ORDER BY created_at DESC LIMIT 10;"
    });
    
    logWithTimestamp("Supabase connection successful");
    
    return NextResponse.json({
      success: true,
      message: "Supabase connection successful",
      data: recentGames || [],
      sqlGames: sqlGames || [],
      envInfo: {
        supabaseUrlSet: !!supabaseUrl,
        supabaseKeySet: !!supabaseKey
      },
      tableStructure: tableStructure || [],
      statusConstraint: statusConstraint || [],
      statusValues: currentStatus || [],
      testInsert: {
        success: !insertError,
        error: insertError ? insertError.message : null,
        data: insertResult
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logWithTimestamp("Error testing Supabase connection:", error);
    
    return NextResponse.json({
      success: false,
      message: "Error testing Supabase connection",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 