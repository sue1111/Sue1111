import { NextResponse } from "next/server";
import { logWithTimestamp, directSupabase } from "@/lib/db-actions";

export async function POST(request: Request) {
  try {
    logWithTimestamp("=== ЗАПРОС НА СОЗДАНИЕ ТЕСТОВОЙ ИГРЫ (УПРОЩЕННЫЙ) ===");
    
    // Получаем данные из запроса
    const body = await request.json();
    const { userId, betAmount } = body;
    
    logWithTimestamp("Данные запроса:", { userId, betAmount });
    
    if (!userId || betAmount === undefined) {
      return NextResponse.json({ 
        error: "Отсутствуют обязательные поля", 
        details: "Требуются userId и betAmount" 
      }, { status: 400 });
    }
    
    // 1. Получаем данные пользователя
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
    
    logWithTimestamp("Данные пользователя получены:", userData);
    
    // 2. Проверяем баланс
    if (userData.balance < betAmount) {
      return NextResponse.json({ 
        error: "Недостаточно средств", 
        details: `Текущий баланс: ${userData.balance}, требуется: ${betAmount}` 
      }, { status: 400 });
    }
    
    // 3. Списываем средства
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
    
    logWithTimestamp("Средства списаны успешно, новый баланс:", newBalance);
    
    // 4. Создаем игру напрямую через API
    const gameData = {
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
    
    logWithTimestamp("Создаем игру с данными:", gameData);
    
    const { data: game, error: gameError } = await directSupabase
      .from("games")
      .insert(gameData)
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
    
    // 5. Обновляем статистику
    const { error: statsError } = await directSupabase
      .from("users")
      .update({ games_played: userData.games_played + 1 })
      .eq("id", userId);
    
    if (statsError) {
      logWithTimestamp(`Предупреждение: ошибка при обновлении статистики: ${statsError.message}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Игра успешно создана", 
      game,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logWithTimestamp("=== ОШИБКА В ЭНДПОИНТЕ TEST-GAME ===");
    logWithTimestamp("Ошибка:", error);
    
    return NextResponse.json({ 
      error: "Ошибка при создании игры", 
      details: error instanceof Error ? error.message : "Неизвестная ошибка",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return NextResponse.json({
    message: "Используйте метод POST для создания тестовой игры",
    example: {
      userId: "id-пользователя",
      betAmount: 10
    }
  });
} 