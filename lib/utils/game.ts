// Helper function to calculate winner
export function calculateWinner(board: (string | null)[]): string | null {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ]

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]
    }
  }

  return null
}

// Helper function to get best move for AI
export function getBestMove(board: (string | null)[], player: string): number | null {
  const opponent = player === "X" ? "O" : "X"

  // Check if AI can win in the next move
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) {
      const boardCopy = [...board]
      boardCopy[i] = player
      if (calculateWinner(boardCopy) === player) {
        return i
      }
    }
  }

  // Check if player can win in the next move and block them
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) {
      const boardCopy = [...board]
      boardCopy[i] = opponent
      if (calculateWinner(boardCopy) === opponent) {
        return i
      }
    }
  }

  // Try to take the center
  if (board[4] === null) {
    return 4
  }

  // Try to take the corners
  const corners = [0, 2, 6, 8]
  const availableCorners = corners.filter((i) => board[i] === null)
  if (availableCorners.length > 0) {
    return availableCorners[Math.floor(Math.random() * availableCorners.length)]
  }

  // Take any available edge
  const edges = [1, 3, 5, 7]
  const availableEdges = edges.filter((i) => board[i] === null)
  if (availableEdges.length > 0) {
    return availableEdges[Math.floor(Math.random() * availableEdges.length)]
  }

  return null
}
