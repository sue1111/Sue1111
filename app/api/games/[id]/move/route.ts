import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"
import { calculateWinner } from "@/lib/utils/game"
import { getBestMove } from "@/lib/utils/game"
import { createClient } from "@supabase/supabase-js"

// Создаем прямое подключение к Supabase для обхода возможных проблем с серверным клиентом
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const directSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

// Функция для логирования с отметкой времени
function logWithTimestamp(message: string, data?: any) {
  // Logging disabled for security
}

// Обработчик для обновления статистики игрока
async function updatePlayerStats(userId: string, isWin: boolean, winnings: number = 0) {
  try {
    logWithTimestamp(`Updating player stats: userId=${userId}, isWin=${isWin}, winnings=${winnings}`);
    
    // Получаем текущие данные пользователя
    const { data: userData, error: userError } = await directSupabase
      .from("users")
      .select("games_played, games_won, total_winnings")
      .eq("id", userId)
      .single();
      
    if (userError || !userData) {
      logWithTimestamp(`Failed to fetch user data for ${userId}:`, userError);
      return false;
    }
    
    logWithTimestamp(`Current user stats: games_played=${userData.games_played}, games_won=${userData.games_won}, total_winnings=${userData.total_winnings || 0}`);
    
    // Подготавливаем обновления
    const updates: Record<string, any> = {
      games_played: userData.games_played + 1
    };
    
    if (isWin) {
      updates.games_won = userData.games_won + 1;
    }
    
    if (winnings > 0) {
      updates.total_winnings = (userData.total_winnings || 0) + winnings;
    }
    
    logWithTimestamp(`Updating user stats with:`, updates);
    
    // БЕЗОПАСНЫЙ СПОСОБ: Используем Supabase API вместо прямого SQL
    const { error: updateError } = await directSupabase
      .from("users")
      .update({
        games_played: updates.games_played,
        games_won: updates.games_won,
        total_winnings: updates.total_winnings
      })
      .eq("id", userId);
      
    if (updateError) {
      logWithTimestamp(`Failed to update user stats:`, updateError);
      
      // Пробуем обновить через SQL запрос напрямую (только для числовых значений)
      try {
        // БЕЗОПАСНЫЙ SQL: Используем параметризованный запрос
        const { error: sqlError } = await directSupabase.rpc('update_user_stats_safe', {
          p_user_id: userId,
          p_games_played: updates.games_played,
          p_games_won: updates.games_won || 0,
          p_total_winnings: updates.total_winnings || 0
        });
        
        if (sqlError) {
          logWithTimestamp(`SQL update failed:`, sqlError);
          return false;
        } else {
          logWithTimestamp(`SQL update successful`);
        }
      } catch (sqlError) {
        logWithTimestamp(`Error during SQL update:`, sqlError);
        return false;
      }
    } else {
      logWithTimestamp(`User stats updated successfully`);
    }
    
    // Обновляем лидерборд
    try {
      // Сначала пробуем через API
      logWithTimestamp(`Updating leaderboard via API for user ${userId}`);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          winnings,
          isWin
        })
      });
      
      if (!response.ok) {
        logWithTimestamp(`Failed to update leaderboard via API: ${response.status} ${response.statusText}`);
        throw new Error('Failed to update leaderboard via API');
      }
      
      logWithTimestamp(`Leaderboard updated successfully via API`);
      return true;
    } catch (apiError) {
      logWithTimestamp(`Error updating leaderboard via API:`, apiError);
      
      // Если API не сработал, обновляем напрямую
      try {
        logWithTimestamp(`Updating leaderboard directly for user ${userId}`);
        
        // Проверяем, есть ли запись в таблице лидерборда
        const { data: leaderboardData, error: leaderboardError } = await directSupabase
          .from("leaderboard")
          .select("*")
          .eq("user_id", userId)
          .single();
          
        if (leaderboardError && leaderboardError.code !== "PGRST116") { // PGRST116 = not found
          logWithTimestamp(`Failed to check leaderboard entry:`, leaderboardError);
          return false;
        }
        
        // Получаем обновленные данные пользователя для расчета win rate
        const { data: updatedUserData, error: updatedUserError } = await directSupabase
          .from("users")
          .select("games_played, games_won")
          .eq("id", userId)
          .single();
          
        if (updatedUserError || !updatedUserData) {
          logWithTimestamp(`Failed to fetch updated user data:`, updatedUserError);
          return false;
        }
        
        // Рассчитываем win rate
        const winRate = updatedUserData.games_played > 0 ? 
          (updatedUserData.games_won / updatedUserData.games_played) * 100 : 0;
        
        // Если записи нет, создаем новую
        if (!leaderboardData) {
          logWithTimestamp(`Creating new leaderboard entry for ${userId}`);
          
          const { error: insertError } = await directSupabase
            .from("leaderboard")
            .insert({
              user_id: userId,
              total_wins: isWin ? 1 : 0,
              total_earnings: winnings,
              win_rate: winRate
            });
            
          if (insertError) {
            logWithTimestamp(`Failed to create leaderboard entry:`, insertError);
            return false;
          }
          
          logWithTimestamp(`Leaderboard entry created successfully`);
        } else {
          logWithTimestamp(`Updating existing leaderboard entry for ${userId}`);
          
          const { error: updateError } = await directSupabase
            .from("leaderboard")
            .update({
              total_wins: leaderboardData.total_wins + (isWin ? 1 : 0),
              total_earnings: leaderboardData.total_earnings + winnings,
              win_rate: winRate
            })
            .eq("user_id", userId);
            
          if (updateError) {
            logWithTimestamp(`Failed to update leaderboard entry:`, updateError);
            return false;
          }
          
          logWithTimestamp(`Leaderboard entry updated successfully`);
        }
        
        return true;
      } catch (directError) {
        logWithTimestamp(`Error updating leaderboard directly:`, directError);
        return false;
      }
    }
  } catch (error) {
    logWithTimestamp(`Error updating player stats:`, error);
    return false;
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const gameId = params.id
    const { index, userId } = await request.json()

    logWithTimestamp(`Received move request: gameId=${gameId}, index=${index}, userId=${userId}`);

    // Проверяем текущее состояние игры в начале
    const { data: initialGameData, error: initialGameError } = await directSupabase
      .from("games")
      .select("status, winner, board, bet_amount, pot")
      .eq("id", gameId)
      .single()
    
    if (initialGameError) {
      logWithTimestamp(`Failed to get initial game state:`, initialGameError);
    } else {
      logWithTimestamp(`Initial game state:`, initialGameData);
    }

    if (!gameId || index === undefined || !userId) {
      logWithTimestamp(`Missing required parameters`);
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Получаем данные игры
    const { data: gameData, error: gameError } = await directSupabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single()

    if (gameError || !gameData) {
      logWithTimestamp(`Game not found: ${gameId}`, gameError);
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    logWithTimestamp(`Game data retrieved:`, gameData);
    logWithTimestamp(`Game status: ${gameData.status}, Current player: ${gameData.current_player}`);

    // Проверяем, что игра активна
    if (gameData.status !== "playing") {
      logWithTimestamp(`Game is not active: ${gameData.status}`);
      return NextResponse.json({ error: "Game is not active" }, { status: 400 })
    }
    
    // Проверяем, что игра не завершена
    if (gameData.winner) {
      logWithTimestamp(`Game already has winner: ${gameData.winner}`);
      return NextResponse.json({ error: "Game already finished" }, { status: 400 })
    }

    // Проверяем, что ход делает текущий игрок
    const playerSymbol = gameData.player_x === userId ? "X" : gameData.player_o === userId ? "O" : null
    if (!playerSymbol) {
      logWithTimestamp(`User ${userId} is not a player in this game`);
      return NextResponse.json({ error: "You are not a player in this game" }, { status: 403 })
    }

    if (gameData.current_player !== playerSymbol) {
      logWithTimestamp(`Not your turn. Current player: ${gameData.current_player}, Your symbol: ${playerSymbol}`);
      return NextResponse.json({ error: "Not your turn" }, { status: 400 })
    }

    // Проверяем, что ячейка пуста
    let board = gameData.board
    
    // Если board приходит как строка JSON, парсим его
    if (typeof board === 'string') {
      try {
        board = JSON.parse(board);
        logWithTimestamp(`Parsed board from JSON string:`, board);
      } catch (error) {
        logWithTimestamp(`Failed to parse board JSON:`, error);
        return NextResponse.json({ error: "Invalid board data" }, { status: 400 })
      }
    }
    
    logWithTimestamp(`Board type: ${typeof board}, Board:`, board);
    logWithTimestamp(`Attempting to place ${playerSymbol} at index ${index}`);
    
    if (board[index] !== null) {
      logWithTimestamp(`Cell ${index} is already occupied: ${board[index]}`);
      return NextResponse.json({ error: "Cell is already occupied" }, { status: 400 })
    }

    // Проверяем, что игра все еще активна перед изменением
    const { data: currentGameData, error: currentGameError } = await directSupabase
      .from("games")
      .select("status, current_player")
      .eq("id", gameId)
      .single()
    
    if (currentGameError) {
      logWithTimestamp(`Failed to get current game status:`, currentGameError);
      return NextResponse.json({ error: "Failed to verify game status" }, { status: 500 })
    }
    
    if (currentGameData.status !== "playing") {
      logWithTimestamp(`Game is no longer active: ${currentGameData.status}`);
      return NextResponse.json({ error: "Game is no longer active" }, { status: 400 })
    }
    
    if (currentGameData.current_player !== playerSymbol) {
      logWithTimestamp(`Game state changed. Current player: ${currentGameData.current_player}, Your symbol: ${playerSymbol}`);
      return NextResponse.json({ error: "Game state changed" }, { status: 400 })
    }

    // Делаем ход
    board[index] = playerSymbol
    const nextPlayer = playerSymbol === "X" ? "O" : "X"
    
    logWithTimestamp(`Move made: player=${playerSymbol}, index=${index}, nextPlayer=${nextPlayer}`);
    logWithTimestamp(`New board state:`, board);

    // Проверяем на победителя или ничью
    const winner = calculateWinner(board)
    logWithTimestamp(`Winner calculation result:`, winner);
    logWithTimestamp(`Board state:`, board);
    logWithTimestamp(`Board has empty cells:`, board.includes(null));
    
    let gameStatus = gameData.status
    let gameWinner = null
    let gameEndedAt = null

    if (winner) {
      gameStatus = "completed"
      gameWinner = winner
      gameEndedAt = new Date().toISOString()
      logWithTimestamp(`Game completed with winner: ${winner}`);
    } else if (!board.includes(null)) {
      // Нет победителя и нет пустых клеток — ничья
      gameStatus = "draw"
      gameWinner = null
      gameEndedAt = new Date().toISOString()
      logWithTimestamp(`Game ended in a draw (no winner, board full)`);
    }
    
    // Проверяем все возможные выигрышные линии
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // горизонтали
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // вертикали
      [0, 4, 8], [2, 4, 6] // диагонали
    ];
    
    for (const [a, b, c] of lines) {
      logWithTimestamp(`Checking line [${a}, ${b}, ${c}]: ${board[a]}, ${board[b]}, ${board[c]}`);
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        logWithTimestamp(`Winner found in line [${a}, ${b}, ${c}]: ${board[a]}`);
      }
    }
    
    // Проверяем, что происходит с игрой в базе данных
    const { data: currentGameState, error: currentGameStateError } = await directSupabase
      .from("games")
      .select("status, winner, board")
      .eq("id", gameId)
      .single()
    
    if (currentGameStateError) {
      logWithTimestamp(`Failed to get current game state:`, currentGameStateError);
    } else {
      logWithTimestamp(`Current game state in DB:`, currentGameState);
    }
    
    logWithTimestamp(`Game ended at: ${gameEndedAt}`);

    if (winner) {
      gameStatus = "completed"
      gameWinner = winner
      gameEndedAt = new Date().toISOString()
      
      logWithTimestamp(`Game completed with winner: ${winner}`);
      logWithTimestamp(`Game data after completion:`, {
        status: gameStatus,
        winner: gameWinner,
        pot: gameData.pot,
        player_x: gameData.player_x,
        player_o: gameData.player_o
      });

      // Определяем ID победителя
      const winnerUserId = winner === "X" ? gameData.player_x : gameData.player_o
      const loserUserId = winner === "X" ? gameData.player_o : gameData.player_x
      
      logWithTimestamp(`Winner user ID: ${winnerUserId}, Loser user ID: ${loserUserId}`);

      // Победитель получает весь банк (ставка игрока + ставка противника)
      const winnings = gameData.pot || (gameData.bet_amount * 2)
      
      logWithTimestamp(`Processing payout: bet_amount=${gameData.bet_amount}, winnings=${winnings} (2x bet)`);
      logWithTimestamp(`Winner user ID: ${winnerUserId}, bet_amount: ${gameData.bet_amount}, winnings: ${winnings}`);

      // Обновляем баланс и статистику победителя одним запросом
      const { data: winnerData, error: winnerError } = await directSupabase
        .from("users")
        .select("balance, games_played, games_won, total_winnings")
        .eq("id", winnerUserId)
        .single()
        
      if (winnerError || !winnerData) {
        logWithTimestamp(`Failed to fetch winner data:`, winnerError);
      } else {
        logWithTimestamp(`Winner data before update:`, winnerData);
        logWithTimestamp(`Winner data types: balance=${typeof winnerData.balance}, games_played=${typeof winnerData.games_played}, games_won=${typeof winnerData.games_won}, total_winnings=${typeof winnerData.total_winnings}`);
        
        const newBalance = winnerData.balance + winnings
        const newGamesPlayed = (winnerData.games_played || 0) + 1
        const newGamesWon = (winnerData.games_won || 0) + 1
        const newTotalWinnings = (winnerData.total_winnings || 0) + winnings
        
        logWithTimestamp(`Calculated new values: balance=${newBalance}, games_played=${newGamesPlayed}, games_won=${newGamesWon}, total_winnings=${newTotalWinnings}`);
        logWithTimestamp(`Updating winner data: balance=${winnerData.balance} + ${winnings} = ${newBalance}`);
        
        logWithTimestamp(`Updating user with data:`, {
          id: winnerUserId,
          balance: newBalance,
          games_played: newGamesPlayed,
          games_won: newGamesWon,
          total_winnings: newTotalWinnings
        });
        
        const { error: updateError } = await directSupabase
          .from("users")
          .update({ 
            balance: newBalance,
            games_played: newGamesPlayed,
            games_won: newGamesWon,
            total_winnings: newTotalWinnings
          })
          .eq("id", winnerUserId)
          
        if (updateError) {
          logWithTimestamp(`Failed to update winner data:`, updateError);
          logWithTimestamp(`Update error details:`, {
            code: updateError.code,
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint
          });
        } else {
          logWithTimestamp(`Winner data updated successfully`);
        }
      }

      // Создаем транзакцию для победителя
      logWithTimestamp(`Creating win transaction:`, {
        user_id: winnerUserId,
        type: "win",
        amount: winnings,
        currency: "USDT",
        status: "completed"
      });
      
      const { error: transactionError } = await directSupabase
        .from("transactions")
        .insert({
          user_id: winnerUserId,
          type: "win",
          amount: winnings,
          currency: "USDT",
          status: "completed",
          created_at: new Date().toISOString()
        })
        
      if (transactionError) {
        logWithTimestamp(`Failed to create win transaction:`, transactionError);
        logWithTimestamp(`Transaction error details:`, {
          code: transactionError.code,
          message: transactionError.message,
          details: transactionError.details,
          hint: transactionError.hint
        });
      } else {
        logWithTimestamp(`Win transaction created successfully`);
      }
      
      // Обновляем статистику проигравшего
      if (loserUserId) {
        // Обновляем статистику проигравшего
        const { data: loserData, error: loserError } = await directSupabase
          .from("users")
          .select("games_played")
          .eq("id", loserUserId)
          .single()
          
        if (loserError || !loserData) {
          logWithTimestamp(`Failed to fetch loser data:`, loserError);
        } else {
          logWithTimestamp(`Loser data before update:`, loserData);
          const newGamesPlayed = (loserData.games_played || 0) + 1
          
          logWithTimestamp(`Updating loser stats: games_played=${loserData.games_played} + 1 = ${newGamesPlayed}`);
          
          const { error: updateError } = await directSupabase
            .from("users")
            .update({ games_played: newGamesPlayed })
            .eq("id", loserUserId)
            
          if (updateError) {
            logWithTimestamp(`Failed to update loser stats:`, updateError);
          } else {
            logWithTimestamp(`Loser stats updated successfully`);
          }
        }
        
        // Создаем транзакцию для проигравшего
        const { error: loserTransactionError } = await directSupabase
          .from("transactions")
          .insert({
            user_id: loserUserId,
            type: "loss",
            amount: gameData.bet_amount,
            currency: "USDT",
            status: "completed",
            created_at: new Date().toISOString()
          })
          
        if (loserTransactionError) {
          logWithTimestamp(`Failed to create loss transaction:`, loserTransactionError);
        } else {
          logWithTimestamp(`Loss transaction created successfully`);
        }
      }
    }
    
    // Проверяем на ничью (если нет победителя и доска заполнена)
    if (gameStatus === "draw") {
      logWithTimestamp(`Game ended in a draw (no winner, board full)`);
      
      logWithTimestamp(`Game ended in a draw`);

      // Возвращаем ставки игрокам
      const refundAmount = gameData.bet_amount || (gameData.pot / 2)
      
      logWithTimestamp(`Processing refunds: amount=${refundAmount} (bet_amount: ${gameData.bet_amount}, pot: ${gameData.pot})`);

      // Обрабатываем возврат для первого игрока
      const { data: player1Data, error: player1Error } = await directSupabase
        .from("users")
        .select("balance, games_played")
        .eq("id", gameData.player_x)
        .single()

      if (player1Error || !player1Data) {
        logWithTimestamp(`Failed to fetch player X data:`, player1Error);
      } else {
        const newBalance = player1Data.balance + refundAmount
        const newGamesPlayed = (player1Data.games_played || 0) + 1
        
        logWithTimestamp(`Updating player X data: balance=${player1Data.balance} + ${refundAmount} = ${newBalance}`);
        
        const { error: updateError } = await directSupabase
          .from("users")
          .update({ 
            balance: newBalance,
            games_played: newGamesPlayed
          })
          .eq("id", gameData.player_x)
          
        if (updateError) {
          logWithTimestamp(`Failed to update player X data:`, updateError);
        } else {
          logWithTimestamp(`Player X data updated successfully`);
        }
      }

      // Создаем транзакцию для первого игрока
      const { error: transaction1Error } = await directSupabase
            .from("transactions")
            .insert({
          user_id: gameData.player_x,
              type: "refund",
          amount: refundAmount,
              currency: "USDT",
              status: "completed",
              created_at: new Date().toISOString()
            })

      if (transaction1Error) {
        logWithTimestamp(`Failed to create refund transaction for player X:`, transaction1Error);
          } else {
        logWithTimestamp(`Refund transaction created for player X`);
      }
      
      // Обновляем статистику первого игрока
      await updatePlayerStats(gameData.player_x, false);

      // Обрабатываем возврат для второго игрока, если он есть
      if (gameData.player_o) {
        const { data: player2Data, error: player2Error } = await directSupabase
          .from("users")
          .select("balance")
          .eq("id", gameData.player_o)
          .single()
          
        if (player2Error || !player2Data) {
          logWithTimestamp(`Failed to fetch player O data:`, player2Error);
        } else {
          const newBalance = player2Data.balance + refundAmount
          
          logWithTimestamp(`Updating player O balance: ${player2Data.balance} + ${refundAmount} = ${newBalance}`);
          
          const { error: updateError } = await directSupabase
            .from("users")
            .update({ balance: newBalance })
            .eq("id", gameData.player_o)
            
          if (updateError) {
            logWithTimestamp(`Failed to update player O balance:`, updateError);
          } else {
            logWithTimestamp(`Player O balance updated successfully`);
          }
        }
            
        // Создаем транзакцию для второго игрока
        const { error: transaction2Error } = await directSupabase
              .from("transactions")
              .insert({
            user_id: gameData.player_o,
                type: "refund",
            amount: refundAmount,
                currency: "USDT",
                status: "completed",
                created_at: new Date().toISOString()
              })
              
        if (transaction2Error) {
          logWithTimestamp(`Failed to create refund transaction for player O:`, transaction2Error);
            } else {
          logWithTimestamp(`Refund transaction created for player O`);
        }
        
        // Обновляем статистику второго игрока
        await updatePlayerStats(gameData.player_o, false);
      }
    }
    
    // --- AI MOVE BLOCK ---
    if (!gameData.player_o && nextPlayer === "O" && gameStatus === "playing") {
      logWithTimestamp(`[AI BLOCK] Making AI move`);
      logWithTimestamp(`[AI BLOCK] player_o=${gameData.player_o}, nextPlayer=${nextPlayer}, gameStatus=${gameStatus}`);
      
      // Проверяем, что игра все еще активна
      if (gameStatus !== "playing") {
        logWithTimestamp(`[AI BLOCK] Game is no longer playing, status: ${gameStatus}`);
        return NextResponse.json({ error: "Game is not active" }, { status: 400 })
      }
      
      // Находим пустые ячейки
      const emptyIndices = board
        .map((cell: string | null, idx: number) => (cell === null ? idx : null))
        .filter((idx: number | null) => idx !== null) as number[]
      
      logWithTimestamp(`[AI BLOCK] Empty indices for AI:`, emptyIndices);
      
      if (emptyIndices.length > 0) {
        const { data: systemSettings } = await directSupabase
          .from("system_settings")
          .select("bot_win_probability")
          .single()
        const botWinPercentage = systemSettings?.bot_win_probability || 50
        const winProbability = botWinPercentage / 100
        const shouldMakeStrategicMove = Math.random() < winProbability
        let aiMoveIndex: number
        if (shouldMakeStrategicMove) {
          aiMoveIndex = getBestMove(board, "O") || emptyIndices[Math.floor(Math.random() * emptyIndices.length)]
        } else {
          aiMoveIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)]
        }
        logWithTimestamp(`AI move: index=${aiMoveIndex}, strategic=${shouldMakeStrategicMove}`);
        board[aiMoveIndex] = "O"
        const aiWinner = calculateWinner(board)
        logWithTimestamp(`AI move completed. Board:`, board);
        logWithTimestamp(`AI winner calculation:`, aiWinner);
        logWithTimestamp(`Board has empty cells after AI move:`, board.includes(null));
        let aiGameStatus = gameStatus
        let aiGameWinner = null
        
        if (aiWinner) {
          aiGameStatus = "completed"
          aiGameWinner = aiWinner
          
          logWithTimestamp(`Game completed with AI winner: ${aiWinner}`);
          
          if (aiWinner === "O") {
            // AI выиграл, игрок проиграл
            logWithTimestamp(`Player lost to AI`);
            
            // Обновляем статистику игрока
            await updatePlayerStats(gameData.player_x, false);
            
            // Создаем транзакцию проигрыша (деньги уже сняты при создании игры)
            await directSupabase
              .from("transactions")
              .insert({
                user_id: gameData.player_x,
                type: "loss",
                amount: gameData.bet_amount,
                currency: "USDT",
                status: "completed",
                created_at: new Date().toISOString()
              })
          } else {
            // Игрок выиграл - получает весь банк (ставка игрока + ставка AI)
            const winnings = gameData.pot || (gameData.bet_amount * 2)
            
            logWithTimestamp(`Player won against AI, winnings: ${winnings} (pot: ${gameData.pot}, bet_amount: ${gameData.bet_amount})`);
            
            // Обновляем баланс и статистику в одном запросе
            const { data: winnerData } = await directSupabase
              .from("users")
              .select("balance, games_played, games_won, total_winnings")
              .eq("id", gameData.player_x)
              .single()
            
            if (winnerData) {
              const newBalance = winnerData.balance + winnings
              const newGamesPlayed = (winnerData.games_played || 0) + 1
              const newGamesWon = (winnerData.games_won || 0) + 1
              const newTotalWinnings = (winnerData.total_winnings || 0) + winnings
              
              logWithTimestamp(`Updating winner balance: ${winnerData.balance} + ${winnings} = ${newBalance}`);
              
              // Обновляем все данные пользователя одним запросом
              await directSupabase
                .from("users")
                .update({ 
                  balance: newBalance,
                  games_played: newGamesPlayed,
                  games_won: newGamesWon,
                  total_winnings: newTotalWinnings
                })
                .eq("id", gameData.player_x)
              
              // Создаем транзакцию для победителя
              await directSupabase
                .from("transactions")
                .insert({
                  user_id: gameData.player_x,
                  type: "win",
                  amount: winnings,
                  currency: "USDT",
                  status: "completed",
                  created_at: new Date().toISOString()
                })
            }
          }
        } else if (!board.includes(null)) {
          // Ничья
          aiGameStatus = "draw"
          aiGameWinner = "draw"
          
          logWithTimestamp(`Game ended in a draw after AI move`);
          
          // Возвращаем ставку игроку (деньги уже сняты при создании игры)
          const refundAmount = gameData.bet_amount || (gameData.pot / 2)
          
          logWithTimestamp(`Refunding player bet: ${refundAmount} (bet_amount: ${gameData.bet_amount}, pot: ${gameData.pot})`);
          
          const { data: playerData } = await directSupabase
            .from("users")
            .select("balance, games_played")
            .eq("id", gameData.player_x)
            .single()
          
          if (playerData) {
            const newBalance = playerData.balance + refundAmount
            const newGamesPlayed = (playerData.games_played || 0) + 1
            
            logWithTimestamp(`Updating player balance for draw: ${playerData.balance} + ${refundAmount} = ${newBalance}`);
            
            // Обновляем баланс и статистику одним запросом
            await directSupabase
              .from("users")
              .update({ 
                balance: newBalance,
                games_played: newGamesPlayed
              })
              .eq("id", gameData.player_x)
            
            // Создаем транзакцию возврата
            await directSupabase
              .from("transactions")
              .insert({
                user_id: gameData.player_x,
                type: "refund",
                amount: refundAmount,
                currency: "USDT",
                status: "completed",
                created_at: new Date().toISOString()
              })
          }
          
          await updatePlayerStats(gameData.player_x, false);
        }
        
        // Обновляем игру с ходом AI
        const { data: aiUpdatedGame, error: aiUpdateError } = await directSupabase
          .from("games")
          .update({
            board: JSON.stringify(board), // Убеждаемся что board передается как JSON
            current_player: "X", // Следующий ход за игроком
            status: aiGameStatus,
            winner: aiGameWinner
          })
          .eq("id", gameId)
          .select()
          .single()
        
        if (aiUpdateError) {
          logWithTimestamp(`[AI BLOCK] Failed to update game with AI move:`, aiUpdateError);
          return NextResponse.json({ error: "Failed to update game with AI move" }, { status: 500 })
        } else {
          logWithTimestamp(`[AI BLOCK] Game updated with AI move:`, aiUpdatedGame);
          return NextResponse.json({ game: aiUpdatedGame })
        }
      } else {
        logWithTimestamp(`No empty cells for AI move`);
        return NextResponse.json({ error: "No empty cells for AI move" }, { status: 400 })
      }
    }

    // --- GENERAL GAME UPDATE BLOCK ---
    // Перед обновлением игры проверяем статус
    const { data: freshGameData, error: freshGameError } = await directSupabase
      .from("games")
      .select("status, winner, board")
      .eq("id", gameId)
      .single()
    if (freshGameError) {
      logWithTimestamp(`[GENERAL BLOCK] Failed to get fresh game status:`, freshGameError);
      return NextResponse.json({ error: "Failed to verify game status" }, { status: 500 })
    }
    logWithTimestamp(`[GENERAL BLOCK] Current game status: ${freshGameData.status}, winner: ${freshGameData.winner}`);
    logWithTimestamp(`[GENERAL BLOCK] Current game board:`, freshGameData.board);
    logWithTimestamp(`[GENERAL BLOCK] Attempting to update game with status: ${gameStatus}, winner: ${gameWinner}`);
    logWithTimestamp(`[GENERAL BLOCK] Game board before update:`, freshGameData.board);
    if (freshGameData.status !== "playing") {
      logWithTimestamp(`[GENERAL BLOCK] Game is no longer active: ${freshGameData.status}`);
      return NextResponse.json({ error: "Game is no longer active" }, { status: 400 })
    }
    if (freshGameData.winner) {
      logWithTimestamp(`[GENERAL BLOCK] Game already has winner: ${freshGameData.winner}`);
      return NextResponse.json({ error: "Game already finished" }, { status: 400 })
    }

    // --- UPDATE GAME ---
    const updateData: any = {
      board: JSON.stringify(board),
      current_player: nextPlayer,
      status: gameStatus,
      winner: gameWinner
    }
    // Убираем ended_at, так как этой колонки нет в базе данных
    // if (gameEndedAt) {
    //   updateData.ended_at = gameEndedAt
    // }
    
    logWithTimestamp(`[GENERAL BLOCK] Final game status: ${gameStatus}`);
    logWithTimestamp(`[GENERAL BLOCK] Final game winner: ${gameWinner}`);
    logWithTimestamp(`[GENERAL BLOCK] Game ended at: ${gameEndedAt}`);
    logWithTimestamp(`[GENERAL BLOCK] Updating game with data:`, updateData);
    logWithTimestamp(`[GENERAL BLOCK] Game ID: ${gameId}`);
    logWithTimestamp(`[GENERAL BLOCK] Board type: ${typeof board}, Board:`, board);
    logWithTimestamp(`[GENERAL BLOCK] Board JSON:`, JSON.stringify(board));
    logWithTimestamp(`[GENERAL BLOCK] Next player: ${nextPlayer}, Status: ${gameStatus}, Winner: ${gameWinner}`);
    logWithTimestamp(`[GENERAL BLOCK] Game ended at: ${gameEndedAt}`);
    let updatedGame: any;
    try {
      logWithTimestamp(`[GENERAL BLOCK] Starting database update...`);
      logWithTimestamp(`[GENERAL BLOCK] Update data:`, updateData);
      logWithTimestamp(`[GENERAL BLOCK] Game ID: ${gameId}`);
      
      // Проверяем текущее состояние игры перед обновлением
      const { data: currentGame, error: currentGameError } = await directSupabase
        .from("games")
        .select("status, winner, board")
        .eq("id", gameId)
        .single()
      
      if (currentGameError) {
        logWithTimestamp(`[GENERAL BLOCK] Failed to get current game state:`, currentGameError);
      } else {
        logWithTimestamp(`[GENERAL BLOCK] Current game state:`, currentGame);
      }
      
      // Проверяем, что игра все еще активна
      if (currentGame && currentGame.status !== "playing") {
        logWithTimestamp(`[GENERAL BLOCK] Game is no longer active: ${currentGame.status}`);
        return NextResponse.json({ error: "Game is no longer active" }, { status: 400 })
      }
      
      if (currentGame && currentGame.winner) {
        logWithTimestamp(`[GENERAL BLOCK] Game already has winner: ${currentGame.winner}`);
        return NextResponse.json({ error: "Game already finished" }, { status: 400 })
      }
      
              logWithTimestamp(`[GENERAL BLOCK] Attempting to update game with data:`, updateData);
      const { data, error: updateError } = await directSupabase
        .from("games")
        .update(updateData)
        .eq("id", gameId)
        .select()
        .single()
      logWithTimestamp(`[GENERAL BLOCK] Database update completed. Data:`, data);
      logWithTimestamp(`[GENERAL BLOCK] Update error:`, updateError);
      if (updateError) {
        logWithTimestamp(`[GENERAL BLOCK] Failed to update game:`, updateError);
        logWithTimestamp(`[GENERAL BLOCK] Update error details:`, {
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint
        });
        return NextResponse.json({ error: "Failed to update game" }, { status: 500 })
      } else {
        updatedGame = data;
        logWithTimestamp(`[GENERAL BLOCK] Game updated successfully:`, updatedGame);
          logWithTimestamp(`[GENERAL BLOCK] Updated game status:`, updatedGame.status);
          logWithTimestamp(`[GENERAL BLOCK] Updated game winner:`, updatedGame.winner);
          logWithTimestamp(`[GENERAL BLOCK] Updated game board:`, updatedGame.board);
        return NextResponse.json({ game: updatedGame })
      }
    } catch (error) {
      logWithTimestamp(`[GENERAL BLOCK] Exception during game update:`, error);
      logWithTimestamp(`[GENERAL BLOCK] Exception stack:`, error instanceof Error ? error.stack : 'No stack trace');
      logWithTimestamp(`[GENERAL BLOCK] Exception type:`, typeof error);
      logWithTimestamp(`[GENERAL BLOCK] Exception message:`, error instanceof Error ? error.message : 'No message');
      return NextResponse.json({ error: "Failed to update game" }, { status: 500 })
    }
    
    // Получаем имена игроков для ответа
    const playerIds = [gameData.player_x]
    if (gameData.player_o) playerIds.push(gameData.player_o)

    const { data: playersData, error: playersError } = await directSupabase
        .from("users")
      .select("id, username")
      .in("id", playerIds)

    if (playersError) {
      logWithTimestamp(`Failed to fetch player usernames:`, playersError);
    } else {
      // Добавляем имена игроков к данным игры
      const playerXData = playersData?.find(p => p.id === gameData.player_x)
      const playerOData = playersData?.find(p => p.id === gameData.player_o)

      updatedGame.player_x_username = playerXData?.username
      updatedGame.player_o_username = playerOData?.username
      
      logWithTimestamp(`Added player usernames to response: X=${playerXData?.username}, O=${playerOData?.username}`);
    }

    // Преобразуем данные в тот же формат, что и GET API
    const formattedGame = {
      id: updatedGame.id,
      status: updatedGame.status,
      betAmount: updatedGame.bet_amount,
      pot: updatedGame.pot,
      board: updatedGame.board,
      currentPlayer: updatedGame.current_player,
      current_player: updatedGame.current_player, // Добавляем оба поля для совместимости
      players: updatedGame.players,
      winner: updatedGame.winner,
      createdAt: updatedGame.created_at,
      updatedAt: updatedGame.updated_at
    }
    
    logWithTimestamp(`Returning formatted game data:`, formattedGame);
    logWithTimestamp(`Formatted game currentPlayer: ${formattedGame.currentPlayer}`);
    logWithTimestamp(`Formatted game current_player: ${formattedGame.current_player}`);
    
    return NextResponse.json({ game: formattedGame })
  } catch (error) {
    logWithTimestamp(`Error processing move:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}