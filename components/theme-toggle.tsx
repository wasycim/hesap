"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === "dark"
  const nextTheme = isDark ? "light" : "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => {
        setTheme(nextTheme)
        fetch("/api/user/theme", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: nextTheme }),
        }).catch(() => undefined)
      }}
      title={isDark ? "Açık moda geç" : "Koyu moda geç"}
      aria-label={isDark ? "Açık moda geç" : "Koyu moda geç"}
      className={cn("theme-toggle-button text-muted-foreground hover:text-foreground", className)}
    >
      {isDark ? <Sun className="theme-icon-sun h-4 w-4" /> : <Moon className="theme-icon-moon h-4 w-4" />}
    </Button>
  )
}
