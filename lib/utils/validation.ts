// Helper functions for input validation

export function validateUsername(username: string): boolean {
  // Username should be 3-20 characters and contain only letters, numbers, and underscores
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
  return usernameRegex.test(username)
}

export function validateWalletAddress(address: string, type: "trc20" | "erc20" = "trc20"): boolean {
  if (!address) return false

  if (type === "trc20") {
    // TRC20 addresses start with T and are 34 characters long
    return /^T[a-zA-Z0-9]{33}$/.test(address)
  } else if (type === "erc20") {
    // ERC20 addresses are 42 characters long including the 0x prefix
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  return false
}

export function validateAmount(amount: number, min: number, max: number): boolean {
  return !isNaN(amount) && amount >= min && amount <= max
}

export function sanitizeInput(input: string): string {
  // Basic sanitization to prevent XSS
  return input.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;")
}

// Безопасная валидация UUID
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Безопасная валидация числовых значений
export function isValidNumber(value: any): boolean {
  return typeof value === 'number' && isFinite(value) && !isNaN(value);
}

// Безопасная валидация целых чисел
export function isValidInteger(value: any): boolean {
  return isValidNumber(value) && Number.isInteger(value);
}

// Безопасная валидация строки
export function isValidString(value: any): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= 1000;
}

// Безопасная валидация email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Безопасная валидация игрового статуса
export function isValidGameStatus(status: string): boolean {
  const validStatuses = ['waiting', 'playing', 'completed', 'draw', 'paused'];
  return validStatuses.includes(status);
}

// Безопасная валидация типа транзакции
export function isValidTransactionType(type: string): boolean {
  const validTypes = ['deposit', 'withdrawal', 'bet', 'win', 'refund'];
  return validTypes.includes(type);
}

// Безопасная валидация статуса транзакции
export function isValidTransactionStatus(status: string): boolean {
  const validStatuses = ['pending', 'completed', 'failed'];
  return validStatuses.includes(status);
}

// Функция для безопасного создания объекта обновления
export function createSafeUpdateObject(data: Record<string, any>): Record<string, any> {
  const safeData: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Проверяем, что ключ безопасен (только буквы, цифры и подчеркивания)
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      // Проверяем значение в зависимости от типа поля
      if (key.includes('balance') || key.includes('winnings') || key.includes('amount')) {
        if (isValidNumber(value)) {
          safeData[key] = value;
        }
      } else if (key.includes('games_played') || key.includes('games_won')) {
        if (isValidInteger(value)) {
          safeData[key] = value;
        }
      } else if (key.includes('status')) {
        if (isValidString(value)) {
          safeData[key] = value;
        }
      } else if (key.includes('id')) {
        if (isValidUUID(value)) {
          safeData[key] = value;
        }
      } else if (isValidString(value)) {
        safeData[key] = value;
      }
    }
  }
  
  return safeData;
}
