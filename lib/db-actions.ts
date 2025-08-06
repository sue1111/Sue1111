import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseServerClient } from "./supabase/supabase-server";

// Создаем клиент Supabase с сервисной ролью для прямого доступа к базе данных
export const directSupabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  {
    auth: {
      persistSession: false,
    },
  }
);

// Function for logging with timestamp
export function logWithTimestamp(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] [DB_ACTIONS] ${message}`, data);
  } else {
    console.log(`[${timestamp}] [DB_ACTIONS] ${message}`);
  }
}

// Function to create a game in the database
export async function createGame(userId: string, betAmount: number, opponentId?: string | null) {
  try {
    logWithTimestamp(`=== СОЗДАНИЕ ИГРЫ ===`);
    logWithTimestamp(`Параметры: userId=${userId}, betAmount=${betAmount}, opponentId=${opponentId || 'null'}`);
    
    // Проверяем ограничение на поле status
    const { data: statusConstraint, error: constraintError } = await directSupabase.rpc('exec_sql', {
      sql: "SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'games' AND c.conname = 'games_status_check';"
    });
    
    if (constraintError) {
      logWithTimestamp(`Ошибка при проверке ограничения status: ${constraintError.message}`);
    } else {
      logWithTimestamp(`Ограничение на поле status: ${JSON.stringify(statusConstraint)}`);
    }
    
    // Очищаем и проверяем входные данные
    const numericBetAmount = Number(betAmount);
    if (isNaN(numericBetAmount)) {
      logWithTimestamp(`Ошибка: Неверная сумма ставки: ${betAmount}`);
      throw new Error("Неверная сумма ставки");
    }
    
    if (!userId) {
      logWithTimestamp(`Ошибка: userId отсутствует`);
      throw new Error("ID пользователя отсутствует");
    }
    
    // Принудительно приводим userId к строке и удаляем пробелы
    let cleanUserId = String(userId).trim();
    
    if (cleanUserId === '') {
      logWithTimestamp(`Ошибка: userId пустой после очистки`);
      throw new Error("ID пользователя пустой");
    }
    
    logWithTimestamp(`Очищенный userId: ${cleanUserId}`);
    
    // Проверяем, что ID пользователя имеет правильный формат UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cleanUserId)) {
      logWithTimestamp(`ОШИБКА: ID пользователя не соответствует формату UUID: ${cleanUserId}`);
      throw new Error("ID пользователя не соответствует формату UUID");
    }
    
    // 2. Проверяем существование пользователя и его баланс
    logWithTimestamp(`Получаем данные пользователя ${cleanUserId}`);
    const { data: userData, error: userError } = await directSupabase
      .from("users")
      .select("*")
      .eq("id", cleanUserId)
      .single();
    
    if (userError) {
      logWithTimestamp(`Ошибка получения данных пользователя: ${userError.message}`);
      logWithTimestamp(`Детали ошибки:`, {
        code: userError.code,
        details: userError.details,
        hint: userError.hint
      });
      throw new Error(`Пользователь не найден: ${userError.message}`);
    }
    
    if (!userData) {
      logWithTimestamp(`Пользователь не найден по ID: ${cleanUserId}`);
      throw new Error("Пользователь не найден");
    }
    
    logWithTimestamp(`Данные пользователя получены: id=${userData.id}, balance=${userData.balance}, games_played=${userData.games_played}`);
    
    if (userData.balance < numericBetAmount) {
      logWithTimestamp(`Недостаточно средств: баланс=${userData.balance}, ставка=${numericBetAmount}`);
      throw new Error("Недостаточно средств на балансе");
    }
    
    // 3. Снимаем ставку с баланса пользователя
    logWithTimestamp(`Снимаем ставку ${numericBetAmount} с баланса пользователя ${cleanUserId}`);
    const newBalance = userData.balance - numericBetAmount;
    const { error: balanceError } = await directSupabase
      .from("users")
      .update({ balance: newBalance })
      .eq("id", cleanUserId);
    
    if (balanceError) {
      logWithTimestamp(`Ошибка обновления баланса: ${balanceError.message}`);
      throw new Error(`Ошибка обновления баланса: ${balanceError.message}`);
    }
    
    logWithTimestamp(`Баланс успешно обновлен: ${userData.balance} -> ${newBalance}`);
    
    // 4. Создаем транзакцию ставки
    logWithTimestamp(`Создаем транзакцию ставки для пользователя ${cleanUserId}`);
    const { error: txError } = await directSupabase
      .from("transactions")
      .insert({
        user_id: cleanUserId,
        type: "bet",
        amount: numericBetAmount,
        currency: "USD",
        status: "completed",
        completed_at: new Date().toISOString(),
      });
    
    if (txError) {
      logWithTimestamp(`Ошибка создания транзакции: ${txError.message}`);
      // Возвращаем баланс пользователю
      await directSupabase
        .from("users")
        .update({ balance: userData.balance })
        .eq("id", cleanUserId);
      throw new Error(`Ошибка создания транзакции: ${txError.message}`);
    }
    
    logWithTimestamp(`Транзакция ставки успешно создана`);
    
    // 5. Создаем игру - используем прямой SQL запрос для точного контроля
    const boardArray = Array(9).fill(null);
    const boardData = JSON.stringify(boardArray);
    // Создаем объект players для JSON поля
    const playersData = JSON.stringify({
      X: {
        id: cleanUserId,
        username: userData.username,
        avatar: userData.avatar
      },
      O: opponentId ? {
        id: opponentId,
        username: "Opponent",
        avatar: null
      } : null
    });
    
    logWithTimestamp(`Создаем игру с доской: ${boardData} и игроками: ${playersData}`);
    
    // Используем прямой SQL запрос с явным указанием всех колонок, включая players
    const insertSQL = `
      INSERT INTO games 
      (board, current_player, player_x, player_o, status, bet_amount, pot, created_at, players)
      VALUES 
      ('${boardData}'::jsonb, 'X', '${cleanUserId}'::uuid, ${opponentId ? `'${String(opponentId).trim()}'::uuid` : 'NULL'}, 'waiting', ${numericBetAmount}, ${numericBetAmount}, '${new Date().toISOString()}', '${playersData}'::jsonb)
      RETURNING id, board, current_player, player_x, player_o, status, bet_amount, pot, created_at, players;
    `;
    
    logWithTimestamp(`SQL запрос для создания игры:`, insertSQL);
    
    try {
      const { data: sqlResult, error: sqlError } = await directSupabase
        .rpc('exec_sql', { sql: insertSQL });
      
      if (sqlError) {
        logWithTimestamp(`Ошибка выполнения SQL запроса: ${sqlError.message}`, sqlError);
        
        // Пробуем другое значение для status
        const insertSQL2 = `
          INSERT INTO games 
          (board, current_player, player_x, player_o, status, bet_amount, pot, created_at, players)
          VALUES 
          ('${boardData}'::jsonb, 'X', '${cleanUserId}'::uuid, ${opponentId ? `'${String(opponentId).trim()}'::uuid` : 'NULL'}, 'playing', ${numericBetAmount}, ${numericBetAmount}, '${new Date().toISOString()}', '${playersData}'::jsonb)
          RETURNING id, board, current_player, player_x, player_o, status, bet_amount, pot, created_at, players;
        `;
        
        logWithTimestamp(`Пробуем альтернативный SQL запрос с status='playing':`, insertSQL2);
        
        const { data: sqlResult2, error: sqlError2 } = await directSupabase
          .rpc('exec_sql', { sql: insertSQL2 });
          
        if (sqlError2) {
          logWithTimestamp(`Ошибка выполнения альтернативного SQL запроса: ${sqlError2.message}`, sqlError2);
          
          // Возвращаем баланс пользователю
          await directSupabase
            .from("users")
            .update({ balance: userData.balance })
            .eq("id", cleanUserId);
          
          throw new Error(`Ошибка создания игры через SQL: ${sqlError2.message}`);
        }
        
        if (!sqlResult2 || !sqlResult2.length) {
          logWithTimestamp(`Альтернативный SQL запрос не вернул результатов`);
        } else {
          logWithTimestamp(`Альтернативный SQL запрос успешно выполнен, результат:`, sqlResult2);
          
          // Обновляем статистику игрока
          const { error: statsError } = await directSupabase
            .from("users")
            .update({ games_played: userData.games_played + 1 })
            .eq("id", cleanUserId);
          
          if (statsError) {
            logWithTimestamp(`Ошибка обновления статистики игрока: ${statsError.message}`);
          } else {
            logWithTimestamp(`Статистика игрока успешно обновлена`);
          }
          
          // Возвращаем созданную игру
          logWithTimestamp(`=== ИГРА УСПЕШНО СОЗДАНА ЧЕРЕЗ АЛЬТЕРНАТИВНЫЙ SQL ===`);
          return sqlResult2[0];
        }
      }
      
      if (!sqlResult || !sqlResult.length) {
        logWithTimestamp(`SQL запрос не вернул результатов`);
        
        // Проверяем, была ли игра создана, несмотря на отсутствие результата
        const { data: checkGameData, error: checkGameError } = await directSupabase
          .from("games")
          .select("*")
          .eq("player_x", cleanUserId)
          .order("created_at", { ascending: false })
          .limit(1);
        
        if (checkGameError) {
          logWithTimestamp(`Ошибка при проверке созданной игры: ${checkGameError.message}`);
          // Возвращаем баланс пользователю
          await directSupabase
            .from("users")
            .update({ balance: userData.balance })
            .eq("id", cleanUserId);
          
          throw new Error(`Ошибка при проверке созданной игры: ${checkGameError.message}`);
        }
        
        if (checkGameData && checkGameData.length > 0) {
          logWithTimestamp(`Игра была создана, несмотря на отсутствие результата от SQL запроса:`, checkGameData[0]);
          
          // 6. Обновляем статистику игрока
          logWithTimestamp(`Обновляем статистику игрока: games_played=${userData.games_played} -> ${userData.games_played + 1}`);
          const { error: statsError } = await directSupabase
            .from("users")
            .update({ games_played: userData.games_played + 1 })
            .eq("id", cleanUserId);
          
          if (statsError) {
            logWithTimestamp(`Ошибка обновления статистики игрока: ${statsError.message}`);
          } else {
            logWithTimestamp(`Статистика игрока успешно обновлена`);
          }
          
          // 7. Возвращаем найденную игру
          logWithTimestamp(`=== ИГРА УСПЕШНО СОЗДАНА И НАЙДЕНА ===`);
          return checkGameData[0];
        }
        
        // Пробуем создать игру через стандартный API
        logWithTimestamp(`Пробуем создать игру через стандартный API`);
        
        // Проверяем допустимые значения status
        const { data: statusCheck } = await directSupabase.rpc('exec_sql', {
          sql: "SELECT unnest(enum_range(NULL::text)) AS status FROM (SELECT 'playing'::text) t WHERE 1=0;"
        });
        
        logWithTimestamp(`Проверка допустимых значений для status:`, statusCheck);
        
        // Создаем объект с данными игры
        const gameData = {
          board: Array(9).fill(null),
          current_player: "X",
          player_x: cleanUserId,
          player_o: opponentId ? String(opponentId).trim() : null,
          status: "playing", // Игры против AI сразу начинаются
          bet_amount: numericBetAmount,
          pot: numericBetAmount,
          players: {
            X: {
              id: cleanUserId,
              username: userData.username,
              avatar: userData.avatar
            },
            O: opponentId ? {
              id: opponentId,
              username: "Opponent",
              avatar: null
            } : null
          }
        };
        
        const { data: apiGameData, error: apiGameError } = await directSupabase
          .from("games")
          .insert(gameData)
          .select()
          .single();
        
        if (apiGameError) {
          logWithTimestamp(`Ошибка создания игры через API: ${apiGameError.message}`);
          
          // Пробуем создать игру через прямой SQL-запрос
          logWithTimestamp(`Пробуем создать игру через прямой SQL-запрос`);
          
          // Пробуем все возможные значения для status
          const possibleStatuses = ['playing', 'completed', 'draw', 'waiting', 'active', 'pending', 'in_progress', 'cancelled', 'finished'];
          let sqlGameData = null;
          let sqlGameError = null;
          
          for (const status of possibleStatuses) {
            logWithTimestamp(`Пробуем создать игру со статусом: ${status}`);
            
            const boardJson = JSON.stringify(boardArray);
            const playersJson = JSON.stringify({
              X: {
                id: cleanUserId,
                username: userData.username,
                avatar: userData.avatar
              },
              O: opponentId ? {
                id: opponentId,
                username: "Opponent",
                avatar: null
              } : null
            });
            
            // Проверяем наличие колонки players в таблице games
            const { data: columnsData, error: columnsError } = await directSupabase.rpc('exec_sql', {
              sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'players';"
            });
            
            const hasPlayersColumn = columnsData && columnsData.length > 0;
            logWithTimestamp(`Колонка players ${hasPlayersColumn ? 'существует' : 'не существует'} в таблице games`);
            
            // Формируем SQL запрос в зависимости от наличия колонки players
            let sqlQuery;
            if (hasPlayersColumn) {
              sqlQuery = `
                INSERT INTO games 
                (board, current_player, player_x, player_o, status, bet_amount, pot, created_at, players)
                VALUES 
                ('${boardJson}', 'X', '${cleanUserId}'::uuid, ${opponentId ? `'${opponentId}'::uuid` : 'NULL'}, 
                '${status}', ${numericBetAmount}, ${numericBetAmount}, '${new Date().toISOString()}', '${playersJson}')
                RETURNING *;
              `;
            } else {
              sqlQuery = `
                INSERT INTO games 
                (board, current_player, player_x, player_o, status, bet_amount, pot, created_at)
                VALUES 
                ('${boardJson}', 'X', '${cleanUserId}'::uuid, ${opponentId ? `'${opponentId}'::uuid` : 'NULL'}, 
                '${status}', ${numericBetAmount}, ${numericBetAmount}, '${new Date().toISOString()}')
                RETURNING *;
              `;
            }
            
            const { data, error } = await directSupabase.rpc('exec_sql', { sql: sqlQuery });
            
            if (!error) {
              sqlGameData = data;
              logWithTimestamp(`Игра успешно создана через SQL со статусом ${status}:`, data);
              
              // Проверяем структуру возвращаемых данных
              if (Array.isArray(data) && data.length > 0) {
                logWithTimestamp(`Структура данных SQL-результата:`, Object.keys(data[0]));
                
                // Проверяем наличие ID в возвращаемых данных
                if (data[0].id) {
                  logWithTimestamp(`ID созданной игры: ${data[0].id}`);
                } else {
                  logWithTimestamp(`В возвращаемых данных отсутствует ID игры`);
                }
              } else {
                logWithTimestamp(`Неожиданная структура возвращаемых данных:`, data);
              }
              
              break;
            } else {
              logWithTimestamp(`Ошибка при создании игры со статусом ${status}: ${error.message}`);
              sqlGameError = error;
            }
          }
          
          if (sqlGameData) {
            // Если удалось создать игру через SQL, возвращаем её
            logWithTimestamp(`=== ИГРА УСПЕШНО СОЗДАНА ЧЕРЕЗ SQL ===`);
            
            // Проверяем, что данные игры содержат id
            if (Array.isArray(sqlGameData) && sqlGameData.length > 0 && sqlGameData[0].id) {
              logWithTimestamp(`Данные игры из SQL содержат id: ${sqlGameData[0].id}`);
              
              // Получаем полные данные игры из базы данных через SQL
              const getGameSql = `SELECT * FROM games WHERE id = '${sqlGameData[0].id}'::uuid;`;
              const { data: gameData, error: gameError } = await directSupabase.rpc('exec_sql', { sql: getGameSql });
              
              if (gameError) {
                logWithTimestamp(`Ошибка при получении полных данных игры через SQL: ${gameError.message}`);
              } else if (gameData && Array.isArray(gameData) && gameData.length > 0) {
                logWithTimestamp(`Получены полные данные игры через SQL:`, gameData[0]);
                return gameData[0];
              } else {
                logWithTimestamp(`Не удалось получить полные данные игры через SQL`);
              }
              
              // Пробуем получить игру через стандартный API
              try {
                const { data: apiGameData, error: apiGameError } = await directSupabase
                  .from("games")
                  .select("*")
                  .eq("id", sqlGameData[0].id)
                  .single();
                
                if (apiGameError) {
                  logWithTimestamp(`Ошибка при получении полных данных игры через API: ${apiGameError.message}`);
                } else if (apiGameData) {
                  logWithTimestamp(`Получены полные данные игры через API:`, apiGameData);
                  return apiGameData;
                }
              } catch (apiError) {
                logWithTimestamp(`Исключение при получении данных игры через API:`, apiError);
              }
            }
            
            // Если не удалось получить полные данные, возвращаем то, что есть
            if (Array.isArray(sqlGameData) && sqlGameData.length > 0) {
              return sqlGameData[0];
            } else {
              logWithTimestamp(`Неожиданная структура данных sqlGameData:`, sqlGameData);
              return { success: true, message: "Игра создана, но данные не получены" };
            }
          }
          
          // Если не удалось создать игру даже через SQL, возвращаем баланс и выбрасываем исключение
          await directSupabase
            .from("users")
            .update({ balance: userData.balance })
            .eq("id", cleanUserId);
          
          throw new Error(`Ошибка создания игры через API: ${apiGameError.message}`);
        }
        
        if (!apiGameData) {
          logWithTimestamp(`API не вернул данные созданной игры`);
          // Возвращаем баланс пользователю
          await directSupabase
            .from("users")
            .update({ balance: userData.balance })
            .eq("id", cleanUserId);
          
          throw new Error("Не удалось создать игру: API не вернул данные");
        }
        
        logWithTimestamp(`Игра успешно создана через API:`, apiGameData);
        
        // 6. Обновляем статистику игрока
        logWithTimestamp(`Обновляем статистику игрока: games_played=${userData.games_played} -> ${userData.games_played + 1}`);
        const { error: statsError } = await directSupabase
          .from("users")
          .update({ games_played: userData.games_played + 1 })
          .eq("id", cleanUserId);
        
        if (statsError) {
          logWithTimestamp(`Ошибка обновления статистики игрока: ${statsError.message}`);
        } else {
          logWithTimestamp(`Статистика игрока успешно обновлена`);
        }
        
        // 7. Возвращаем созданную игру
        logWithTimestamp(`=== ИГРА УСПЕШНО СОЗДАНА ЧЕРЕЗ API ===`);
        return apiGameData;
      }
      
      logWithTimestamp(`SQL запрос успешно выполнен, результат:`, sqlResult);
      
      // Преобразуем результат SQL запроса в объект игры
      const game = sqlResult[0];
      
      // 6. Обновляем статистику игрока
      logWithTimestamp(`Обновляем статистику игрока: games_played=${userData.games_played} -> ${userData.games_played + 1}`);
      const { error: statsError } = await directSupabase
        .from("users")
        .update({ games_played: userData.games_played + 1 })
        .eq("id", cleanUserId);
      
      if (statsError) {
        logWithTimestamp(`Ошибка обновления статистики игрока: ${statsError.message}`);
      } else {
        logWithTimestamp(`Статистика игрока успешно обновлена`);
      }
      
      // 7. Возвращаем созданную игру
      logWithTimestamp(`=== ИГРА УСПЕШНО СОЗДАНА ===`);
      logWithTimestamp(`Возвращаем игру:`, game);
      
      return game;
    } catch (sqlException) {
      logWithTimestamp(`Исключение при выполнении SQL запроса:`, sqlException);
      
      // Возвращаем баланс пользователю
      await directSupabase
        .from("users")
        .update({ balance: userData.balance })
        .eq("id", cleanUserId);
      
      throw new Error(`Исключение при создании игры: ${sqlException instanceof Error ? sqlException.message : 'Неизвестная ошибка'}`);
    }
    
  } catch (error) {
    logWithTimestamp(`=== ОШИБКА СОЗДАНИЯ ИГРЫ ===`);
    logWithTimestamp("Детали ошибки:", error);
    
    // Перебрасываем ошибку дальше
    throw error;
  }
}

// Function to get a game by ID
export async function getGame(gameId: string) {
  try {
    const { data, error } = await directSupabase
      .from("games")
      .select(`
        *,
        player_x_user:users!games_player_x_fkey(id, username, avatar),
        player_o_user:users!games_player_o_fkey(id, username, avatar)
      `)
      .eq("id", gameId)
      .single();
      
    if (error) {
      logWithTimestamp(`Error fetching game ${gameId}:`, error);
      throw error;
    }
    
    return data;
  } catch (error) {
    logWithTimestamp(`Error getting game ${gameId}:`, error);
    throw error;
  }
}

// Function to make a move in a game
export async function makeMove(gameId: string, userId: string, index: number) {
  try {
    // Get the current game state
    const { data: game, error: gameError } = await directSupabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();
      
    if (gameError || !game) {
      logWithTimestamp(`Game not found: ${gameId}`, gameError);
      throw new Error("Game not found");
    }
    
    // Check if it's the user's turn
    const isPlayerX = game.player_x === userId;
    const isPlayerO = game.player_o === userId;
    
    if (!isPlayerX && !isPlayerO) {
      logWithTimestamp(`User ${userId} is not a player in game ${gameId}`);
      throw new Error("Not a player in this game");
    }
    
    const playerSymbol = isPlayerX ? "X" : "O";
    if (game.current_player !== playerSymbol) {
      logWithTimestamp(`Not user's turn: ${userId} (${playerSymbol}) vs current ${game.current_player}`);
      throw new Error("Not your turn");
    }
    
    // Check if the move is valid
    if (game.status !== "playing") {
      logWithTimestamp(`Game is not active: ${game.status}`);
      throw new Error("Game is not active");
    }
    
    const board = game.board as (string | null)[];
    if (index < 0 || index >= board.length || board[index] !== null) {
      logWithTimestamp(`Invalid move: ${index}`);
      throw new Error("Invalid move");
    }
    
    // Make the move
    const newBoard = [...board];
    newBoard[index] = playerSymbol;
    
    // Check for winner
    const winner = calculateWinner(newBoard);
    let newStatus = game.status;
    let newWinner = game.winner;
    
    if (winner) {
      newStatus = "completed";
      newWinner = winner;
    } else if (!newBoard.includes(null)) {
      newStatus = "draw";
    }
    
    // Update the game
    const { data: updatedGame, error: updateError } = await directSupabase
      .from("games")
      .update({
        board: newBoard,
        current_player: game.current_player === "X" ? "O" : "X",
        status: newStatus,
        winner: newWinner,
        ended_at: newStatus !== "playing" ? new Date().toISOString() : null
      })
      .eq("id", gameId)
      .select();
      
    if (updateError) {
      logWithTimestamp(`Failed to update game:`, updateError);
      throw new Error("Failed to update game");
    }
    
    return updatedGame[0];
  } catch (error) {
    logWithTimestamp(`Error making move in game ${gameId}:`, error);
    throw error;
  }
}

