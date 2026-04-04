"use client"

import React from "react"

import type { Label } from "@/lib/types"
import { cn } from "@/lib/utils"

const paletteFallback = "#94a3b8"

export function LabelBadge({ label, onClick }: { label: Label; onClick?: (e: React.MouseEvent) => void }) {
  const style = { backgroundColor: label.color || paletteFallback }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-white transition-opacity",
        onClick ? "hover:opacity-90" : "cursor-default"
      )}
      style={style}
    >
      <span className="h-2 w-2 rounded-full bg-white/80" />
      <span className="truncate max-w-[120px]">{label.name}</span>
    </button>
  )
}
