import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/supabase-server"
import { Database, ExtendedDatabase } from "@/lib/database.types"

type SystemSettingsRow = ExtendedDatabase['public']['Tables']['system_settings']['Row']
type GameSettingsRow = Database['public']['Tables']['game_settings']['Row']

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "system"
    const adminId = searchParams.get("adminId")

    // Log the request for debugging
    console.log(`Settings request - type: ${type}, adminId: ${adminId || "not provided"}`)

    const supabase = getSupabaseServerClient()

    if (type === "system") {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .single()

      const settings = data as SystemSettingsRow | null

      if (error || !settings) {
        // Create initial record if none exists
        const { error: createError } = await supabase
          .from("system_settings")
          .insert([{
            id: 1,
            platform_fee: 20.00,
            min_bet: 1,
            max_bet: 1000,
            min_withdrawal: 10,
            maintenance_mode: false,
            platform_fee_vs_bot: 20.00,
            platform_fee_vs_player: 10.00,
            max_wins_per_user: 3,
            bot_win_probability: 50.00,
            updated_at: new Date().toISOString()
          }] as any)

        if (createError) {
          console.error("Error creating initial system settings:", createError)
        }

        // Return default system settings
        return NextResponse.json({
          platformFee: 20,
          minBet: 1,
          maxBet: 1000,
          minWithdrawal: 10,
          maintenanceMode: false,
          depositWalletAddress: "",
          platformFeeVsBot: 20,
          platformFeeVsPlayer: 10,
          // New default values
          botWinPercentage: 50,
          maxWinsPerUser: 3,
        })
      }

      return NextResponse.json({
        platformFee: settings.platform_fee,
        minBet: settings.min_bet,
        maxBet: settings.max_bet,
        minWithdrawal: settings.min_withdrawal,
        maintenanceMode: settings.maintenance_mode,
        depositWalletAddress: settings.deposit_wallet_address,
        platformFeeVsBot: settings.platform_fee_vs_bot,
        platformFeeVsPlayer: settings.platform_fee_vs_player,
        // New fields
        botWinPercentage: (settings as any).bot_win_probability || 50,
        maxWinsPerUser: (settings as any).max_wins_per_user || 3,
      })
    } else if (type === "game") {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .single()

      const settings = data as SystemSettingsRow | null

      if (error || !settings) {
        // Create initial record if none exists
        const { error: createError } = await supabase
          .from("system_settings")
          .insert([{
            id: 1,
            platform_fee: 20.00,
            min_bet: 1,
            max_bet: 1000,
            min_withdrawal: 10,
            maintenance_mode: false,
            platform_fee_vs_bot: 20.00,
            platform_fee_vs_player: 10.00,
            max_wins_per_user: 3,
            bot_win_probability: 50.00,
            updated_at: new Date().toISOString()
          }] as any)

        if (createError) {
          console.error("Error creating initial system settings:", createError)
        }

        // Return default game settings
        return NextResponse.json({
          type: "game",
          settings: {
            difficultyLevel: "50",
            maxWinsPerUser: 3
          }
        })
      }

      // For admin game settings, return game-specific settings
      return NextResponse.json({
        type: "game",
        settings: {
          difficultyLevel: ((settings as any).bot_win_probability || 50).toString(),
          maxWinsPerUser: (settings as any).max_wins_per_user || 3
        }
      })
    } else if (type === "game-client") {
      // Endpoint for clients to get game settings (no admin required)
      const { data, error } = await supabase
        .from("system_settings")
        .select("bot_win_probability, max_wins_per_user")
        .single()

      const settings = data as any

      if (error || !settings) {
        // Return default settings if none found
        return NextResponse.json({
          botWinPercentage: 50,
          maxWinsPerUser: 3
        })
      }

      return NextResponse.json({
        botWinPercentage: settings.bot_win_probability || 50,
        maxWinsPerUser: settings.max_wins_per_user || 3
      })
    } else {
      return NextResponse.json({ error: "Invalid settings type" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { type, ...updates } = await request.json()

    if (!type) {
      return NextResponse.json({ error: "Settings type is required" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    if (type === "system") {
      // Convert from camelCase to snake_case for database
      const dbUpdates: Partial<SystemSettingsRow> = {}

      // Existing fields
      if ("platformFee" in updates) dbUpdates.platform_fee = updates.platformFee
      if ("minBet" in updates) dbUpdates.min_bet = updates.minBet
      if ("maxBet" in updates) dbUpdates.max_bet = updates.maxBet
      if ("minWithdrawal" in updates) dbUpdates.min_withdrawal = updates.minWithdrawal
      if ("maintenanceMode" in updates) dbUpdates.maintenance_mode = updates.maintenanceMode
      if ("depositWalletAddress" in updates) dbUpdates.deposit_wallet_address = updates.depositWalletAddress
      if ("platformFeeVsBot" in updates) dbUpdates.platform_fee_vs_bot = updates.platformFeeVsBot
      if ("platformFeeVsPlayer" in updates) dbUpdates.platform_fee_vs_player = updates.platformFeeVsPlayer
      
      // New fields
      if ("botWinPercentage" in updates) (dbUpdates as any).bot_win_probability = updates.botWinPercentage
      if ("maxWinsPerUser" in updates) (dbUpdates as any).max_wins_per_user = updates.maxWinsPerUser

      dbUpdates.updated_at = new Date().toISOString()

      // Log the update operation for debugging
      console.log("Updating system settings with:", dbUpdates)

      // First, check if a record exists
      const { data: existingRecord } = await supabase
        .from("system_settings")
        .select("id")
        .limit(1)

      if (!existingRecord || existingRecord.length === 0) {
        // Create initial record with default values
        const { error: createError } = await supabase
          .from("system_settings")
          .insert([{
            id: 1,
            platform_fee: 20.00,
            min_bet: 1,
            max_bet: 1000,
            min_withdrawal: 10,
            maintenance_mode: false,
            platform_fee_vs_bot: 20.00,
            platform_fee_vs_player: 10.00,
            max_wins_per_user: 3,
            bot_win_probability: 50.00,
            updated_at: new Date().toISOString()
          }] as any)

        if (createError) {
          console.error("Error creating initial system settings:", createError)
          return NextResponse.json({ error: "Failed to create system settings", details: createError }, { status: 500 })
        }
      }

      // Use upsert to update the record (will create if doesn't exist)
      const { data, error } = await supabase
        .from("system_settings")
        .upsert([{ id: 1, ...dbUpdates } as any])
        .select()

      if (error) {
        console.error("Error updating system settings:", error)
        return NextResponse.json({ error: "Failed to update system settings", details: error }, { status: 500 })
      }

      console.log("Settings updated successfully:", data)

      // Fetch and return updated settings
      const { data: updatedData, error: fetchError } = await supabase
        .from("system_settings")
        .select("*")
        .eq("id", 1 as any)
        .single()

      const updatedSettings = updatedData as SystemSettingsRow | null

      if (fetchError || !updatedSettings) {
        console.error("Error fetching updated system settings:", fetchError)
        return NextResponse.json({ error: "Failed to fetch updated system settings", details: fetchError }, { status: 500 })
      }

      return NextResponse.json({
        platformFee: updatedSettings.platform_fee,
        minBet: updatedSettings.min_bet,
        maxBet: updatedSettings.max_bet,
        minWithdrawal: updatedSettings.min_withdrawal,
        maintenanceMode: updatedSettings.maintenance_mode,
        depositWalletAddress: updatedSettings.deposit_wallet_address,
        platformFeeVsBot: updatedSettings.platform_fee_vs_bot,
        platformFeeVsPlayer: updatedSettings.platform_fee_vs_player,
        // New fields
        botWinPercentage: (updatedSettings as any).bot_win_probability || 50,
        maxWinsPerUser: (updatedSettings as any).max_wins_per_user || 10,
      })
    }
    // Placeholder for other settings types
    return NextResponse.json({ error: "Invalid settings type" }, { status: 400 })
  } catch (error) {
    console.error("Error updating settings:", error)
    return NextResponse.json({ error: "Internal server error", details: error }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { adminId, settings } = await request.json()

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID is required" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Преобразуем настройки игры в формат базы данных
    const botWinProbability = Number.parseFloat(settings.difficultyLevel) || 50
    const maxWinsPerUser = settings.maxWinsPerUser

    console.log(`Saving game settings: botWinProbability=${botWinProbability}, maxWinsPerUser=${maxWinsPerUser}`)

    // Проверяем, существует ли запись в system_settings
    const { data: existingRecord } = await supabase
      .from("system_settings")
      .select("id")
      .limit(1)

    if (!existingRecord || existingRecord.length === 0) {
      // Создаем начальную запись с настройками по умолчанию
      const { error: createError } = await supabase
        .from("system_settings")
        .insert([{
          id: 1,
          platform_fee: 20.00,
          min_bet: 1,
          max_bet: 1000,
          min_withdrawal: 10,
          maintenance_mode: false,
          platform_fee_vs_bot: 20.00,
          platform_fee_vs_player: 10.00,
          max_wins_per_user: maxWinsPerUser,
          bot_win_probability: botWinProbability,
          updated_at: new Date().toISOString()
        }] as any)

      if (createError) {
        console.error("Error creating initial system settings:", createError)
        return NextResponse.json({ 
          error: "Не удалось создать настройки системы", 
          details: createError 
        }, { status: 500 })
      }
    } else {
      // Обновляем существующую запись
      const { error: updateError } = await supabase
        .from("system_settings")
        .update({
          max_wins_per_user: maxWinsPerUser,
          bot_win_probability: botWinProbability,
          updated_at: new Date().toISOString()
        } as any)
        .eq("id", 1 as any)

      if (updateError) {
        console.error("Ошибка обновления настроек игры:", updateError)
        return NextResponse.json({ 
          error: "Не удалось обновить настройки игры", 
          details: updateError 
        }, { status: 500 })
      }
    }

    console.log("Game settings saved successfully")

    // Возвращаем сохраненные настройки
    return NextResponse.json({
      type: "game",
      settings: {
        difficultyLevel: botWinProbability.toString(),
        maxWinsPerUser: maxWinsPerUser
      }
    })
  } catch (error) {
    console.error("Ошибка сохранения настроек игры:", error)
    return NextResponse.json({ 
      error: "Внутренняя ошибка сервера", 
      details: error 
    }, { status: 500 })
  }
}
