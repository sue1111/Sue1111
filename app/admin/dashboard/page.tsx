import type { Metadata } from "next"
import { GameResultsDashboard } from "@/components/admin/game-results-dashboard"

export const metadata: Metadata = {
  title: "Tic-Tac-Toe Admin Dashboard",
  description: "Admin dashboard for managing Tic-Tac-Toe game results",
}

export default function AdminDashboardPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Tic-Tac-Toe Admin Dashboard</h1>
      <GameResultsDashboard />
    </div>
  )
}
