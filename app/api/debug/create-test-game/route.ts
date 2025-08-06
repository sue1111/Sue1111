import { NextResponse } from "next/server";
import { directSupabase, logWithTimestamp } from "@/lib/db-actions";

export async function GET(request: Request) {
  try {
    logWithTimestamp("=== ТЕСТОВОЕ СОЗДАНИЕ ИГРЫ ===");
    
    // Создаем тестовую игру с минимальными данными
    const gameData = {
      board: Array(9).fill(null),
      current_player: "X",
      player_x: "00000000-0000-0000-0000-000000000000", // Тестовый UUID
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
    
    logWithTimestamp("Создаем тестовую игру с данными:", gameData);
    
    // Пробуем создать игру через стандартный API
    const { data: game, error: gameError } = await directSupabase
      .from("games")
      .insert(gameData)
      .select()
      .single();
    
    if (gameError) {
      logWithTimestamp(`Ошибка при создании тестовой игры через API: ${gameError.message}`);
      
      // Пробуем через SQL
      const boardJson = JSON.stringify(Array(9).fill(null));
      const playersJson = JSON.stringify({
        X: {
          id: "00000000-0000-0000-0000-000000000000",
          username: "Test User",
          avatar: null
        },
        O: null
      });
      
      const sqlQuery = `
        INSERT INTO games 
        (board, current_player, player_x, player_o, status, bet_amount, pot, created_at, players)
        VALUES 
        ('${boardJson}'::jsonb, 'X', '00000000-0000-0000-0000-000000000000'::uuid, NULL, 
        'waiting', 1, 1, '${new Date().toISOString()}', '${playersJson}'::jsonb)
        RETURNING id, board, current_player, player_x, player_o, status, bet_amount, pot, created_at, players;
      `;
      
      const { data: sqlResult, error: sqlError } = await directSupabase.rpc('exec_sql', { sql: sqlQuery });
      
      if (sqlError) {
        logWithTimestamp(`Ошибка при создании тестовой игры через SQL: ${sqlError.message}`);
        return NextResponse.json({ 
          success: false, 
          message: "Не удалось создать тестовую игру", 
          apiError: gameError.message,
          sqlError: sqlError.message
        });
      } else {
        logWithTimestamp("Тестовая игра успешно создана через SQL:", sqlResult);
        return NextResponse.json({ 
          success: true, 
          message: "Тестовая игра успешно создана через SQL", 
          game: sqlResult && sqlResult.length > 0 ? sqlResult[0] : null,
          apiError: gameError.message
        });
      }
    } else {
      logWithTimestamp("Тестовая игра успешно создана через API:", game);
      return NextResponse.json({ 
        success: true, 
        message: "Тестовая игра успешно создана через API", 
        game
      });
    }
  } catch (error) {
    logWithTimestamp("=== ОШИБКА В ЭНДПОИНТЕ DEBUG/CREATE-TEST-GAME ===");
    logWithTimestamp("Ошибка:", error);
    
    return NextResponse.json({ 
      success: false, 
      message: "Ошибка при создании тестовой игры", 
      error: error instanceof Error ? error.message : "Неизвестная ошибка"
    }, { status: 500 });
  }
} 