import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

// Создаем клиент с service role для обхода RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    const update = await request.json()
    
    console.log('[TELEGRAM WEBHOOK] Received update:', JSON.stringify(update, null, 2))

    // Обрабатываем pre_checkout_query
    if (update.pre_checkout_query) {
      console.log('[TELEGRAM WEBHOOK] Processing pre_checkout_query')
      
      // Автоматически одобряем платеж
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query_id: update.pre_checkout_query.id,
          ok: true
        })
      })

      const result = await response.json()
      console.log('[TELEGRAM WEBHOOK] Pre-checkout response:', result)
    }

    // Обрабатываем successful_payment
    if (update.message?.successful_payment) {
      console.log('[TELEGRAM WEBHOOK] Processing successful_payment')
      
      const payment = update.message.successful_payment
      const userId = update.message.from.id
      const chargeId = payment.telegram_payment_charge_id
      const amount = payment.total_amount

      let payload = {}
      try {
        payload = JSON.parse(payment.invoice_payload)
      } catch (e) {
        console.error('[TELEGRAM WEBHOOK] Failed to parse payload:', payment.invoice_payload)
      }

      console.log('[TELEGRAM WEBHOOK] Payment details:', {
        userId,
        chargeId,
        amount,
        payload
      })

      // Сохраняем транзакцию в базу данных
      const { error: transactionError } = await supabaseAdmin
        .from('star_transactions')
        .insert({
          user_id: userId.toString(),
          telegram_payment_charge_id: chargeId,
          amount: amount,
          status: 'completed',
          payload: JSON.stringify(payload),
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })

      if (transactionError) {
        console.error('[TELEGRAM WEBHOOK] Error saving transaction:', transactionError)
      }

      // Обновляем баланс пользователя
      await updateUserBalance(userId.toString(), amount)

      console.log('[TELEGRAM WEBHOOK] Payment processed successfully')
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[TELEGRAM WEBHOOK] Error processing webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// Функция для обновления баланса пользователя
async function updateUserBalance(userId: string, starsAmount: number) {
  try {
    // Конвертируем звезды в игровую валюту (например, 1 звезда = 1 доллар)
    const gameAmount = starsAmount * 1 // Можно настроить курс конвертации

    // Получаем текущий баланс пользователя
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      console.error('[BALANCE UPDATE] User not found:', userId)
      return
    }

    // Обновляем баланс
    const newBalance = (userData.balance || 0) + gameAmount
    
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        balance: newBalance,
        last_login: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[BALANCE UPDATE] Error updating balance:', updateError)
    } else {
      console.log(`[BALANCE UPDATE] Updated balance for ${userId}: ${userData.balance} + ${gameAmount} = ${newBalance}`)
    }

  } catch (error) {
    console.error('[BALANCE UPDATE] Error:', error)
  }
} 