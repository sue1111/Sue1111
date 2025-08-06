"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { GameResultsTable } from "./game-results-table"
import { GameResultsFilter } from "./game-results-filter"
import { GameResultsPagination } from "./game-results-pagination"
import { GameResultsVisualizations } from "./game-results-visualizations"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"

export interface GameResult {
  id: string
  player_x: string
  player_o: string
  winner: string
  played_at: string
}

export interface FilterOptions {
  winner: string
  startDate: string | null
  endDate: string | null
  searchTerm: string
}

export function GameResultsDashboard() {
  const [results, setResults] = useState<GameResult[]>([])
  const [filteredResults, setFilteredResults] = useState<GameResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof GameResult>("played_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [filters, setFilters] = useState<FilterOptions>({
    winner: "all",
    startDate: null,
    endDate: null,
    searchTerm: "",
  })

  const resultsPerPage = 10

  // Fetch data from Supabase
  useEffect(() => {
    async function fetchGameResults() {
      try {
        setLoading(true)
        setError(null)

        let query = supabase
          .from("tictactoe_results")
          .select("*")
          .order(sortColumn, { ascending: sortDirection === "asc" })

        // Apply filters
        if (filters.winner && filters.winner !== "all") {
          query = query.eq("winner", filters.winner)
        }

        if (filters.startDate) {
          query = query.gte("played_at", filters.startDate)
        }

        if (filters.endDate) {
          query = query.lte("played_at", filters.endDate)
        }

        if (filters.searchTerm) {
          query = query.or(`player_x.ilike.%${filters.searchTerm}%,player_o.ilike.%${filters.searchTerm}%`)
        }

        const { data, error } = await query

        if (error) {
          throw new Error(error.message)
        }

        if (data) {
          setResults(data as GameResult[])
          setTotalPages(Math.ceil(data.length / resultsPerPage))
          setCurrentPage(1) // Reset to first page when filters change
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchGameResults()
  }, [filters, sortColumn, sortDirection])

  // Apply pagination to results
  useEffect(() => {
    const start = (currentPage - 1) * resultsPerPage
    const end = start + resultsPerPage
    setFilteredResults(results.slice(start, end))
  }, [results, currentPage])

  // Handle sorting
  const handleSort = (column: keyof GameResult) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  // Handle filter changes
  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters)
  }

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // Handle result deletion
  const handleDeleteResult = async (id: string) => {
    try {
      setLoading(true)
      const { error } = await supabase.from("tictactoe_results").delete().eq("id", id)

      if (error) {
        throw new Error(error.message)
      }

      // Refresh results after deletion
      setResults(results.filter((result) => result.id !== id))

      // Update total pages
      const newTotalPages = Math.ceil((results.length - 1) / resultsPerPage)
      setTotalPages(newTotalPages)

      // Adjust current page if needed
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete result")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Game Results</CardTitle>
          <CardDescription>View and manage Tic-Tac-Toe game results</CardDescription>
        </CardHeader>
        <CardContent>
          <GameResultsFilter filters={filters} onFilterChange={handleFilterChange} />
        </CardContent>
      </Card>

      <Tabs defaultValue="table">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="table">Table View</TabsTrigger>
          <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <GameResultsTable
                    results={filteredResults}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    onDelete={handleDeleteResult}
                  />

                  <div className="mt-6">
                    <GameResultsPagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visualizations" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <GameResultsVisualizations results={results} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
