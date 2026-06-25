import { useEffect, useRef, useState, type ComponentProps } from "react"
import { cn } from "@/lib/utils"

type CurrencyInputProps = Omit<ComponentProps<"input">, "className"> & {
  containerClassName?: string
  inputClassName?: string
  showCurrencySymbol?: boolean
}

export function CurrencyInput({
  containerClassName,
  inputClassName,
  style,
  value,
  placeholder = "0",
  showCurrencySymbol = true,
  onBlur,
  onChange,
  onFocus,
  ...props
}: CurrencyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [editingValue, setEditingValue] = useState<string | null>(null)
  const displayValue = editingValue ?? formatCurrencyInputValue(value)
  const characterCount = Math.min(Math.max(displayValue.length, 1), 18)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setEditingValue(null)
    }
  }, [value])

  return (
    <span
      className={cn("flex min-h-8 w-full min-w-24 cursor-text items-center justify-center", containerClassName)}
      onMouseDown={(event) => {
        if (event.target === inputRef.current) return
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }}
    >
      <span className="spreadsheet-active-cell">
        <input
          {...props}
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={displayValue}
          placeholder={placeholder}
          style={{ ...style, width: `${characterCount}ch` }}
          onChange={(event) => {
            setEditingValue(event.target.value)
            onChange?.(event)
          }}
          onFocus={(event) => {
            setEditingValue(formatCurrencyInputValue(value))
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setEditingValue(null)
            onBlur?.(event)
          }}
          className={cn(
            "min-w-[1ch] bg-transparent p-0 text-right tabular-nums text-foreground outline-none",
            inputClassName,
          )}
        />
        {showCurrencySymbol ? (
          <span className="pointer-events-none shrink-0 text-muted-foreground">{"\u20ba"}</span>
        ) : null}
      </span>
    </span>
  )
}

export function parseCurrencyInputValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0

  const raw = String(value ?? "").trim()
  if (!raw) return 0

  const sign = raw.startsWith("-") ? -1 : 1
  const cleaned = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/-/g, "")
    .replace(/\./g, "")
    .replace(",", ".")

  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed * sign : 0
}

function formatCurrencyInputValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return ""

  const parsed = parseCurrencyInputValue(value)
  if (!Number.isFinite(parsed)) return ""

  const hasFraction = Math.abs(parsed % 1) > 0
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(parsed)
}