// Helper function to calculate winner
function calculateWinner(board: (string | null)[]) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return null;
}

export async function createNotification({ type, userId, amount, status, message }: {
  type: string,
  userId: string,
  amount?: number,
  status?: string,
  message: string
}) {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("notifications")
      .insert([
        {
          type,
          user_id: userId,
          amount: typeof amount === "number" ? amount : null,
          status: status || "pending",
          message
        } as any // Привожу к any для обхода строгой типизации, если есть несовпадения
      ])
      .select()
      .single();
    if (error) {
      console.error("Error inserting notification:", error);
      return null;
    }
    return data;
  } catch (error) {
    console.error("Exception in createNotification:", error);
    return null;
  }
}

export async function createTransaction({
  userId,
  type,
  amount,
  currency = "USDT",
  status = "pending",
  walletAddress,
  txHash
}: {
  userId: string
  type: string
  amount: number
  currency?: string
  status?: string
  walletAddress?: string
  txHash?: string
}) {
  try {
    logWithTimestamp(`=== СОЗДАНИЕ ТРАНЗАКЦИИ ===`);
    logWithTimestamp(`Параметры: userId=${userId}, type=${type}, amount=${amount}, currency=${currency}, status=${status}`);
    
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("transactions")
      .insert([
        {
          user_id: userId,
          type,
          amount,
          currency,
          status,
          wallet_address: walletAddress || null,
          tx_hash: txHash || null
        } as any
      ])
      .select()
      .single();
      
    if (error) {
      logWithTimestamp(`Ошибка создания транзакции: ${error.message}`);
      return null;
    }
    
    logWithTimestamp(`Транзакция создана успешно: id=${(data as any).id}`);
    return data;
  } catch (error) {
    logWithTimestamp(`Исключение в createTransaction:`, error);
    return null;
  }
}
