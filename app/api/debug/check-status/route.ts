import { NextResponse } from "next/server";
import { directSupabase, logWithTimestamp } from "@/lib/db-actions";

export async function GET(request: Request) {
  try {
    logWithTimestamp("=== ПРОВЕРКА ДОПУСТИМЫХ ЗНАЧЕНИЙ STATUS ===");
    
    // Проверяем ограничение на поле status
    const { data: statusConstraint, error: constraintError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'games' AND c.conname = 'games_status_check';"
    });
    
    // Получаем текущие значения status в таблице
    const { data: currentStatus, error: statusError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT DISTINCT status FROM games ORDER BY status;"
    });
    
    // Пробуем создать тестовые игры с разными значениями status
    const testStatuses = ["waiting", "playing", "completed", "draw"];
    const testResults = [];
    
    for (const status of testStatuses) {
      const gameData = {
        board: Array(9).fill(null),
        current_player: "X",
        player_x: "00000000-0000-0000-0000-000000000000",
        player_o: null,
        status: status,
        bet_amount: 1,
        pot: 1,
        players: {
          X: {
            id: "00000000-0000-0000-0000-000000000000",
            username: "Test User",
            avatar: null
          },
          O: null
        }
      };
      
      try {
        const { data, error } = await directSupabase
          .from("games")
          .insert(gameData)
          .select();
        
        testResults.push({
          status,
          success: !error,
          error: error ? error.message : null,
          data: data ? data.length : 0
        });
        
        // Удаляем тестовую запись, если она была создана
        if (data && data.length > 0 && data[0].id) {
          await directSupabase
            .from("games")
            .delete()
            .eq("id", data[0].id);
        }
      } catch (e) {
        testResults.push({
          status,
          success: false,
          error: e instanceof Error ? e.message : "Неизвестная ошибка"
        });
      }
    }
    
    // Проверяем структуру таблицы
    const { data: tableStructure, error: tableError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'games' ORDER BY ordinal_position;"
    });
    
    return NextResponse.json({
      success: true,
      statusConstraint: statusConstraint || [],
      currentStatusValues: currentStatus || [],
      testResults,
      tableStructure: tableStructure || [],
      message: "Проверка допустимых значений status выполнена",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logWithTimestamp("=== ОШИБКА В ЭНДПОИНТЕ DEBUG/CHECK-STATUS ===");
    logWithTimestamp("Ошибка:", error);
    
    return NextResponse.json({ 
      success: false, 
      message: "Ошибка при проверке допустимых значений status", 
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 