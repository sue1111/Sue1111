import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"
import { createClient } from "@supabase/supabase-js"

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

// Функция для логирования с отметкой времени
function logWithTimestamp(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] [LEADERBOARD_API] ${message}`, data);
  } else {
    console.log(`[${timestamp}] [LEADERBOARD_API] ${message}`);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "winnings"
    const sort = searchParams.get("sort") || "total_winnings"
    const limit = Number.parseInt(searchParams.get("limit") || "10", 10)

    logWithTimestamp(`Fetching leaderboard of type: ${type}, sort: ${sort}, limit: ${limit}`);

    const supabase = getSupabaseServerClient()

    if (type === "winnings" || sort === "totalWinnings") {
      // Получаем пользователей с наибольшим заработком (total_winnings)
      logWithTimestamp("Fetching users with highest total_winnings");
      const { data, error } = await supabase
        .from("users")
        .select("id, username, avatar, games_played, games_won, total_winnings")
        .order("total_winnings", { ascending: false })
        .limit(limit)

      if (error) {
        logWithTimestamp("Error fetching leaderboard:", error)
        return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
      }

      logWithTimestamp(`Retrieved ${data?.length || 0} users for winnings leaderboard`);

      const leaderboard = data?.map((user: any) => ({
        id: user.id,
        username: user.username,
        gamesWon: user.games_won || 0,
        winnings: user.total_winnings || 0,
        avatar: user.avatar,
      })) || []

      return NextResponse.json(leaderboard)
    } else if (type === "wins") {
      // Получаем пользователей с наибольшим количеством побед
      logWithTimestamp("Fetching users with most wins");
      const { data, error } = await supabase
        .from("users")
        .select("id, username, avatar, games_played, games_won, total_winnings")
        .order("games_won", { ascending: false })
        .limit(limit)

      if (error) {
        logWithTimestamp("Error fetching leaderboard:", error)
        return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
      }

      logWithTimestamp(`Retrieved ${data?.length || 0} users for wins leaderboard`);

      const leaderboard = data?.map((user: any) => ({
        id: user.id,
        username: user.username,
        gamesWon: user.games_won || 0,
        winnings: user.total_winnings || 0,
        avatar: user.avatar,
      })) || []

      return NextResponse.json(leaderboard)
    } else {
      logWithTimestamp(`Invalid leaderboard type: ${type}`);
      return NextResponse.json({ error: "Invalid leaderboard type" }, { status: 400 })
    }
  } catch (error) {
    logWithTimestamp("Error fetching leaderboard:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Обработчик для обновления лидерборда
export async function POST(request: Request) {
  try {
    const { userId, winnings, isWin } = await request.json()
    
    logWithTimestamp(`Received request to update leaderboard for user ${userId}: winnings=${winnings}, isWin=${isWin}`);
    
    if (!userId) {
      logWithTimestamp("User ID is required");
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }
    
    // Получаем текущие данные пользователя
    logWithTimestamp(`Fetching current user data for ${userId}`);
    const { data: userData, error: userError } = await directSupabase
      .from("users")
      .select("games_played, games_won, total_winnings")
      .eq("id", userId)
      .single()
      
    if (userError || !userData) {
      logWithTimestamp(`Failed to fetch user data for ${userId}:`, userError);
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    
    logWithTimestamp(`Current user data:`, userData);
    
    // Подготавливаем обновления для пользователя
    const updates: Record<string, any> = {
      games_played: userData.games_played + 1
    }
    
    if (isWin) {
      updates.games_won = userData.games_won + 1;
      logWithTimestamp(`Updating games_won: ${userData.games_won} -> ${userData.games_won + 1}`);
    }
    
    if (winnings && winnings > 0) {
      updates.total_winnings = (userData.total_winnings || 0) + winnings;
      logWithTimestamp(`Updating total_winnings: ${userData.total_winnings || 0} -> ${(userData.total_winnings || 0) + winnings}`);
    }
    
    logWithTimestamp(`Updating user stats with:`, updates);
    
    // Обновляем данные пользователя
    const { error: updateError } = await directSupabase
      .from("users")
      .update(updates)
      .eq("id", userId)
      
    if (updateError) {
      logWithTimestamp(`Failed to update user stats for ${userId}:`, updateError);
      
      // Пробуем обновить через SQL запрос напрямую
      logWithTimestamp(`Trying direct SQL update for user stats`);
      try {
        let sqlQuery = `UPDATE public.users SET games_played = ${updates.games_played}`;
        
        if (updates.games_won !== undefined) {
          sqlQuery += `, games_won = ${updates.games_won}`;
        }
        
        if (updates.total_winnings !== undefined) {
          sqlQuery += `, total_winnings = ${updates.total_winnings}`;
        }
        
        sqlQuery += ` WHERE id = '${userId}';`;
        
        logWithTimestamp(`Executing SQL query:`, sqlQuery);
        
        const { error: sqlError } = await directSupabase.rpc('exec_sql', { 
          sql: sqlQuery 
        });
        
        if (sqlError) {
          logWithTimestamp(`SQL update failed:`, sqlError);
          return NextResponse.json({ error: "Failed to update user stats" }, { status: 500 });
        } else {
          logWithTimestamp(`SQL update successful`);
        }
      } catch (sqlError) {
        logWithTimestamp(`Error during SQL update:`, sqlError);
        return NextResponse.json({ error: "Failed to update user stats" }, { status: 500 });
      }
    } else {
      logWithTimestamp(`User stats updated successfully`);
    }
    
    // Проверяем, есть ли запись в таблице лидерборда
    logWithTimestamp(`Checking for existing leaderboard entry for ${userId}`);
    const { data: leaderboardData, error: leaderboardError } = await directSupabase
      .from("leaderboard")
      .select("*")
      .eq("user_id", userId)
      .single()
      
    if (leaderboardError && leaderboardError.code !== "PGRST116") { // PGRST116 = not found
      logWithTimestamp(`Failed to check leaderboard entry for ${userId}:`, leaderboardError);
      return NextResponse.json({ error: "Failed to check leaderboard entry" }, { status: 500 })
    }
    
    // Получаем обновленные данные пользователя для расчета win rate
    logWithTimestamp(`Fetching updated user data for win rate calculation`);
    const { data: updatedUserData, error: updatedUserError } = await directSupabase
      .from("users")
      .select("games_played, games_won")
      .eq("id", userId)
      .single();
      
    if (updatedUserError || !updatedUserData) {
      logWithTimestamp(`Failed to fetch updated user data:`, updatedUserError);
      return NextResponse.json({ error: "Failed to fetch updated user data" }, { status: 500 });
    }
    
    // Рассчитываем win rate
    const winRate = updatedUserData.games_played > 0 ? 
      (updatedUserData.games_won / updatedUserData.games_played) * 100 : 0;
    logWithTimestamp(`Calculated win rate: ${winRate}% (${updatedUserData.games_won}/${updatedUserData.games_played})`);
    
    // Если записи нет, создаем новую
    if (!leaderboardData) {
      logWithTimestamp(`Creating new leaderboard entry for ${userId}`);
      const newEntry = {
        user_id: userId,
        total_wins: isWin ? 1 : 0,
        total_earnings: winnings || 0,
        win_rate: winRate
      };
      
      logWithTimestamp(`New leaderboard entry data:`, newEntry);
      
      const { error: insertError } = await directSupabase
        .from("leaderboard")
        .insert(newEntry);
        
      if (insertError) {
        logWithTimestamp(`Failed to create leaderboard entry for ${userId}:`, insertError);
        
        // Пробуем создать через SQL запрос напрямую
        logWithTimestamp(`Trying direct SQL insert for leaderboard entry`);
        try {
          const sqlQuery = `
            INSERT INTO public.leaderboard (user_id, total_wins, total_earnings, win_rate)
            VALUES ('${userId}', ${isWin ? 1 : 0}, ${winnings || 0}, ${winRate});
          `;
          
          logWithTimestamp(`Executing SQL query:`, sqlQuery);
          
          const { error: sqlError } = await directSupabase.rpc('exec_sql', { 
            sql: sqlQuery 
          });
          
          if (sqlError) {
            logWithTimestamp(`SQL insert failed:`, sqlError);
            return NextResponse.json({ error: "Failed to create leaderboard entry" }, { status: 500 });
          } else {
            logWithTimestamp(`SQL insert successful`);
          }
        } catch (sqlError) {
          logWithTimestamp(`Error during SQL insert:`, sqlError);
          return NextResponse.json({ error: "Failed to create leaderboard entry" }, { status: 500 });
        }
      } else {
        logWithTimestamp(`Leaderboard entry created successfully`);
      }
    } 
    // Иначе обновляем существующую запись
    else {
      logWithTimestamp(`Updating existing leaderboard entry for ${userId}`);
      const updates = {
        total_wins: leaderboardData.total_wins + (isWin ? 1 : 0),
        total_earnings: leaderboardData.total_earnings + (winnings || 0),
        win_rate: winRate
      };
      
      logWithTimestamp(`Leaderboard update data:`, updates);
      
      const { error: updateLeaderboardError } = await directSupabase
        .from("leaderboard")
        .update(updates)
        .eq("user_id", userId);
        
      if (updateLeaderboardError) {
        logWithTimestamp(`Failed to update leaderboard entry for ${userId}:`, updateLeaderboardError);
        
        // Пробуем обновить через SQL запрос напрямую
        logWithTimestamp(`Trying direct SQL update for leaderboard entry`);
        try {
          const sqlQuery = `
            UPDATE public.leaderboard 
            SET total_wins = ${updates.total_wins},
                total_earnings = ${updates.total_earnings},
                win_rate = ${updates.win_rate}
            WHERE user_id = '${userId}';
          `;
          
          logWithTimestamp(`Executing SQL query:`, sqlQuery);
          
          const { error: sqlError } = await directSupabase.rpc('exec_sql', { 
            sql: sqlQuery 
          });
          
          if (sqlError) {
            logWithTimestamp(`SQL update failed:`, sqlError);
            return NextResponse.json({ error: "Failed to update leaderboard entry" }, { status: 500 });
          } else {
            logWithTimestamp(`SQL update successful`);
          }
        } catch (sqlError) {
          logWithTimestamp(`Error during SQL update:`, sqlError);
          return NextResponse.json({ error: "Failed to update leaderboard entry" }, { status: 500 });
        }
      } else {
        logWithTimestamp(`Leaderboard entry updated successfully`);
      }
    }
    
    // Проверяем результат обновления
    logWithTimestamp(`Verifying leaderboard update for ${userId}`);
    const { data: verifyData, error: verifyError } = await directSupabase
      .from("leaderboard")
      .select("*")
      .eq("user_id", userId)
      .single();
      
    if (verifyError) {
      logWithTimestamp(`Failed to verify leaderboard update:`, verifyError);
    } else {
      logWithTimestamp(`Leaderboard entry after update:`, verifyData);
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    logWithTimestamp("Error updating leaderboard:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
