"use client"

import { CalendarDays, ChevronDown, X, UserMinus, UserCheck, Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { getLocalDateString } from "@/lib/date-navigation"
import { useState } from "react"

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
  type?: "entry" | "exit"
  title?: string
}

export function ExitDatePicker({
  value,
  onChange,
  disabled,
  align = "end",
  className,
  compact = false,
  type = "exit",
  title,
}: ExitDatePickerProps) {
  const isEntry = type === "entry"
  const defaultTitle = title || (isEntry ? "İşe Giriş Tarihi" : "İşten Çıkış Tarihi")
  const selectedDate = parseLocalDate(value)
  const [displayedMonth, setDisplayedMonth] = useState<Date>(selectedDate || new Date())

  const handleSetToday = () => {
    const today = getLocalDateString()
    onChange(today)
    setDisplayedMonth(new Date())
  }

  const handleSetEndOfMonth = () => {
    const now = new Date()
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const val = getLocalDateString(lastDay)
    onChange(val)
    setDisplayedMonth(lastDay)
  }

  const handleClear = () => {
    onChange("")
  }

  const handleDirectInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    const parsed = parseLocalDate(val)
    if (parsed) {
      setDisplayedMonth(parsed)
    }
  }

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const y = Number(e.target.value)
    if (!y) return
    const current = displayedMonth || new Date()
    const newDate = new Date(y, current.getMonth(), 1)
    setDisplayedMonth(newDate)
  }

  const yearsList = []
  const currentYear = new Date().getFullYear()
  for (let y = 1990; y <= currentYear + 5; y++) {
    yearsList.push(y)
  }

  const IconComp = isEntry ? UserCheck : UserMinus

  const activeColorClasses = isEntry
    ? "border-emerald-300 bg-emerald-50/70 font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
    : "border-rose-300 bg-rose-50/60 font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"

  const iconColorClasses = isEntry
    ? (value ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")
    : (value ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")

  const headerGradient = isEntry
    ? "bg-gradient-to-r from-emerald-600 to-green-600"
    : "bg-gradient-to-r from-rose-600 to-red-600"

  const headerSubText = isEntry ? "text-emerald-100" : "text-rose-100"

  return (
    <div className={cn("relative flex items-center gap-1", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              compact ? "h-9 text-xs px-2.5" : "h-10 text-xs px-3",
              "w-full justify-between gap-1.5 rounded-lg border text-left transition-all shadow-sm",
              value ? activeColorClasses : "border-input bg-background font-normal text-muted-foreground hover:bg-accent"
            )}
          >
            <span className="flex items-center gap-1.5 truncate">
              <IconComp className={cn("h-3.5 w-3.5 shrink-0", iconColorClasses)} />
              <span className="truncate">{displayDate(value)}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align={align} className="w-auto overflow-hidden rounded-2xl border bg-card p-0 shadow-2xl">
          <div className={cn("px-4 py-3 text-white", headerGradient)}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={cn("text-xs font-semibold uppercase tracking-wider", headerSubText)}>{defaultTitle}</div>
                <div className="mt-0.5 text-sm font-bold">{displayDate(value)}</div>
              </div>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
                <IconComp className="h-4 w-4 text-white" />
              </div>
            </div>

            {/* Manuel Tarih Girişi & Yıl Seçici */}
            <div className="mt-2.5 flex items-center gap-2">
              <input
                type="date"
                value={value || ""}
                onChange={handleDirectInputChange}
                className="h-8 flex-1 rounded-md bg-white/20 px-2 text-xs font-bold text-white placeholder-white/60 backdrop-blur-sm border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                title="Tarihi doğrudan yazın (Örn: 2012-05-15)"
              />
              <select
                value={displayedMonth.getFullYear()}
                onChange={handleYearChange}
                className="h-8 rounded-md bg-white/20 px-2 text-xs font-bold text-white backdrop-blur-sm border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                title="Yılı Hızlıca Seçin"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y} className="bg-slate-900 text-white font-medium">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-black/20 p-1 text-[11px] font-medium">
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
                className="rounded-md px-2 py-1 text-rose-100 transition-colors hover:bg-white/15 hover:text-white"
              >
                Temizle
              </button>
            </div>
          </div>

          <div className="p-2">
            <Calendar
              mode="single"
              selected={selectedDate}
              month={displayedMonth}
              onMonthChange={setDisplayedMonth}
              onSelect={(date) => {
                if (date) {
                  const val = getLocalDateString(date)
                  onChange(val)
                  setDisplayedMonth(date)
                }
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
                className={cn("inline-flex items-center gap-1 text-xs font-semibold hover:underline", isEntry ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}
              >
                <X className="h-3.5 w-3.5" /> {isEntry ? "İşe Giriş Tarihini Temizle" : "Çıkış Tarihini Temizle (Devam Ediyor)"}
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
