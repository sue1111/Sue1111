import { NextResponse } from "next/server";
import { directSupabase, logWithTimestamp, createTransaction } from "@/lib/db-actions";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const player_x = url.searchParams.get('player_x');
    const player_o = url.searchParams.get('player_o');
    const status = url.searchParams.get('status');
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 10;
    const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0;
    const order = url.searchParams.get('order') || 'created_at.desc';
    
    logWithTimestamp(`=== ПОЛУЧЕНИЕ СПИСКА ИГР ===`);
    logWithTimestamp(`Параметры: player_x=${player_x}, player_o=${player_o}, status=${status}, limit=${limit}, offset=${offset}, order=${order}`);
    
    // Строим запрос
    let query = directSupabase.from("games").select("*");
    
    // Применяем фильтры
    if (player_x) {
      query = query.eq('player_x', player_x);
    }
    
    if (player_o) {
      query = query.eq('player_o', player_o);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    // Применяем сортировку
    const [orderField, orderDirection] = order.split('.');
    query = query.order(orderField, { ascending: orderDirection === 'asc' });
    
    // Применяем пагинацию
    query = query.range(offset, offset + limit - 1);
    
    // Выполняем запрос
    const { data, error, count } = await query;
    
    if (error) {
      logWithTimestamp(`Ошибка при получении списка игр: ${error.message}`);
      return NextResponse.json({ 
        error: "Ошибка при получении списка игр", 
        details: error.message 
      }, { status: 500 });
    }
    
    logWithTimestamp(`Успешно получен список игр: ${data.length} записей`);
    
    // Если запрашивается последняя игра конкретного пользователя, проверяем результат
    if (player_x && limit === 1 && order === 'created_at.desc' && (!data || data.length === 0)) {
      logWithTimestamp(`Не найдено игр для пользователя ${player_x}, пробуем SQL-запрос`);
      
      // Пробуем получить игру через SQL-запрос
      const { data: sqlData, error: sqlError } = await directSupabase.rpc('exec_sql', {
        sql: `SELECT * FROM games WHERE player_x = '${player_x}'::uuid ORDER BY created_at DESC LIMIT 1;`
      });
      
      if (sqlError) {
        logWithTimestamp(`Ошибка при выполнении SQL-запроса: ${sqlError.message}`);
      } else if (sqlData && Array.isArray(sqlData) && sqlData.length > 0) {
        logWithTimestamp(`Найдена игра через SQL-запрос:`, sqlData[0]);
        return NextResponse.json({ 
          data: sqlData,
          count: 1
        });
      }
    }
    
    return NextResponse.json({ 
      data,
      count
    });
    
  } catch (error) {
    logWithTimestamp(`=== ОШИБКА В ЭНДПОИНТЕ GAMES ===`);
    logWithTimestamp(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    
    return NextResponse.json({ 
      error: "Ошибка при получении списка игр", 
      details: error instanceof Error ? error.message : "Неизвестная ошибка" 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const gameData = await request.json();
    logWithTimestamp("=== СОЗДАНИЕ ИГРЫ ЧЕРЕЗ API ===");
    logWithTimestamp("Данные для создания игры:", gameData);
    
    const { userId, betAmount } = gameData;
    
    if (!userId || betAmount === undefined) {
      logWithTimestamp("Отсутствуют обязательные поля");
      return NextResponse.json({ 
        error: "Отсутствуют обязательные поля", 
        details: "Требуются userId и betAmount" 
      }, { status: 400 });
    }
    
    // Проверяем пользователя
    const { data: userData, error: userError } = await directSupabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    
    if (userError) {
      logWithTimestamp(`Ошибка при получении данных пользователя: ${userError.message}`);
      return NextResponse.json({ 
        error: "Пользователь не найден", 
        details: userError.message 
      }, { status: 404 });
    }
    
    // Проверяем баланс
    if (userData.balance < betAmount) {
      logWithTimestamp(`Недостаточно средств: ${userData.balance} < ${betAmount}`);
      return NextResponse.json({ 
        error: "Недостаточно средств", 
        details: `Текущий баланс: ${userData.balance}, требуется: ${betAmount}` 
      }, { status: 400 });
    }
    
    // Списываем средства
    const newBalance = userData.balance - betAmount;
    const { error: balanceError } = await directSupabase
      .from("users")
      .update({ balance: newBalance })
      .eq("id", userId);
    
    if (balanceError) {
      logWithTimestamp(`Ошибка при списании средств: ${balanceError.message}`);
      return NextResponse.json({ 
        error: "Ошибка при списании средств", 
        details: balanceError.message 
      }, { status: 500 });
    }
    
    // Создаем транзакцию для ставки
    const transaction = await createTransaction({
      userId,
      type: "bet",
      amount: betAmount,
      currency: "USDT",
      status: "completed"
    });
    
    if (!transaction) {
      logWithTimestamp(`Ошибка при создании транзакции ставки`);
      // Возвращаем средства если не удалось создать транзакцию
      await directSupabase
        .from("users")
        .update({ balance: userData.balance })
        .eq("id", userId);
      
      return NextResponse.json({ 
        error: "Ошибка при создании транзакции", 
        details: "Не удалось создать запись о ставке" 
      }, { status: 500 });
    }
    
    // Создаем игру напрямую через API
    const newGameData = {
      board: Array(9).fill(null),
      current_player: "X",
      player_x: userId,
      player_o: null,
      status: "playing", // Игры против AI сразу начинаются
      bet_amount: betAmount,
      pot: betAmount,
      players: {
        X: {
          id: userId,
          username: userData.username,
          avatar: userData.avatar
        },
        O: null
      }
    };
    
    logWithTimestamp("Создаем игру с данными:", newGameData);
    
    const { data: game, error: gameError } = await directSupabase
      .from("games")
      .insert(newGameData)
      .select()
      .single();
    
    if (gameError) {
      logWithTimestamp(`Ошибка при создании игры: ${gameError.message}`);
      
      // Возвращаем средства
      await directSupabase
        .from("users")
        .update({ balance: userData.balance })
        .eq("id", userId);
      
      return NextResponse.json({ 
        error: "Ошибка при создании игры", 
        details: gameError.message 
      }, { status: 500 });
    }
    
    if (!game) {
      logWithTimestamp("Игра создана, но данные не возвращены");
      
      // Возвращаем средства
      await directSupabase
        .from("users")
        .update({ balance: userData.balance })
        .eq("id", userId);
      
      return NextResponse.json({ 
        error: "Ошибка при создании игры", 
        details: "Данные игры не возвращены" 
      }, { status: 500 });
    }
    
    logWithTimestamp("Игра успешно создана:", game);
    
    // Обновляем статистику
    const { error: statsError } = await directSupabase
      .from("users")
      .update({ games_played: userData.games_played + 1 })
      .eq("id", userId);
    
    if (statsError) {
      logWithTimestamp(`Предупреждение: ошибка при обновлении статистики: ${statsError.message}`);
    }
    
    return NextResponse.json(game);
    
  } catch (error) {
    logWithTimestamp(`=== ОШИБКА В ЭНДПОИНТЕ GAMES (POST) ===`);
    logWithTimestamp(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    
    return NextResponse.json({ 
      error: "Ошибка при создании игры", 
      details: error instanceof Error ? error.message : "Неизвестная ошибка" 
    }, { status: 500 });
  }
}
