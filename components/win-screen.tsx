"use client"

import { Settings } from "lucide-react"

interface WinScreenProps {
  board: (string | null)[]
  winner: "X" | "O" | null
  onReset: () => void
}

export default function WinScreen({ board, winner, onReset }: WinScreenProps) {
  return (
    <div className="flex h-[600px] flex-col bg-white px-6 py-4">
      {/* Top bar with curved purple background */}
      <div
        className="absolute left-0 right-0 top-0 h-32 bg-indigo-700 rounded-b-[50%] w-full"
        style={{ borderBottomLeftRadius: "100%", borderBottomRightRadius: "100%" }}
      ></div>

      {/* Settings and reset buttons */}
      <div className="relative z-10 flex w-full justify-between">
        <button className="rounded-full p-2 text-white">
          <Settings className="h-5 w-5" />
        </button>
        <button
          onClick={onReset}
          className="rounded-full bg-white px-4 py-1 text-sm font-medium text-indigo-700 shadow-sm"
        >
          Reset
        </button>
      </div>

      {/* Win title */}
      <div className="relative z-10 mt-4 text-center">
        <h2 className="text-xl font-bold text-indigo-700">Your Win</h2>
      </div>

      {/* Game board */}
      <div className="mt-8 flex flex-1 items-center justify-center">
        <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
          {board.map((cell, index) => (
            <div
              key={index}
              className="aspect-square rounded-lg bg-indigo-100/50 flex items-center justify-center text-4xl font-bold"
            >
              {cell === "X" && <span className="text-indigo-700">✕</span>}
              {cell === "O" && <span className="text-indigo-700">○</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Player indicators */}
      <div className="mb-4 mt-auto flex justify-between">
        <div className="flex items-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-700 text-white">
            <span className="text-sm font-medium">1</span>
          </div>
          <span className="ml-2 text-sm font-medium text-indigo-700">AI</span>
        </div>
        <div className="flex items-center">
          <span className="mr-2 text-sm font-medium text-indigo-700">You</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-700 text-white">
            <span className="text-sm font-medium">2</span>
          </div>
        </div>
      </div>

      {/* Win indicator */}
      <div className="absolute bottom-4 right-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-700 text-white">
          <span className="text-sm font-medium">You Won</span>
        </div>
      </div>
    </div>
  )
}
