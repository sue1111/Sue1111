import { NextResponse } from "next/server";
import { directSupabase, logWithTimestamp } from "@/lib/db-actions";

export async function GET(request: Request) {
  try {
    logWithTimestamp("=== ДОБАВЛЕНИЕ КОЛОНКИ PLAYERS В ТАБЛИЦУ GAMES ===");
    
    // Проверяем наличие колонки players
    const { data: playersColumn, error: columnsError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'players';"
    });
    
    const hasPlayersColumn = playersColumn && playersColumn.length > 0;
    logWithTimestamp(`Колонка players ${hasPlayersColumn ? 'существует' : 'не существует'} в таблице games`);
    
    let alterTableResult = null;
    let alterTableError = null;
    
    // Если колонка players не существует, добавляем ее
    if (!hasPlayersColumn) {
      logWithTimestamp("Добавляем колонку players в таблицу games");
      
      const { data, error } = await directSupabase.rpc('exec_sql', {
        sql: "ALTER TABLE games ADD COLUMN players JSONB;"
      });
      
      alterTableResult = data;
      alterTableError = error;
      
      if (error) {
        logWithTimestamp(`Ошибка при добавлении колонки players: ${error.message}`);
      } else {
        logWithTimestamp("Колонка players успешно добавлена");
      }
    }
    
    // Проверяем наличие колонки players после изменения
    const { data: checkColumn, error: checkError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'players';"
    });
    
    const columnExists = checkColumn && checkColumn.length > 0;
    
    // Тестируем создание игры с полем players
    let testResult = null;
    let testError = null;
    
    if (columnExists) {
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
      
      try {
        const { data, error } = await directSupabase
          .from("games")
          .insert(testGameData)
          .select()
          .single();
        
        testResult = data;
        testError = error;
        
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
        testError = e;
        logWithTimestamp(`Исключение при создании тестовой игры: ${e instanceof Error ? e.message : "Неизвестная ошибка"}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      initialCheck: {
        hasPlayersColumn,
        data: playersColumn
      },
      alterTable: {
        performed: !hasPlayersColumn,
        result: alterTableResult,
        error: alterTableError ? alterTableError.message : null
      },
      finalCheck: {
        columnExists,
        data: checkColumn
      },
      test: {
        performed: columnExists,
        success: !testError,
        error: testError ? (testError instanceof Error ? testError.message : String(testError)) : null,
        data: testResult
      },
      message: hasPlayersColumn ? "Колонка players уже существует" : (alterTableError ? "Ошибка при добавлении колонки players" : "Колонка players успешно добавлена"),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logWithTimestamp("=== ОШИБКА В ЭНДПОИНТЕ DEBUG/ADD-PLAYERS-COLUMN ===");
    logWithTimestamp("Ошибка:", error);
    
    return NextResponse.json({ 
      success: false, 
      message: "Ошибка при добавлении колонки players", 
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 