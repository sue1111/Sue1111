import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Tic-Tac-Toe Admin Dashboard",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex min-h-screen flex-col">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
