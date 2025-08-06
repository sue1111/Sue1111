// User-related types
export interface UserData {
  id: string
  username: string
  password: string
  balance: number
  avatar: string | null
  gamesPlayed: number
  gamesWon: number
  totalWinnings: number
  walletAddress?: string
  isAdmin: boolean
  status: "active" | "banned" | "pending"
  createdAt: string
  lastLogin?: string
}

// Game-related types
export interface Player {
  id: string
  username: string
  avatar: string | null
}

export interface GameState {
  id: string
  board: (string | null)[]
  currentPlayer: string
  players: {
    X: Player
    O: Player | null
  }
  status: "waiting" | "playing" | "completed" | "draw" // Убедимся, что это соответствует ограничению в БД
  betAmount: number
  pot: number
  winner: string | null
  createdAt: string
  aiNickname?: string
}

// Transaction-related types
export interface Transaction {
  id: string
  userId: string
  username?: string
  type: string
  amount: number
  currency: string
  status: string
  walletAddress?: string
  txHash?: string
  createdAt: string
  completedAt?: string
}

// Notification-related types
export interface Notification {
  id: string
  type: "deposit_request" | "withdrawal_request" | "system"
  user_id: string
  username: string
  amount?: number
  status: "pending" | "approved" | "rejected"
  message: string
  createdAt: string
}

// Settings-related types
export interface SystemSettings {
  minBet: number
  maxBet: number
  minWithdrawal: number
  maintenanceMode: boolean
  depositWalletAddress: string
  depositFee: number
}

export interface GameSettings {
  botWinProbability: number
}

// Leaderboard-related types
export interface LeaderboardPlayer {
  id: string
  username: string
  avatar: string | null
  gamesWon: number
  winnings: number
}
