"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowUpDown, MoreHorizontal, Trash } from "lucide-react"
import type { GameResult } from "./game-results-dashboard"

interface GameResultsTableProps {
  results: GameResult[]
  sortColumn: keyof GameResult
  sortDirection: "asc" | "desc"
  onSort: (column: keyof GameResult) => void
  onDelete: (id: string) => void
}

export function GameResultsTable({ results, sortColumn, sortDirection, onSort, onDelete }: GameResultsTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleDeleteClick = (id: string) => {
    setDeleteId(id)
  }

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId)
      setDeleteId(null)
    }
  }

  const handleCancelDelete = () => {
    setDeleteId(null)
  }

  const getWinnerBadge = (winner: string) => {
    if (winner === "draw") {
      return <Badge variant="outline">Draw</Badge>
    } else if (winner.includes("X")) {
      return <Badge className="bg-blue-500">X Won</Badge>
    } else {
      return <Badge className="bg-red-500">O Won</Badge>
    }
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">
                <Button
                  variant="ghost"
                  onClick={() => onSort("player_x")}
                  className="flex items-center gap-1 font-medium"
                >
                  Player X{sortColumn === "player_x" && <ArrowUpDown className="h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead className="w-[200px]">
                <Button
                  variant="ghost"
                  onClick={() => onSort("player_o")}
                  className="flex items-center gap-1 font-medium"
                >
                  Player O{sortColumn === "player_o" && <ArrowUpDown className="h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead className="w-[150px]">
                <Button
                  variant="ghost"
                  onClick={() => onSort("winner")}
                  className="flex items-center gap-1 font-medium"
                >
                  Winner
                  {sortColumn === "winner" && <ArrowUpDown className="h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead className="w-[200px]">
                <Button
                  variant="ghost"
                  onClick={() => onSort("played_at")}
                  className="flex items-center gap-1 font-medium"
                >
                  Played At
                  {sortColumn === "played_at" && <ArrowUpDown className="h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            ) : (
              results.map((result) => (
                <TableRow key={result.id}>
                  <TableCell className="font-medium">{result.player_x}</TableCell>
                  <TableCell>{result.player_o}</TableCell>
                  <TableCell>{getWinnerBadge(result.winner)}</TableCell>
                  <TableCell>{format(new Date(result.played_at), "PPp")}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteClick(result.id)}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the game result from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
