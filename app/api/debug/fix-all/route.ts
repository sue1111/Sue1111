import { NextResponse } from "next/server";
import { directSupabase, logWithTimestamp } from "@/lib/db-actions";

export async function GET(request: Request) {
  try {
    logWithTimestamp("=== ИСПРАВЛЕНИЕ ВСЕХ ПРОБЛЕМ С БАЗОЙ ДАННЫХ ===");
    
    // 1. Проверяем и добавляем колонку players, если она отсутствует
    logWithTimestamp("1. Проверка колонки players");
    const { data: playersColumn, error: columnsError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'players';"
    });
    
    const hasPlayersColumn = playersColumn && playersColumn.length > 0;
    logWithTimestamp(`Колонка players ${hasPlayersColumn ? 'существует' : 'не существует'} в таблице games`);
    
    let addColumnResult = null;
    let addColumnError = null;
    
    if (!hasPlayersColumn) {
      logWithTimestamp("Добавляем колонку players в таблицу games");
      const { data, error } = await directSupabase.rpc('exec_sql', {
        sql: "ALTER TABLE games ADD COLUMN players JSONB;"
      });
      
      addColumnResult = data;
      addColumnError = error;
      
      if (error) {
        logWithTimestamp(`Ошибка при добавлении колонки players: ${error.message}`);
      } else {
        logWithTimestamp("Колонка players успешно добавлена");
      }
    }
    
    // 2. Исправляем ограничение status
    logWithTimestamp("2. Исправление ограничения status");
    const { data: oldConstraint, error: oldConstraintError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'games' AND conname = 'games_status_check';"
    });
    
    logWithTimestamp("Текущее ограничение status:", oldConstraint);
    
    let dropConstraintResult = null;
    let dropConstraintError = null;
    let addConstraintResult = null;
    let addConstraintError = null;
    
    // Удаляем старое ограничение
    const { data: dropResult, error: dropError } = await directSupabase.rpc('exec_sql', {
      sql: "ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;"
    });
    
    dropConstraintResult = dropResult;
    dropConstraintError = dropError;
    
    if (dropError) {
      logWithTimestamp(`Ошибка при удалении ограничения status: ${dropError.message}`);
    } else {
      logWithTimestamp("Ограничение status успешно удалено");
      
      // Добавляем новое ограничение
      const { data: addResult, error: addError } = await directSupabase.rpc('exec_sql', {
        sql: "ALTER TABLE games ADD CONSTRAINT games_status_check CHECK (status IN ('waiting', 'playing', 'completed', 'draw'));"
      });
      
      addConstraintResult = addResult;
      addConstraintError = addError;
      
      if (addError) {
        logWithTimestamp(`Ошибка при добавлении нового ограничения status: ${addError.message}`);
      } else {
        logWithTimestamp("Новое ограничение status успешно добавлено");
      }
    }
    
    // 3. Проверяем новое ограничение
    const { data: newConstraint, error: newConstraintError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'games' AND conname = 'games_status_check';"
    });
    
    logWithTimestamp("Новое ограничение status:", newConstraint);
    
    // 4. Тестируем создание игры
    logWithTimestamp("4. Тестирование создания игры");
    const testGameData = {
      board: Array(9).fill(null),
      current_player: "X",
      player_x: "00000000-0000-0000-0000-000000000000",
      player_o: null,
      status: "playing", // Игры против AI сразу начинаются
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
    
    let testGameResult = null;
    let testGameError = null;
    
    try {
      const { data, error } = await directSupabase
        .from("games")
        .insert(testGameData)
        .select()
        .single();
      
      testGameResult = data;
      testGameError = error;
      
      if (error) {
        logWithTimestamp(`Ошибка при создании тестовой игры: ${error.message}`);
      } else {
        logWithTimestamp("Тестовая игра успешно создана");
        
        // Удаляем тестовую игру
        await directSupabase
          .from("games")
          .delete()
          .eq("id", data.id);
      }
    } catch (e) {
      testGameError = e;
      logWithTimestamp(`Исключение при создании тестовой игры: ${e instanceof Error ? e.message : "Неизвестная ошибка"}`);
    }
    
    return NextResponse.json({
      success: !testGameError,
      playersColumn: {
        existed: hasPlayersColumn,
        added: !hasPlayersColumn && !addColumnError,
        error: addColumnError ? addColumnError.message : null
      },
      statusConstraint: {
        old: oldConstraint,
        dropped: !dropConstraintError,
        added: !addConstraintError,
        new: newConstraint,
        dropError: dropConstraintError ? dropConstraintError.message : null,
        addError: addConstraintError ? addConstraintError.message : null
      },
      testGame: {
        success: !testGameError,
        error: testGameError ? (testGameError instanceof Error ? testGameError.message : String(testGameError)) : null,
        data: testGameResult
      },
      message: !testGameError ? "Все проблемы с базой данных успешно исправлены" : "Не удалось исправить все проблемы с базой данных",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logWithTimestamp("=== ОШИБКА В ЭНДПОИНТЕ DEBUG/FIX-ALL ===");
    logWithTimestamp("Ошибка:", error);
    
    return NextResponse.json({ 
      success: false, 
      message: "Ошибка при исправлении проблем с базой данных", 
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 