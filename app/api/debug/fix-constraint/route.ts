import { NextResponse } from "next/server";
import { directSupabase, logWithTimestamp } from "@/lib/db-actions";

export async function GET(request: Request) {
  try {
    logWithTimestamp("=== ИСПРАВЛЕНИЕ ОГРАНИЧЕНИЯ STATUS В ТАБЛИЦЕ GAMES ===");
    
    // Получаем текущее определение ограничения
    const { data: oldConstraint, error: oldConstraintError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'games' AND conname = 'games_status_check';"
    });
    
    logWithTimestamp("Старое определение ограничения:", oldConstraint);
    
    // Удаляем старое ограничение
    const { data: dropResult, error: dropError } = await directSupabase.rpc('exec_sql', {
      sql: "ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;"
    });
    
    if (dropError) {
      logWithTimestamp(`Ошибка при удалении ограничения: ${dropError.message}`);
      return NextResponse.json({ 
        success: false, 
        message: "Ошибка при удалении ограничения", 
        error: dropError.message 
      }, { status: 500 });
    }
    
    logWithTimestamp("Старое ограничение удалено");
    
    // Добавляем новое ограничение, которое допускает все необходимые значения
    const { data: addResult, error: addError } = await directSupabase.rpc('exec_sql', {
      sql: "ALTER TABLE games ADD CONSTRAINT games_status_check CHECK (status IN ('waiting', 'playing', 'completed', 'draw'));"
    });
    
    if (addError) {
      logWithTimestamp(`Ошибка при добавлении нового ограничения: ${addError.message}`);
      return NextResponse.json({ 
        success: false, 
        message: "Ошибка при добавлении нового ограничения", 
        error: addError.message 
      }, { status: 500 });
    }
    
    logWithTimestamp("Новое ограничение добавлено");
    
    // Получаем новое определение ограничения
    const { data: newConstraint, error: newConstraintError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'games' AND conname = 'games_status_check';"
    });
    
    logWithTimestamp("Новое определение ограничения:", newConstraint);
    
    // Тестируем создание игры с каждым из допустимых значений status
    const testValues = ["waiting", "playing", "completed", "draw"];
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
    
    return NextResponse.json({
      success: true,
      oldConstraint,
      dropResult,
      addResult,
      newConstraint,
      testResults,
      message: "Ограничение status успешно исправлено",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logWithTimestamp("=== ОШИБКА В ЭНДПОИНТЕ DEBUG/FIX-CONSTRAINT ===");
    logWithTimestamp("Ошибка:", error);
    
    return NextResponse.json({ 
      success: false, 
      message: "Ошибка при исправлении ограничения status", 
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 