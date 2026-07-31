"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface AnimatedKargoPrimIconProps {
  className?: string
  size?: number
}

export function AnimatedKargoPrimIcon({ className, size = 24 }: AnimatedKargoPrimIconProps) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center transition-transform duration-300 hover:scale-110",
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          {/* Main Metallic Emerald Gradient */}
          <linearGradient id="kargoPrimGrad" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#10B981" />
            <stop offset="0.5" stopColor="#059669" />
            <stop offset="1" stopColor="#047857" />
          </linearGradient>

          {/* Golden Coin Gradient */}
          <linearGradient id="coinGrad" x1="16" y1="4" x2="28" y2="16" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F59E0B" />
            <stop offset="1" stopColor="#D97706" />
          </linearGradient>

          {/* Sparkle Glow */}
          <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34D399" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer Pulsing Aura */}
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="url(#glowGrad)"
          className="animate-pulse opacity-75"
        />

        {/* Delivery Box Base */}
        <path
          d="M5 11.5L16 6L27 11.5L16 17L5 11.5Z"
          fill="url(#kargoPrimGrad)"
          stroke="#047857"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M5 11.5V20.5L16 26V17L5 11.5Z"
          fill="#059669"
          stroke="#047857"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M27 11.5V20.5L16 26V17L27 11.5Z"
          fill="#10B981"
          stroke="#047857"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Speed / Motion lines */}
        <path
          d="M2 14H4M1 18H3"
          stroke="#34D399"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="animate-pulse"
        />

        {/* Floating Coin (Animated floating up and down) */}
        <g className="animate-bounce" style={{ animationDuration: "2.2s" }}>
          <circle
            cx="21"
            cy="9"
            r="4.5"
            fill="url(#coinGrad)"
            stroke="#FFF"
            strokeWidth="1"
          />
          <text
            x="21"
            y="10.8"
            fontSize="5"
            fontWeight="bold"
            fill="#FFF"
            textAnchor="middle"
          >
            ₺
          </text>
        </g>

        {/* Sparkle Star */}
        <path
          d="M9 7L10 9.5L12.5 10.5L10 11.5L9 14L8 11.5L5.5 10.5L8 9.5L9 7Z"
          fill="#FBBF24"
          className="animate-spin"
          style={{ animationDuration: "6s", transformOrigin: "9px 10.5px" }}
        />
      </svg>
    </div>
  )
}
