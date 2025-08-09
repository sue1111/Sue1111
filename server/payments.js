import express from 'express';
import axios from 'axios';
import { Telegraf } from 'telegraf';
import { createDatabasePool } from './database/connection.js';

const pool = createDatabasePool();

const orders = {};

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
console.log('[CHECK] TELEGRAM_BOT_TOKEN:', TELEGRAM_BOT_TOKEN);

const router = express.Router();

// Telegraf bot для обработки успешной оплаты
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));
bot.on('successful_payment', async (ctx) => {
  try {
    let periodMonths = 3;
    try {
      const payload = JSON.parse(ctx.message.successful_payment.invoice_payload);
      if (payload && payload.periodMonths) periodMonths = payload.periodMonths;
    } catch (e) {}
    
    // Сохраняем транзакцию в базу данных
    const conn = await pool.getConnection();
    try {
      await conn.query(`
        INSERT INTO payment_transactions 
        (user_id, telegram_payment_charge_id, amount, period_months) 
        VALUES (?, ?, ?, ?)
      `, [
        ctx.from.id,
        ctx.message.successful_payment.telegram_payment_charge_id,
        ctx.message.successful_payment.total_amount,
        periodMonths
      ]);
    } finally {
      conn.release();
    }
    
    // Активируем PRO
    await activatePro(ctx.from.id, periodMonths);
    
    // Сообщение в бота не отправляем
  } catch (e) {
    console.error('Ошибка обработки платежа:', e.message);
    ctx.reply('❌ Ошибка обработки платежа. Обратитесь к администратору.');
  }
});
bot.launch();

// Глобальный middleware для логирования всех запросов к payments.js
router.use((req, res, next) => {
  console.log('[TG PAYMENTS][INCOMING]', req.method, req.originalUrl);
  next();
});

// Создание invoice через Telegram API
router.post('/pay/invoice-link', async (req, res) => {
  try {
    let { userId, amount, label, description, periodMonths, sessionId } = req.body;
    // Гарантируем, что title и label всегда строка
    const safeLabel = (typeof label === 'string' && label.trim()) ? label : 'PRO подписка';
    const safeDescription = (typeof description === 'string' && description.trim()) ? description : 'Доступ к PRO функциям';
    const safeAmount = (typeof amount === 'number' && amount > 0) ? amount : 100;
    const params = {
      title: safeLabel,
      description: safeDescription,
      payload: JSON.stringify({ periodMonths }),
      provider_token: '', // для Stars — пусто!
      currency: 'XTR',
      prices: [{ label: safeLabel, amount: safeAmount }],
    };
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/createInvoiceLink`;
    console.log('[INVOICE-LINK][RAW] URL:', url);
    console.log('[INVOICE-LINK][RAW] PARAMS:', JSON.stringify(params));
    const response = await axios.post(url, params);
    console.log('[INVOICE-LINK][RAW] RESPONSE:', response.data);
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15);
    }
    orders[sessionId] = { paid: false, userId, periodMonths };
    if (response.data.ok) {
      res.json({ invoiceLink: response.data.result, sessionId });
    } else {
      throw new Error(response.data.description || 'Ошибка Telegram');
    }
  } catch (e) {
    console.error('[INVOICE-LINK][RAW] Ошибка:', e, e.response?.data);
    res.status(500).json({ error: 'Ошибка создания invoiceLink', details: e.message, tg: e.response?.data });
  }
});

// ====== Подписка и активация PRO ======

// Добавляю функцию для добавления календарных месяцев
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// periodMonths — количество месяцев подписки (по умолчанию 3)
async function activatePro(userId, periodMonths = 3) {
  const conn = await pool.getConnection();
  try {
    // Проверяем, есть ли пользователь
    const [rows] = await conn.query('SELECT * FROM users WHERE userId = ?', [userId]);
    const now = new Date();
    let baseDate = now;
    let newProUntil;
    if (rows.length === 0) {
      // Новый пользователь — срок от текущей даты
      newProUntil = addMonths(now, periodMonths).toISOString();
      await conn.query('INSERT INTO users (userId, proActive, proUntil) VALUES (?, ?, ?)', [userId, true, newProUntil]);
      console.log(`[PRO ACTIVATE] Новый пользователь: userId=${userId}, periodMonths=${periodMonths}, baseDate=${now.toISOString()}, newProUntil=${newProUntil}`);
    } else {
      // Уже есть пользователь
      const user = rows[0];
      if (user.proUntil && new Date(user.proUntil) > now) {
        baseDate = new Date(user.proUntil);
      }
      newProUntil = addMonths(baseDate, periodMonths).toISOString();
      await conn.query('UPDATE users SET proActive = ?, proUntil = ? WHERE userId = ?', [true, newProUntil, userId]);
      console.log(`[PRO ACTIVATE] userId=${userId}, periodMonths=${periodMonths}, oldProUntil=${user.proUntil}, baseDate=${baseDate.toISOString()}, newProUntil=${newProUntil}`);
    }
  } finally {
    conn.release();
  }
}

// Проверка подписки: возвращает объект с isActive, proUntil, timeLeft
async function getProStatus(userId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM users WHERE userId = ?', [userId]);
    const now = new Date();
    let isActive = false;
    let proUntil = null;
    let timeLeft = 0;
    if (rows.length > 0 && rows[0].proUntil) {
      proUntil = rows[0].proUntil;
      const untilDate = new Date(proUntil);
      if (untilDate > now) {
        isActive = true;
        timeLeft = Math.floor((untilDate - now) / 1000); // в секундах
      } else {
        // Снимаем proActive, если срок истёк
        await conn.query('UPDATE users SET proActive = ? WHERE userId = ?', [false, userId]);
      }
    }
    return { isActive, proUntil, timeLeft };
  } finally {
    conn.release();
  }
}

// Endpoint для активации PRO
router.post('/activate-pro', async (req, res) => {
  const { userId, periodMonths } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })
  await activatePro(userId, periodMonths || 3)
  res.json({ ok: true })
})

// Endpoint для проверки подписки пользователя
router.get('/user/pro', async (req, res) => {
  const userId = req.query.userId
  const status = await getProStatus(userId)
  const now = new Date().toISOString()
  console.log(`[USER/PRO] ${now} userId: ${userId}, status:`, status)
  res.json(status)
})

// ====== ВОЗВРАТ ЗВЕЗД ======

// Функция для возврата звезд через Telegram API
async function refundStarPayment(userId, chargeId) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/refundStarPayment`,
      {
        user_id: userId,
        telegram_payment_charge_id: chargeId
      }
    );
    
    if (response.data.ok) {
      return { success: true, data: response.data.result };
    } else {
      throw new Error(response.data.description || 'Ошибка возврата');
    }
  } catch (error) {
    console.error('Ошибка возврата звезд:', error.response?.data || error.message);
    throw error;
  }
}

