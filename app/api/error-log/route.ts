import { NextRequest, NextResponse } from 'next/server';

// Простое хранилище ошибок в памяти (для разработки)
let errorLogs: any[] = [];

export async function POST(request: NextRequest) {
  try {
    // Получить данные ошибки из запроса
    const errorData = await request.json();
    
    // Валидация данных ошибки
    if (!errorData.message || !errorData.type) {
      return NextResponse.json(
        { error: 'Invalid error data' },
        { status: 400 }
      );
    }

    // Подготовить данные для записи
    const errorLog = {
      id: Date.now().toString(),
      message: errorData.message,
      type: errorData.type,
      component: errorData.component || 'Unknown',
      stack: errorData.stack || null,
      user_agent: errorData.userAgent || null,
      url: errorData.url || null,
      session_id: errorData.sessionId || null,
      user_id: null, // Пока без пользователя
      timestamp: errorData.timestamp || new Date().toISOString(),
      metadata: {
        browser: getBrowserInfo(errorData.userAgent),
        os: getOSInfo(errorData.userAgent),
      }
    };

    // Добавляем в память
    errorLogs.push(errorLog);
    
    // Ограничиваем количество логов (максимум 100)
    if (errorLogs.length > 100) {
      errorLogs = errorLogs.slice(-100);
    }

    console.log('✅ Ошибка залогирована:', errorLog);

    return NextResponse.json({ 
      success: true, 
      id: errorLog.id,
      totalErrors: errorLogs.length 
    });

  } catch (error) {
    console.error('Error in error-log endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint для получения статистики ошибок
export async function GET(request: NextRequest) {
  try {
    // Получить параметры запроса
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Фильтруем ошибки
    let filteredErrors = errorLogs;

    // Фильтр по времени
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    filteredErrors = filteredErrors.filter(error => 
      new Date(error.timestamp) >= cutoffDate
    );

    // Фильтр по типу
    if (type) {
      filteredErrors = filteredErrors.filter(error => error.type === type);
    }

    // Ограничиваем количество
    filteredErrors = filteredErrors.slice(-limit);

    // Подсчитываем статистику
    const stats = {
      total: filteredErrors.length,
      byType: filteredErrors.reduce((acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byComponent: filteredErrors.reduce((acc, error) => {
        acc[error.component] = (acc[error.component] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      critical: filteredErrors.filter(error => 
        error.type === 'auth' || 
        error.message.includes('Application error')
      ).length,
    };

    return NextResponse.json({
      errors: filteredErrors,
      stats,
    });

  } catch (error) {
    console.error('Error in error-log GET endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Получить информацию о браузере
function getBrowserInfo(userAgent: string | null): string | null {
  if (!userAgent) return null;
  
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  
  return 'Unknown';
}

// Получить информацию об операционной системе
function getOSInfo(userAgent: string | null): string | null {
  if (!userAgent) return null;
  
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS')) return 'iOS';
  
  return 'Unknown';
} 