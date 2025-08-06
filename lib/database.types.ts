export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          username: string
          balance: number
          avatar: string | null
          games_played: number
          games_won: number
          wallet_address: string | null
          is_admin: boolean
          status: string
          created_at: string
          last_login: string | null
        }
        Insert: {
          id?: string
          username: string
          balance?: number
          avatar?: string | null
          games_played?: number
          games_won?: number
          wallet_address?: string | null
          is_admin?: boolean
          status?: string
          created_at?: string
          last_login?: string | null
        }
        Update: {
          id?: string
          username?: string
          balance?: number
          avatar?: string | null
          games_played?: number
          games_won?: number
          wallet_address?: string | null
          is_admin?: boolean
          status?: string
          created_at?: string
          last_login?: string | null
        }
      }
      games: {
        Row: {
          id: string
          board: Json
          current_player: string
          player_x: string | null
          player_o: string | null
          status: string
          bet_amount: number
          pot: number
          winner: string | null
          created_at: string
          ended_at: string | null
        }
        Insert: {
          id?: string
          board?: Json
          current_player?: string
          player_x?: string | null
          player_o?: string | null
          status?: string
          bet_amount?: number
          pot?: number
          winner?: string | null
          created_at?: string
          ended_at?: string | null
        }
        Update: {
          id?: string
          board?: Json
          current_player?: string
          player_x?: string | null
          player_o?: string | null
          status?: string
          bet_amount?: number
          pot?: number
          winner?: string | null
          created_at?: string
          ended_at?: string | null
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          type: string
          amount: number
          currency: string
          status: string
          wallet_address: string | null
          tx_hash: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          amount: number
          currency?: string
          status?: string
          wallet_address?: string | null
          tx_hash?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          amount?: number
          currency?: string
          status?: string
          wallet_address?: string | null
          tx_hash?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          type: string
          user_id: string
          amount: number | null
          status: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          type: string
          user_id: string
          amount?: number | null
          status?: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          type?: string
          user_id?: string
          amount?: number | null
          status?: string
          message?: string
          created_at?: string
        }
      }
      system_settings: {
        Row: {
          id: number
          platform_fee: number
          min_bet: number
          max_bet: number
          min_withdrawal: number
          maintenance_mode: boolean
          deposit_wallet_address: string
          platform_fee_vs_bot: number
          platform_fee_vs_player: number
          max_wins_per_user: number
          bot_win_probability: number
          updated_at: string
        }
        Insert: {
          id?: number
          platform_fee?: number
          min_bet?: number
          max_bet?: number
          min_withdrawal?: number
          maintenance_mode?: boolean
          deposit_wallet_address?: string
          platform_fee_vs_bot?: number
          platform_fee_vs_player?: number
          max_wins_per_user?: number
          bot_win_probability?: number
          updated_at?: string
        }
        Update: {
          id?: number
          platform_fee?: number
          min_bet?: number
          max_bet?: number
          min_withdrawal?: number
          maintenance_mode?: boolean
          deposit_wallet_address?: string
          platform_fee_vs_bot?: number
          platform_fee_vs_player?: number
          max_wins_per_user?: number
          bot_win_probability?: number
          updated_at?: string
        }
      }
      game_settings: {
        Row: {
          id: number
          bot_win_probability: number
          updated_at: string
        }
        Insert: {
          id?: number
          bot_win_probability?: number
          updated_at?: string
        }
        Update: {
          id?: number
          bot_win_probability?: number
          updated_at?: string
        }
      }
      withdraw_requests: {
        Row: {
          id: string
          user_id: string
          amount: number
          wallet_address: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          wallet_address: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          wallet_address?: string
          status?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Extend the existing database types to include new fields
export type ExtendedSystemSettings = Database['public']['Tables']['system_settings']['Row'] & {
  bot_win_probability?: number
  max_wins_per_user?: number
}

// Update the Database type to include the extended system_settings
export type ExtendedDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Omit<Database['public']['Tables'], 'system_settings'> & {
      system_settings: {
        Row: ExtendedSystemSettings
        Insert: ExtendedSystemSettings
        Update: ExtendedSystemSettings
      }
    }
  }
}