// Endpoint для возврата звезд (для пользователей)
router.post('/refund', async (req, res) => {
  try {
    const { userId, chargeId } = req.body;
    
    if (!userId || !chargeId) {
      return res.status(400).json({ 
        error: 'userId и chargeId обязательны' 
      });
    }
    
    // Проверяем, существует ли транзакция
    const conn = await pool.getConnection();
    try {
      const [transactions] = await conn.query(`
        SELECT * FROM payment_transactions 
        WHERE user_id = ? AND telegram_payment_charge_id = ?
      `, [userId, chargeId]);
      
      if (transactions.length === 0) {
        return res.status(404).json({ 
          error: 'Транзакция не найдена' 
        });
      }
      
      const transaction = transactions[0];
      
      if (transaction.status === 'refunded') {
        return res.status(400).json({ 
          error: 'Возврат уже был выполнен ранее' 
        });
      }
      
      // Выполняем возврат через Telegram API
      await refundStarPayment(userId, chargeId);
      
      // Обновляем статус в базе данных
      await conn.query(`
        UPDATE payment_transactions 
        SET status = 'refunded', refunded_at = NOW() 
        WHERE id = ?
      `, [transaction.id]);
      
      // Отменяем PRO подписку
      await conn.query(`
        UPDATE users 
        SET proActive = FALSE, proUntil = NULL 
        WHERE userId = ?
      `, [userId]);
      
      res.json({ 
        success: true, 
        message: 'Возврат выполнен успешно',
        refundedAmount: transaction.amount
      });
      
    } finally {
      conn.release();
    }
    
  } catch (error) {
    console.error('Ошибка возврата:', error);
    
    let errorMessage = 'Ошибка возврата';
    if (error.response?.data?.description) {
      if (error.response.data.description.includes('CHARGE_ALREADY_REFUNDED')) {
        errorMessage = 'Возврат уже был выполнен ранее';
      } else if (error.response.data.description.includes('CHARGE_NOT_FOUND')) {
        errorMessage = 'Транзакция не найдена';
      } else {
        errorMessage = error.response.data.description;
      }
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Endpoint для получения списка транзакций пользователя
router.get('/user/transactions', async (req, res) => {
  console.log('[PAYMENTS][USER/TRANSACTIONS] Запрос:', req.query);
  try {
    const { userId } = req.query;
    
    if (!userId) {
      console.log('[PAYMENTS][USER/TRANSACTIONS] Ошибка: userId не предоставлен');
      return res.status(400).json({ error: 'userId обязателен' });
    }
    
    const conn = await pool.getConnection();
    try {
      const [transactions] = await conn.query(`
        SELECT * FROM payment_transactions 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `, [userId]);
      
      res.json({ 
        success: true, 
        transactions: transactions 
      });
      
    } finally {
      conn.release();
    }
    
  } catch (error) {
    console.error('Ошибка получения транзакций:', error);
    res.status(500).json({ error: 'Ошибка получения транзакций' });
  }
});

// Endpoint для получения всех транзакций (для админов)
router.get('/admin/transactions', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    try {
      const [transactions] = await conn.query(`
        SELECT pt.*, u.proActive, u.proUntil
        FROM payment_transactions pt
        LEFT JOIN users u ON pt.user_id = u.userId
        ORDER BY pt.created_at DESC
      `);
      
      res.json({ 
        success: true, 
        transactions: transactions 
      });
      
    } finally {
      conn.release();
    }
    
  } catch (error) {
    console.error('Ошибка получения транзакций:', error);
    res.status(500).json({ error: 'Ошибка получения транзакций' });
  }
});

export default router; 