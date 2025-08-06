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
