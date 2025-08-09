import mysql from 'mysql2/promise'

/**
 * Инициализация таблицы пользователей
 */
export async function initUsersTable(pool) {
  const conn = await pool.getConnection()
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS users (
      userId VARCHAR(32) PRIMARY KEY,
      proActive BOOLEAN DEFAULT FALSE,
      proUntil DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)
    
    console.log('✅ Таблица users создана/проверена')
  } finally {
    conn.release()
  }
}


/**
 * Инициализация таблицы платежных транзакций
 */
export async function initPaymentTransactionsTable(pool) {
  try {
    const conn = await pool.getConnection()
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS payment_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT NOT NULL,
          telegram_payment_charge_id VARCHAR(255) NOT NULL UNIQUE,
          amount INT NOT NULL,
          period_months INT NOT NULL,
          status ENUM('paid', 'refunded') DEFAULT 'paid',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          refunded_at TIMESTAMP NULL,
          INDEX idx_user_id (user_id),
          INDEX idx_charge_id (telegram_payment_charge_id),
          INDEX idx_status (status),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      console.log('✅ Таблица payment_transactions инициализирована')
    } finally {
      conn.release()
    }
  } catch (error) {
    console.error('❌ Ошибка инициализации таблицы payment_transactions:', error)
  }
}


/**
 * Инициализация всех таблиц базы данных
 */
export async function initializeAllTables(pool) {
  console.log('🔄 Инициализация таблиц базы данных...')
  
  try {
    await initUsersTable(pool)
    await initReportsTable(pool)
    await initPromoChannelsTable(pool)
    await initManagedChannelsTable(pool)
    await initCngChannelsTable(pool)
    await initPaymentTransactionsTable(pool)
    await initTariffsTable(pool)
    await addHiddenFieldToChannelsTables(pool)
    
    console.log('✅ Все таблицы успешно инициализированы')
  } catch (error) {
    console.error('❌ Ошибка инициализации таблиц:', error)
    throw error
  }
} 