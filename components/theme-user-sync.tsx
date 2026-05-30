"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"

export function ThemeUserSync() {
  const { setTheme } = useTheme()

  useEffect(() => {
    let active = true
    fetch("/api/user/theme", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return
        if (data?.theme === "light" || data?.theme === "dark" || data?.theme === "system") {
          setTheme(data.theme)
        }
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [setTheme])

  return null
}
