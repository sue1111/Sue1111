import { NextResponse } from "next/server";
import { directSupabase, logWithTimestamp } from "@/lib/db-actions";

export async function GET(request: Request) {
  try {
    logWithTimestamp("=== ПРОВЕРКА И ИСПРАВЛЕНИЕ ТАБЛИЦЫ GAMES ===");
    
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
    
    // Проверяем ограничение на поле status
    const { data: statusConstraint, error: constraintError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'games' AND c.conname = 'games_status_check';"
    });
    
    logWithTimestamp("Ограничение на поле status:", statusConstraint);
    
    // Проверяем существующие игры без значения players
    const { data: gamesWithoutPlayers, error: gamesError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT id, player_x, player_o FROM games WHERE players IS NULL LIMIT 10;"
    });
    
    const hasGamesWithoutPlayers = gamesWithoutPlayers && gamesWithoutPlayers.length > 0;
    logWithTimestamp(`Найдено ${hasGamesWithoutPlayers ? gamesWithoutPlayers.length : 0} игр без значения players`);
    
    let updateResult = null;
    let updateError = null;
    
    // Если есть игры без значения players, обновляем их
    if (hasGamesWithoutPlayers) {
      logWithTimestamp("Обновляем игры без значения players");
      
      for (const game of gamesWithoutPlayers) {
        // Получаем данные игроков
        const { data: playerXData, error: playerXError } = await directSupabase
          .from("users")
          .select("id, username, avatar")
          .eq("id", game.player_x)
          .single();
        
        if (playerXError) {
          logWithTimestamp(`Ошибка при получении данных игрока X: ${playerXError.message}`);
          continue;
        }
        
        let playerOData = null;
        if (game.player_o) {
          const { data, error } = await directSupabase
            .from("users")
            .select("id, username, avatar")
            .eq("id", game.player_o)
            .single();
          
          if (!error) {
            playerOData = data;
          }
        }
        
        // Создаем объект players
        const playersData = {
          X: {
            id: playerXData.id,
            username: playerXData.username,
            avatar: playerXData.avatar
          },
          O: playerOData ? {
            id: playerOData.id,
            username: playerOData.username,
            avatar: playerOData.avatar
          } : null
        };
        
        // Обновляем игру
        const { data, error } = await directSupabase
          .from("games")
          .update({ players: playersData })
          .eq("id", game.id);
        
        if (error) {
          logWithTimestamp(`Ошибка при обновлении игры ${game.id}: ${error.message}`);
        } else {
          logWithTimestamp(`Игра ${game.id} успешно обновлена`);
        }
      }
      
      // Проверяем, остались ли игры без значения players
      const { data: remainingGames, error: remainingError } = await directSupabase.rpc('exec_sql', {
        sql: "SELECT COUNT(*) FROM games WHERE players IS NULL;"
      });
      
      updateResult = remainingGames;
      updateError = remainingError;
    }
    
    // Проверяем игры с неправильным значением status
    const { data: gamesWithInvalidStatus, error: invalidStatusError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT id, status FROM games WHERE status NOT IN ('playing', 'completed', 'draw', 'waiting') LIMIT 10;"
    });
    
    const hasGamesWithInvalidStatus = gamesWithInvalidStatus && gamesWithInvalidStatus.length > 0;
    logWithTimestamp(`Найдено ${hasGamesWithInvalidStatus ? gamesWithInvalidStatus.length : 0} игр с неправильным значением status`);
    
    let statusUpdateResult = null;
    let statusUpdateError = null;
    
    // Если есть игры с неправильным значением status, обновляем их
    if (hasGamesWithInvalidStatus) {
      logWithTimestamp("Обновляем игры с неправильным значением status");
      
      for (const game of gamesWithInvalidStatus) {
        // Обновляем игру
        const { data, error } = await directSupabase
          .from("games")
          .update({ status: "waiting" })
          .eq("id", game.id);
        
        if (error) {
          logWithTimestamp(`Ошибка при обновлении игры ${game.id}: ${error.message}`);
        } else {
          logWithTimestamp(`Игра ${game.id} успешно обновлена`);
        }
      }
      
      // Проверяем, остались ли игры с неправильным значением status
      const { data: remainingGames, error: remainingError } = await directSupabase.rpc('exec_sql', {
        sql: "SELECT COUNT(*) FROM games WHERE status NOT IN ('playing', 'completed', 'draw', 'waiting');"
      });
      
      statusUpdateResult = remainingGames;
      statusUpdateError = remainingError;
    }
    
    // Создаем тестовую игру
    const testGameData = {
      board: Array(9).fill(null),
      current_player: "X",
      player_x: "00000000-0000-0000-0000-000000000000",
      player_o: null,
      status: "waiting",
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
    
    const { data: testGame, error: testGameError } = await directSupabase
      .from("games")
      .insert(testGameData)
      .select()
      .single();
    
    if (testGameError) {
      logWithTimestamp(`Ошибка при создании тестовой игры: ${testGameError.message}`);
    } else {
      logWithTimestamp("Тестовая игра успешно создана");
      
      // Удаляем тестовую игру
      await directSupabase
        .from("games")
        .delete()
        .eq("id", testGame.id);
    }
    
    return NextResponse.json({
      success: true,
      playersColumn: {
        exists: hasPlayersColumn,
        data: playersColumn
      },
      alterTable: {
        performed: !hasPlayersColumn,
        result: alterTableResult,
        error: alterTableError ? alterTableError.message : null
      },
      statusConstraint,
      gamesWithoutPlayers: {
        count: hasGamesWithoutPlayers ? gamesWithoutPlayers.length : 0,
        data: gamesWithoutPlayers
      },
      updateResult: {
        performed: hasGamesWithoutPlayers,
        result: updateResult,
        error: updateError ? updateError.message : null
      },
      gamesWithInvalidStatus: {
        count: hasGamesWithInvalidStatus ? gamesWithInvalidStatus.length : 0,
        data: gamesWithInvalidStatus
      },
      statusUpdateResult: {
        performed: hasGamesWithInvalidStatus,
        result: statusUpdateResult,
        error: statusUpdateError ? statusUpdateError.message : null
      },
      testGame: {
        success: !testGameError,
        error: testGameError ? testGameError.message : null,
        data: testGame
      },
      message: "Проверка и исправление таблицы games выполнены",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logWithTimestamp("=== ОШИБКА В ЭНДПОИНТЕ DEBUG/FIX-GAMES-TABLE ===");
    logWithTimestamp("Ошибка:", error);
    
    return NextResponse.json({ 
      success: false, 
      message: "Ошибка при проверке и исправлении таблицы games", 
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 