import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('ProcessWithdrawAPI')

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = params.id
    const { action, adminId } = await request.json() // action: 'approve' | 'reject'

    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      )
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be approve or reject' },
        { status: 400 }
      )
    }

    if (!adminId) {
      return NextResponse.json(
        { error: 'Admin ID is required' },
        { status: 400 }
      )
    }

    const directSupabase = getSupabaseServerClient()

    // Получаем заявку на вывод
    const { data: withdrawRequest, error: requestError } = await directSupabase
      .from('withdraw_requests')
      .select('*')
      .eq('id', requestId as any)
      .single()

    if (requestError || !withdrawRequest) {
      logger.error(`Withdraw request not found: ${requestId}`)
      return NextResponse.json(
        { error: 'Withdraw request not found' },
        { status: 404 }
      )
    }

    // Проверяем, что заявка в статусе pending
    if ((withdrawRequest as any).status !== 'pending') {
      logger.error(`Withdraw request ${requestId} is not pending`)
      return NextResponse.json(
        { error: 'Withdraw request is not pending' },
        { status: 400 }
      )
    }

    // Проверяем, что админ существует
    const { data: adminData, error: adminError } = await directSupabase
      .from('users')
      .select('is_admin')
      .eq('id', adminId)
      .single()

    if (adminError || !adminData || !(adminData as any).is_admin) {
      logger.error(`Admin not found or not admin: ${adminId}`)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const updatedAt = new Date().toISOString()

    // Обновляем статус заявки
    const { error: updateError } = await directSupabase
      .from('withdraw_requests')
      .update({
        status: newStatus,
        processed_by: adminId,
        processed_at: updatedAt
      } as any)
      .eq('id', requestId as any)

    if (updateError) {
      logger.error(`Error updating withdraw request: ${updateError.message}`)
      return NextResponse.json(
        { error: 'Failed to update withdraw request' },
        { status: 500 }
      )
    }

    // Если заявка отклонена, возвращаем средства пользователю
    if (action === 'reject') {
      const { data: userData, error: userError } = await directSupabase
        .from('users')
        .select('balance')
        .eq('id', (withdrawRequest as any).user_id)
        .single()

      if (!userError && userData) {
        const newBalance = (userData as any).balance + (withdrawRequest as any).amount
        
        const { error: balanceError } = await directSupabase
          .from('users')
          .update({ balance: newBalance } as any)
          .eq('id', (withdrawRequest as any).user_id)

        if (balanceError) {
          logger.error(`Error returning balance: ${balanceError.message}`)
        } else {
          logger.info(`Returned ${(withdrawRequest as any).amount} to user ${(withdrawRequest as any).user_id}`)
        }
      }
    }

    // Создаем транзакцию
    const transactionData = {
      user_id: (withdrawRequest as any).user_id,
      type: action === 'approve' ? 'withdrawal' : 'withdrawal_rejected',
      amount: (withdrawRequest as any).amount,
      currency: 'USDT',
      status: action === 'approve' ? 'completed' : 'rejected',
      wallet_address: (withdrawRequest as any).wallet_address,
      created_at: updatedAt
    }

    const { error: transactionError } = await directSupabase
      .from('transactions')
      .insert(transactionData as any)

    if (transactionError) {
      logger.error(`Error creating transaction: ${transactionError.message}`)
    }

    logger.info(`Withdraw request ${requestId} ${action}ed by admin ${adminId}`)

    return NextResponse.json({
      success: true,
      message: `Withdraw request ${action}ed successfully`,
      status: newStatus
    })

  } catch (error) {
    logger.error(`Unexpected error in process withdraw: ${error}`)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 