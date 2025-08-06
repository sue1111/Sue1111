import { NextResponse } from "next/server";
import { directSupabase, logWithTimestamp } from "@/lib/db-actions";

export async function GET(request: Request) {
  try {
    logWithTimestamp("=== ЗАПРОС ОТЛАДОЧНОЙ ИНФОРМАЦИИ О ИГРАХ ===");
    
    // Получаем все игры
    const { data: games, error: gamesError } = await directSupabase
      .from("games")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (gamesError) {
      logWithTimestamp(`Ошибка при получении списка игр: ${gamesError.message}`);
      return NextResponse.json({ 
        error: "Ошибка при получении списка игр", 
        details: gamesError.message 
      }, { status: 500 });
    }
    
    // Получаем структуру таблицы games
    const { data: tableStructure, error: tableError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'games' ORDER BY ordinal_position;"
    });
    
    // Проверяем ограничения на поле status
    const { data: statusConstraint, error: constraintError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'games' AND c.conname = 'games_status_check';"
    });
    
    // Получаем количество игр
    const { data: gamesCount, error: countError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT COUNT(*) FROM games;"
    });
    
    // Получаем информацию о последней созданной игре
    const { data: lastGame, error: lastGameError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT * FROM games ORDER BY created_at DESC LIMIT 1;"
    });
    
    // Проверяем наличие поля players
    const { data: playersColumn, error: playersError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'players';"
    });
    
    // Проверяем значения в поле players
    const { data: playersValues, error: valuesError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT id, players FROM games WHERE players IS NOT NULL ORDER BY created_at DESC LIMIT 5;"
    });
    
    return NextResponse.json({
      success: true,
      games: games || [],
      tableStructure: tableStructure || [],
      statusConstraint: statusConstraint || [],
      gamesCount: gamesCount ? gamesCount[0].count : 0,
      lastGame: lastGame && lastGame.length > 0 ? lastGame[0] : null,
      playersColumn: playersColumn || [],
      playersValues: playersValues || [],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logWithTimestamp("=== ОШИБКА В ЭНДПОИНТЕ DEBUG/GAMES ===");
    logWithTimestamp("Ошибка:", error);
    
    return NextResponse.json({ 
      error: "Ошибка при получении отладочной информации", 
      details: error instanceof Error ? error.message : "Неизвестная ошибка",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 