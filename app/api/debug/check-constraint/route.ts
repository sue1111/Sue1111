import { NextResponse } from "next/server";
import { directSupabase, logWithTimestamp } from "@/lib/db-actions";

export async function GET(request: Request) {
  try {
    logWithTimestamp("=== ПРОВЕРКА ОГРАНИЧЕНИЯ STATUS В ТАБЛИЦЕ GAMES ===");
    
    // Получаем точное определение ограничения
    const { data: constraint, error: constraintError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'games' AND conname = 'games_status_check';"
    });
    
    logWithTimestamp("Определение ограничения status:", constraint);
    
    // Проверяем существующие значения status в таблице
    const { data: existingValues, error: valuesError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT DISTINCT status FROM games;"
    });
    
    logWithTimestamp("Существующие значения status:", existingValues);
    
    // Проверяем каждое возможное значение status
    const testValues = ["waiting", "playing", "completed", "draw", "active", "pending", "in_progress"];
    const testResults = [];
    
    for (const status of testValues) {
      try {
        const testSql = `
          WITH test_insert AS (
            INSERT INTO games 
            (board, current_player, player_x, player_o, status, bet_amount, pot, created_at, players)
            VALUES 
            ('[null,null,null,null,null,null,null,null,null]'::jsonb, 'X', '00000000-0000-0000-0000-000000000000'::uuid, NULL, 
            '${status}', 1, 1, '${new Date().toISOString()}', '{"X":{"id":"00000000-0000-0000-0000-000000000000","username":"Test","avatar":null},"O":null}'::jsonb)
            RETURNING id
          )
          DELETE FROM games WHERE id IN (SELECT id FROM test_insert) RETURNING id;
        `;
        
        const { data, error } = await directSupabase.rpc('exec_sql', { sql: testSql });
        
        testResults.push({
          status,
          success: !error,
          error: error ? error.message : null,
          data
        });
        
        logWithTimestamp(`Тест для status='${status}': ${error ? 'ОШИБКА' : 'УСПЕХ'}`);
      } catch (e) {
        testResults.push({
          status,
          success: false,
          error: e instanceof Error ? e.message : "Неизвестная ошибка"
        });
        
        logWithTimestamp(`Исключение при тесте для status='${status}': ${e instanceof Error ? e.message : "Неизвестная ошибка"}`);
      }
    }
    
    // Получаем SQL для создания таблицы games
    const { data: tableDDL, error: ddlError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT table_name, column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'status';"
    });
    
    logWithTimestamp("Определение колонки status:", tableDDL);
    
    return NextResponse.json({
      success: true,
      constraint,
      existingValues,
      testResults,
      tableDDL,
      message: "Проверка ограничения status выполнена",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logWithTimestamp("=== ОШИБКА В ЭНДПОИНТЕ DEBUG/CHECK-CONSTRAINT ===");
    logWithTimestamp("Ошибка:", error);
    
    return NextResponse.json({ 
      success: false, 
      message: "Ошибка при проверке ограничения status", 
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 