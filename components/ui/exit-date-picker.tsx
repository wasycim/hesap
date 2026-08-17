"use client"

import { CalendarDays, ChevronDown, X, UserMinus } from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { getLocalDateString } from "@/lib/date-navigation"

function parseLocalDate(value?: string | null) {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined
  return date
}

function displayDate(value?: string | null) {
  const date = parseLocalDate(value)
  return date ? format(date, "d MMMM yyyy", { locale: tr }) : "Tarih Seçilmedi"
}

type ExitDatePickerProps = {
  value?: string | null
  onChange: (value: string) => void
  disabled?: boolean
  align?: "start" | "center" | "end"
  className?: string
  compact?: boolean
}

export function ExitDatePicker({
  value,
  onChange,
  disabled,
  align = "end",
  className,
  compact = false,
}: ExitDatePickerProps) {
  const selectedDate = parseLocalDate(value)

  const handleSetToday = () => {
    onChange(getLocalDateString())
  }

  const handleSetEndOfMonth = () => {
    const now = new Date()
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    onChange(getLocalDateString(lastDay))
  }

  const handleClear = () => {
    onChange("")
  }

  if (compact) {
    return (
      <div className={cn("relative flex items-center gap-1", className)}>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn(
                "h-9 w-full justify-between gap-1.5 rounded-lg border px-2.5 text-xs transition-all",
                value
                  ? "border-rose-300 bg-rose-50/60 font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                  : "border-input bg-background font-normal text-muted-foreground hover:bg-accent"
              )}
            >
              <span className="flex items-center gap-1.5 truncate">
                <UserMinus className={cn("h-3.5 w-3.5 shrink-0", value ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")} />
                <span className="truncate">{displayDate(value)}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align={align} className="w-auto overflow-hidden rounded-2xl border bg-card p-0 shadow-2xl">
            <div className="bg-gradient-to-r from-rose-600 to-red-600 px-4 py-3 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-rose-100">İşten Çıkış Tarihi</div>
                  <div className="mt-0.5 text-sm font-bold">{displayDate(value)}</div>
                </div>
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
                  <UserMinus className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-black/20 p-1 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={handleSetToday}
                  className="rounded-md px-2 py-1 text-white/90 transition-colors hover:bg-white/15"
                >
                  Bugün
                </button>
                <button
                  type="button"
                  onClick={handleSetEndOfMonth}
                  className="rounded-md px-2 py-1 text-white/90 transition-colors hover:bg-white/15"
                >
                  Ay Sonu
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-md px-2 py-1 text-rose-200 transition-colors hover:bg-white/15 hover:text-white"
                >
                  Temizle
                </button>
              </div>
            </div>
            <div className="p-2">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) onChange(getLocalDateString(date))
                }}
                weekStartsOn={1}
                locale={tr}
                className="rounded-xl p-2"
              />
            </div>
            {value && (
              <div className="border-t bg-muted/40 p-2 text-center">
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400"
                >
                  <X className="h-3.5 w-3.5" /> Çıkış Tarihini İptal Et / Temizle
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between gap-2 rounded-xl border px-3 text-left shadow-sm transition-all",
            value
              ? "border-rose-300 bg-rose-50/50 font-semibold text-rose-700 hover:bg-rose-100/70 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
              : "border-input bg-background font-normal text-muted-foreground hover:bg-accent",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs",
                value ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300" : "bg-muted text-muted-foreground"
              )}
            >
              <UserMinus className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-xs font-medium">{displayDate(value)}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto overflow-hidden rounded-2xl border bg-card p-0 shadow-2xl">
        <div className="bg-gradient-to-r from-rose-600 to-red-600 px-4 py-3 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-rose-100">İşten Çıkış Tarihi Seçin</div>
              <div className="mt-0.5 text-sm font-bold">{displayDate(value)}</div>
            </div>
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
              <CalendarDays className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-black/20 p-1 text-[11px] font-medium">
            <button
              type="button"
              onClick={handleSetToday}
              className="rounded-md px-2 py-1 text-white/90 transition-colors hover:bg-white/15"
            >
              Bugün
            </button>
            <button
              type="button"
              onClick={handleSetEndOfMonth}
              className="rounded-md px-2 py-1 text-white/90 transition-colors hover:bg-white/15"
            >
              Ay Sonu
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md px-2 py-1 text-rose-200 transition-colors hover:bg-white/15 hover:text-white"
            >
              Temizle
            </button>
          </div>
        </div>
        <div className="p-2">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (date) onChange(getLocalDateString(date))
            }}
            weekStartsOn={1}
            locale={tr}
            className="rounded-xl p-2"
          />
        </div>
        {value && (
          <div className="border-t bg-muted/40 p-2 text-center">
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400"
            >
              <X className="h-3.5 w-3.5" /> Çıkış Tarihini Temizle (Devam Ediyor)
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
