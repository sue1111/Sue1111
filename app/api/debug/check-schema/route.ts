import { NextResponse } from "next/server";
import { directSupabase, logWithTimestamp } from "@/lib/db-actions";

export async function GET(request: Request) {
  try {
    logWithTimestamp("=== ПРОВЕРКА СХЕМЫ ТАБЛИЦЫ GAMES ===");
    
    // Получаем структуру таблицы games
    const { data: tableStructure, error: tableError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'games' ORDER BY ordinal_position;"
    });
    
    // Получаем ограничения таблицы games
    const { data: tableConstraints, error: constraintsError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'games';"
    });
    
    // Получаем SQL для создания таблицы games
    const { data: tableDDL, error: ddlError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT table_name, column_name, data_type, column_default, is_nullable, character_maximum_length FROM information_schema.columns WHERE table_name = 'games' ORDER BY ordinal_position;"
    });
    
    // Проверяем существующие значения в таблице games
    const { data: existingGames, error: gamesError } = await directSupabase
      .from("games")
      .select("id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    
    // Получаем содержимое файла schema.sql
    const { data: schemaSql, error: schemaError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'games' AND c.conname = 'games_status_check';"
    });
    
    return NextResponse.json({
      success: true,
      tableStructure: tableStructure || [],
      tableConstraints: tableConstraints || [],
      tableDDL: tableDDL || [],
      existingGames: existingGames || [],
      schemaSql: schemaSql || [],
      message: "Проверка схемы таблицы games выполнена",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logWithTimestamp("=== ОШИБКА В ЭНДПОИНТЕ DEBUG/CHECK-SCHEMA ===");
    logWithTimestamp("Ошибка:", error);
    
    return NextResponse.json({ 
      success: false, 
      message: "Ошибка при проверке схемы таблицы games", 
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 