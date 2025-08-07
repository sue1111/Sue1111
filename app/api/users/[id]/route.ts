import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isValidUUID, isValidNumber, createSafeUpdateObject } from "@/lib/utils/validation"

// Создаем прямое подключение к Supabase
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

// Функция для проверки и ограничения числовых значений
function validateAndLimitNumericValue(value: number, type: 'balance' | 'games_played' | 'games_won' | 'total_winnings'): number {
  // Базовая проверка на число
  if (isNaN(value) || !isFinite(value)) {
    console.warn(`Invalid ${type} value: ${value}, using 0 instead`);
    return 0;
  }
  
  // Ограничения по типу данных
  switch (type) {
    case 'balance':
      // Баланс не может быть отрицательным и не должен превышать 1 миллион
      return Math.min(Math.max(value, 0), 1000000);
    case 'games_played':
    case 'games_won':
      // Счетчики игр должны быть целыми положительными числами не больше 10000
      return Math.min(Math.max(Math.floor(value), 0), 10000);
    case 'total_winnings':
      // Общий выигрыш не может быть отрицательным и не должен превышать 10 миллионов
      return Math.min(Math.max(value, 0), 10000000);
    default:
      return value;
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = params.id
    console.log(`Fetching user data for ID: ${userId}`)

    // БЕЗОПАСНОСТЬ: Валидация UUID
    if (!userId || !isValidUUID(userId)) {
      console.error("Invalid user ID format")
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
    }

    if (!userId) {
      console.error("User ID is required")
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Получаем данные пользователя напрямую через Supabase
    const { data, error } = await directSupabase.from("users").select("*").eq("id", userId).single()

    if (error || !data) {
      console.error(`Error fetching user with ID ${userId}:`, error)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log(`User data retrieved successfully for ID ${userId}:`, data)
    
    // Получаем данные из заголовков запроса
    const requestHeaders = new Headers(request.headers);
    
    // Получаем баланс из заголовка
    let clientBalance: number | null = null;
    const clientBalanceHeader = requestHeaders.get('X-Client-Balance');
    if (clientBalanceHeader) {
      try {
        const parsedBalance = parseFloat(clientBalanceHeader);
        clientBalance = validateAndLimitNumericValue(parsedBalance, 'balance');
        console.log(`Client provided balance in header: ${clientBalance} (original: ${clientBalanceHeader})`);
      } catch (e) {
        console.error(`Failed to parse client balance from header: ${clientBalanceHeader}`);
      }
    }
    
    // Получаем games_played из заголовка
    let clientGamesPlayed: number | null = null;
    const clientGamesPlayedHeader = requestHeaders.get('X-Client-Games-Played');
    if (clientGamesPlayedHeader) {
      try {
        const parsedGamesPlayed = parseInt(clientGamesPlayedHeader, 10);
        clientGamesPlayed = validateAndLimitNumericValue(parsedGamesPlayed, 'games_played');
        console.log(`Client provided games_played in header: ${clientGamesPlayed} (original: ${clientGamesPlayedHeader})`);
      } catch (e) {
        console.error(`Failed to parse client games_played from header: ${clientGamesPlayedHeader}`);
      }
    }
    
    // Получаем games_won из заголовка
    let clientGamesWon: number | null = null;
    const clientGamesWonHeader = requestHeaders.get('X-Client-Games-Won');
    if (clientGamesWonHeader) {
      try {
        const parsedGamesWon = parseInt(clientGamesWonHeader, 10);
        clientGamesWon = validateAndLimitNumericValue(parsedGamesWon, 'games_won');
        console.log(`Client provided games_won in header: ${clientGamesWon} (original: ${clientGamesWonHeader})`);
      } catch (e) {
        console.error(`Failed to parse client games_won from header: ${clientGamesWonHeader}`);
      }
    }
    
    // Получаем total_winnings из заголовка
    let clientTotalWinnings: number | null = null;
    const clientTotalWinningsHeader = requestHeaders.get('X-Client-Total-Winnings');
    if (clientTotalWinningsHeader) {
      try {
        const parsedTotalWinnings = parseFloat(clientTotalWinningsHeader);
        clientTotalWinnings = validateAndLimitNumericValue(parsedTotalWinnings, 'total_winnings');
        console.log(`Client provided total_winnings in header: ${clientTotalWinnings} (original: ${clientTotalWinningsHeader})`);
      } catch (e) {
        console.error(`Failed to parse client total_winnings from header: ${clientTotalWinningsHeader}`);
      }
    }
    
    // Проверка на подозрительные значения
    if (clientBalance !== null && clientGamesPlayed !== null) {
      // Если у пользователя слишком большой баланс при малом количестве игр
      if (clientBalance > 10000 && clientGamesPlayed < 5) {
        console.warn(`Suspicious data detected: high balance (${clientBalance}) with few games (${clientGamesPlayed})`);
        // В этом случае не используем данные из заголовка
        clientBalance = null;
      }
    }
    
    if (clientGamesWon !== null && clientGamesPlayed !== null) {
      // Если количество побед больше количества игр
      if (clientGamesWon > clientGamesPlayed) {
        console.warn(`Inconsistent data detected: games_won (${clientGamesWon}) > games_played (${clientGamesPlayed})`);
        // Корректируем количество побед
        clientGamesWon = clientGamesPlayed;
      }
    }
    
    // Проверяем, нужно ли обновить данные
    let needsUpdate = false;
    
    // Проверяем баланс
    if (clientBalance !== null && data.balance !== clientBalance) {
      if (data.balance === 0 || data.balance === 100 || data.balance === 500 || data.balance === 840) {
        console.log(`Balance reset detected. Server: ${data.balance}, Client: ${clientBalance}`);
        data.balance = clientBalance;
        needsUpdate = true;
      }
    }
    
    // Проверяем games_played
    if (clientGamesPlayed !== null && data.games_played !== clientGamesPlayed) {
      if (data.games_played === 0) {
        console.log(`Games played reset detected. Server: ${data.games_played}, Client: ${clientGamesPlayed}`);
        data.games_played = clientGamesPlayed;
        needsUpdate = true;
      }
    }
    
    // Проверяем games_won
    if (clientGamesWon !== null && data.games_won !== clientGamesWon) {
      if (data.games_won === 0) {
        console.log(`Games won reset detected. Server: ${data.games_won}, Client: ${clientGamesWon}`);
        data.games_won = clientGamesWon;
        needsUpdate = true;
      }
    }
    
    // Проверяем total_winnings
    if (clientTotalWinnings !== null && (data.total_winnings || 0) !== clientTotalWinnings) {
      if ((data.total_winnings || 0) === 0) {
        console.log(`Total winnings reset detected. Server: ${data.total_winnings || 0}, Client: ${clientTotalWinnings}`);
        data.total_winnings = clientTotalWinnings;
        needsUpdate = true;
      }
    }
    
    // Если обнаружен сброс данных, обновляем их в базе данных
    if (needsUpdate) {
      console.log(`Restoring user data in database for ${userId}`);
      
          try {
            // Отключаем триггеры перед обновлением
            await directSupabase.rpc('exec_sql', { 
              sql: `SET session_replication_role = 'replica';`
            });
            
        // БЕЗОПАСНЫЙ СПОСОБ: Используем Supabase API вместо прямого SQL
        const updateData: any = {};
        
        if (clientBalance !== null) {
          updateData.balance = clientBalance;
        }
        
        if (clientGamesPlayed !== null) {
          updateData.games_played = clientGamesPlayed;
        }
        
        if (clientGamesWon !== null) {
          updateData.games_won = clientGamesWon;
        }
        
        if (clientTotalWinnings !== null) {
          updateData.total_winnings = clientTotalWinnings;
        }
        
        const { error: updateError } = await directSupabase
          .from("users")
          .update(updateData)
          .eq("id", userId);
          
        if (updateError) {
          console.error(`Failed to restore user data:`, updateError);
          throw updateError;
        }
            
            // Включаем триггеры обратно
            await directSupabase.rpc('exec_sql', { 
              sql: `SET session_replication_role = 'origin';`
            });
            
        console.log(`User data restored successfully`);
      } catch (sqlError) {
        console.error(`Error during user data restoration:`, sqlError);
      }
    }
    
    // Преобразуем данные из snake_case в camelCase для фронтенда
    const userData = {
      id: data.id,
      username: data.username,
      balance: data.balance,
      avatar: data.avatar,
      gamesPlayed: data.games_played,
      gamesWon: data.games_won,
      totalWinnings: data.total_winnings || 0,
      walletAddress: data.wallet_address || undefined,
      isAdmin: data.is_admin,
      status: data.status,
      createdAt: data.created_at,
      lastLogin: data.last_login || undefined,
    }

    console.log(`Returning user data with balance: ${userData.balance}, games_played: ${userData.gamesPlayed}, games_won: ${userData.gamesWon}, total_winnings: ${userData.totalWinnings}`)

    return NextResponse.json(userData)
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = params.id
    console.log(`Updating user data for ID: ${userId}`)

    // БЕЗОПАСНОСТЬ: Валидация UUID
    if (!userId || !isValidUUID(userId)) {
      console.error("Invalid user ID format")
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
    }

    if (!userId) {
      console.error("User ID is required")
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const { balance, direct, gamesPlayed, gamesWon, totalWinnings } = await request.json()
    console.log(`Received update request: balance=${balance}, direct=${direct}, gamesPlayed=${gamesPlayed}, gamesWon=${gamesWon}, totalWinnings=${totalWinnings}`)

    // Проверяем и ограничиваем входящие значения
    let validatedBalance: number | undefined = undefined;
    let validatedGamesPlayed: number | undefined = undefined;
    let validatedGamesWon: number | undefined = undefined;
    let validatedTotalWinnings: number | undefined = undefined;
    
    if (balance !== undefined) {
      validatedBalance = validateAndLimitNumericValue(balance, 'balance');
      if (validatedBalance !== balance) {
        console.warn(`Balance value was limited: ${balance} -> ${validatedBalance}`);
      }
    }
    
    if (gamesPlayed !== undefined) {
      validatedGamesPlayed = validateAndLimitNumericValue(gamesPlayed, 'games_played');
      if (validatedGamesPlayed !== gamesPlayed) {
        console.warn(`Games played value was limited: ${gamesPlayed} -> ${validatedGamesPlayed}`);
      }
    }
    
    if (gamesWon !== undefined) {
      validatedGamesWon = validateAndLimitNumericValue(gamesWon, 'games_won');
      if (validatedGamesWon !== gamesWon) {
        console.warn(`Games won value was limited: ${gamesWon} -> ${validatedGamesWon}`);
      }
      
      // Проверка на логическую согласованность: количество побед не может быть больше количества игр
      if (validatedGamesPlayed !== undefined && validatedGamesWon > validatedGamesPlayed) {
        console.warn(`Games won (${validatedGamesWon}) cannot be greater than games played (${validatedGamesPlayed})`);
        validatedGamesWon = validatedGamesPlayed;
      }
    }
    
    if (totalWinnings !== undefined) {
      validatedTotalWinnings = validateAndLimitNumericValue(totalWinnings, 'total_winnings');
      if (validatedTotalWinnings !== totalWinnings) {
        console.warn(`Total winnings value was limited: ${totalWinnings} -> ${validatedTotalWinnings}`);
      }
    }

    // Проверяем, существует ли пользователь
    const { data: userData, error: userError } = await directSupabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single()

    if (userError || !userData) {
      console.error(`Error fetching user with ID ${userId}:`, userError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log(`Current user data: balance=${userData.balance}, games_played=${userData.games_played}, games_won=${userData.games_won}, total_winnings=${userData.total_winnings || 0}`)

    // Проверка на подозрительные значения
    if (validatedBalance !== undefined && validatedGamesPlayed !== undefined) {
      const currentBalance = userData.balance;
      const currentGamesPlayed = userData.games_played;
      
      // Если баланс увеличивается слишком сильно при небольшом изменении количества игр
      if (validatedBalance > currentBalance + 50000 && validatedGamesPlayed < currentGamesPlayed + 10) {
        console.warn(`Suspicious balance increase detected: ${currentBalance} -> ${validatedBalance} with only ${validatedGamesPlayed - currentGamesPlayed} new games`);
        // Ограничиваем увеличение баланса
        validatedBalance = currentBalance + 5000; // Более разумное увеличение
        console.warn(`Balance increase limited to: ${validatedBalance}`);
      }
    }

    // Подготавливаем данные для обновления
    const updateData: Record<string, any> = {};
    
    // Обновляем баланс, если он передан
    if (validatedBalance !== undefined) {
      updateData.balance = validatedBalance;
    }
    
    // Обновляем статистику, если она передана
    if (validatedGamesPlayed !== undefined) {
      updateData.games_played = validatedGamesPlayed;
    }
    
    if (validatedGamesWon !== undefined) {
      updateData.games_won = validatedGamesWon;
    }
    
    if (validatedTotalWinnings !== undefined) {
      updateData.total_winnings = validatedTotalWinnings;
    }
    
    console.log(`Update data:`, updateData);

    // Если запрос с флагом direct=true, используем прямой SQL-запрос
    if (direct) {
      console.log(`Using direct update method with disabled triggers`)
      
      try {
        // Отключаем триггеры перед обновлением
        await directSupabase.rpc('exec_sql', { 
          sql: `SET session_replication_role = 'replica';`
        });
        
        // БЕЗОПАСНЫЙ СПОСОБ: Используем Supabase API вместо прямого SQL
        const { error: updateError } = await directSupabase
          .from("users")
          .update(updateData)
          .eq("id", userId);
          
        if (updateError) {
          console.error(`Supabase update failed:`, updateError);
          throw updateError;
        }
            
        // Включаем триггеры обратно
        await directSupabase.rpc('exec_sql', { 
          sql: `SET session_replication_role = 'origin';`
        });
        
        console.log(`Direct update successful`);
        
        // Проверяем, что обновление прошло успешно
        const { data: verifyData, error: verifyError } = await directSupabase
          .from("users")
          .select("balance, games_played, games_won, total_winnings")
          .eq("id", userId)
          .single();
          
        if (verifyError) {
          console.error(`Failed to verify update:`, verifyError);
        } else {
          console.log(`Verified user data after update:`, verifyData);
          
          // Проверяем, что баланс обновился правильно
          if (validatedBalance !== undefined && verifyData.balance !== validatedBalance) {
            console.error(`Balance verification failed: actual=${verifyData.balance}, expected=${validatedBalance}`);
            
            // Пробуем еще раз с максимальными привилегиями
            console.log(`Retrying update with maximum privileges`);
            
            try {
              await directSupabase.rpc('force_update_user_balance', {
                p_user_id: userId,
                p_new_balance: validatedBalance
              });
              
              console.log(`Force update successful`);
            } catch (forceError) {
              console.error(`Force update failed:`, forceError);
            }
          }
          
          // Проверяем, что статистика обновилась правильно
          if (validatedGamesPlayed !== undefined && verifyData.games_played !== validatedGamesPlayed) {
            console.error(`Games played verification failed: actual=${verifyData.games_played}, expected=${validatedGamesPlayed}`);
          }
          
          if (validatedGamesWon !== undefined && verifyData.games_won !== validatedGamesWon) {
            console.error(`Games won verification failed: actual=${verifyData.games_won}, expected=${validatedGamesWon}`);
          }
          
          if (validatedTotalWinnings !== undefined && (verifyData.total_winnings || 0) !== validatedTotalWinnings) {
            console.error(`Total winnings verification failed: actual=${verifyData.total_winnings || 0}, expected=${validatedTotalWinnings}`);
          }
        }
      } catch (error) {
        console.error(`Error during direct update:`, error);
        
        // Если прямой SQL-запрос не сработал, пробуем обычный метод
        const { error: updateError } = await directSupabase
          .from("users")
          .update(updateData)
          .eq("id", userId);
          
        if (updateError) {
          console.error(`Standard update also failed:`, updateError);
          return NextResponse.json({ error: "Failed to update user data" }, { status: 500 });
        }
        
        console.log(`Standard update successful`);
      }
    } else {
      // Обычное обновление через Supabase API
      console.log(`Using standard update method`);
      
      const { error: updateError } = await directSupabase
        .from("users")
        .update(updateData)
        .eq("id", userId);
        
      if (updateError) {
        console.error(`Failed to update user data:`, updateError);
        return NextResponse.json({ error: "Failed to update user data" }, { status: 500 });
      }
      
      console.log(`Standard update successful`);
    }

    // Получаем обновленные данные пользователя
    const { data: updatedUser, error: updatedUserError } = await directSupabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single()

    if (updatedUserError || !updatedUser) {
      console.error(`Error fetching updated user data:`, updatedUserError)
      
      // Если не удалось получить обновленные данные, возвращаем предполагаемые данные
      const userData = {
        id: userId,
        balance: validatedBalance,
        gamesPlayed: validatedGamesPlayed,
        gamesWon: validatedGamesWon,
        totalWinnings: validatedTotalWinnings
      }
      
      console.log(`Returning assumed user data:`, userData)
      return NextResponse.json(userData)
    }

    // Преобразуем данные из snake_case в camelCase для фронтенда
    const responseData = {
      id: updatedUser.id,
      username: updatedUser.username,
      balance: updatedUser.balance,
      avatar: updatedUser.avatar,
      gamesPlayed: updatedUser.games_played,
      gamesWon: updatedUser.games_won,
      totalWinnings: updatedUser.total_winnings || 0,
      walletAddress: updatedUser.wallet_address || undefined,
      isAdmin: updatedUser.is_admin,
      status: updatedUser.status,
      createdAt: updatedUser.created_at,
      lastLogin: updatedUser.last_login || undefined,
    }

    console.log(`User data updated successfully:`, responseData)

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
