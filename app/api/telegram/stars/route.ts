import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

// Создаем клиент с service role для обхода RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Создание invoice ссылки для Telegram Stars
export async function POST(request: NextRequest) {
  try {
    const { userId, amount, description = 'Game Balance Top-up' } = await request.json()

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'userId and valid amount are required' },
        { status: 400 }
      )
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: 'Telegram bot token not configured' },
        { status: 500 }
      )
    }

    // Создаем invoice через Telegram API
    const params = {
      title: 'Game Balance Top-up',
      description: description,
      payload: JSON.stringify({ userId, amount }),
      provider_token: '', // для Stars — пусто!
      currency: 'XTR', // Telegram Stars
      prices: [{ label: 'Stars', amount: amount }],
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/createInvoiceLink`
    
    console.log('[TELEGRAM STARS] Creating invoice:', { userId, amount, description })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    const data = await response.json()

    if (!data.ok) {
      throw new Error(data.description || 'Telegram API error')
    }

    // Создаем запись о транзакции в ожидании
    const sessionId = `stars_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const { error: transactionError } = await supabaseAdmin
      .from('star_transactions')
      .insert({
        session_id: sessionId,
        user_id: userId,
        amount: amount,
        status: 'pending',
        invoice_link: data.result,
        created_at: new Date().toISOString(),
      })

    if (transactionError) {
      console.error('Error creating transaction record:', transactionError)
      // Продолжаем, так как invoice уже создан
    }

    return NextResponse.json({
      success: true,
      invoiceLink: data.result,
      sessionId: sessionId,
      amount: amount
    })

  } catch (error) {
    console.error('[TELEGRAM STARS] Error creating invoice:', error)
    return NextResponse.json(
      { error: 'Failed to create payment link' },
      { status: 500 }
    )
  }
}

// Получение статуса транзакций пользователя
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const { data: transactions, error } = await supabaseAdmin
      .from('star_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      transactions: transactions || []
    })

  } catch (error) {
    console.error('[TELEGRAM STARS] Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
} 