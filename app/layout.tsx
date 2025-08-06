import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { SupabaseProvider } from "@/components/supabase-provider"
import ErrorBoundary from "@/components/error-boundary"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "TicTacToe Game",
  description: "Play TicTacToe and win rewards",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <SupabaseProvider>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
              {children}
              <Toaster />
            </ThemeProvider>
          </SupabaseProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
