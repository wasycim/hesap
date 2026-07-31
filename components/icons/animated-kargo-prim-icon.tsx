"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface AnimatedKargoPrimIconProps {
  className?: string
  size?: number
}

export function AnimatedKargoPrimIcon({ className, size = 20 }: AnimatedKargoPrimIconProps) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center transition-all duration-300 hover:scale-115 group/coins",
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="overflow-visible text-emerald-500 transition-colors duration-300 group-hover/coins:text-emerald-400"
      >
        <defs>
          {/* Subtle Glow Filter */}
          <radialGradient id="coinsGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Pulsing Aura */}
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="url(#coinsGlow)"
          className="animate-pulse opacity-70"
        />

        {/* Main Coin (Animated Float) */}
        <g className="animate-bounce" style={{ animationDuration: "2.5s" }}>
          <circle cx="8" cy="8" r="6" stroke="#10B981" fill="rgba(16, 185, 129, 0.1)" />
          <path d="M7 6h1v4" stroke="#10B981" />
        </g>

        {/* Second Coin (Subtle Pulse / Shift) */}
        <g className="animate-pulse" style={{ animationDuration: "2s" }}>
          <path d="M18.09 10.37A6 6 0 1 1 10.34 18" stroke="#059669" />
          <path d="m16.71 13.88.7.71-2.82 2.82" stroke="#059669" />
        </g>

        {/* Sparkle Star overlay */}
        <path
          d="M19 3L19.5 4.5L21 5L19.5 5.5L19 7L18.5 5.5L17 5L18.5 4.5L19 3Z"
          fill="#F59E0B"
          stroke="none"
          className="animate-spin"
          style={{ transformOrigin: "19px 5px", animationDuration: "4s" }}
        />
      </svg>
    </div>
  )
}
