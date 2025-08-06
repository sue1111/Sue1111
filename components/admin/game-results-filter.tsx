"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { CalendarIcon, Search, X } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import type { FilterOptions } from "./game-results-dashboard"

interface GameResultsFilterProps {
  filters: FilterOptions
  onFilterChange: (filters: FilterOptions) => void
}

export function GameResultsFilter({ filters, onFilterChange }: GameResultsFilterProps) {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(filters.searchTerm)

  // Handle search term debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(localFilters.searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [localFilters.searchTerm])

  // Apply filters when they change
  useEffect(() => {
    onFilterChange({
      ...localFilters,
      searchTerm: debouncedSearchTerm,
    })
  }, [debouncedSearchTerm, localFilters])

  const handleWinnerChange = (value: string) => {
    setLocalFilters({
      ...localFilters,
      winner: value,
    })
  }

  const handleStartDateChange = (date: Date | undefined) => {
    setLocalFilters({
      ...localFilters,
      startDate: date ? format(date, "yyyy-MM-dd") : null,
    })
  }

  const handleEndDateChange = (date: Date | undefined) => {
    setLocalFilters({
      ...localFilters,
      endDate: date ? format(date, "yyyy-MM-dd") : null,
    })
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalFilters({
      ...localFilters,
      searchTerm: e.target.value,
    })
  }

  const handleResetFilters = () => {
    setLocalFilters({
      winner: "all",
      startDate: null,
      endDate: null,
      searchTerm: "",
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="w-full md:w-1/4">
          <Label htmlFor="winner-filter">Filter by Winner</Label>
          <Select value={localFilters.winner} onValueChange={handleWinnerChange}>
            <SelectTrigger id="winner-filter" className="mt-1">
              <SelectValue placeholder="Select winner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Results</SelectItem>
              <SelectItem value="X">X Wins</SelectItem>
              <SelectItem value="O">O Wins</SelectItem>
              <SelectItem value="draw">Draws</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-1/4">
          <Label>Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {localFilters.startDate ? format(new Date(localFilters.startDate), "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={localFilters.startDate ? new Date(localFilters.startDate) : undefined}
                onSelect={handleStartDateChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="w-full md:w-1/4">
          <Label>End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {localFilters.endDate ? format(new Date(localFilters.endDate), "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={localFilters.endDate ? new Date(localFilters.endDate) : undefined}
                onSelect={handleEndDateChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="w-full md:w-1/4">
          <Label htmlFor="search-filter">Search Players</Label>
          <div className="relative mt-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="search-filter"
              placeholder="Search player names..."
              className=""
              style={{ paddingLeft: '2.5rem' }}
              value={localFilters.searchTerm}
              onChange={handleSearchChange}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleResetFilters} className="flex items-center gap-1">
          <X className="h-4 w-4" />
          Reset Filters
        </Button>
      </div>
    </div>
  )
}
