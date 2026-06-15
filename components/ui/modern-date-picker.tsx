"use client"

import { CalendarDays, ChevronDown, Clock3 } from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
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
  return date ? format(date, "d MMM yyyy", { locale: tr }) : "Tarih sec"
}

type ModernDatePickerProps = {
  label?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  align?: "start" | "center" | "end"
  className?: string
  buttonClassName?: string
}

export function ModernDatePicker({
  label = "Tarih",
  value,
  onChange,
  disabled,
  align = "start",
  className,
  buttonClassName,
}: ModernDatePickerProps) {
  const selectedDate = parseLocalDate(value)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("h-11 w-full justify-between gap-3 rounded-xl bg-background/85 px-3 text-left font-normal shadow-sm", buttonClassName)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
              <CalendarDays className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase leading-none text-muted-foreground">{label}</span>
              <span className="block truncate text-sm font-bold leading-5">{displayDate(value)}</span>
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className={cn("w-auto overflow-hidden rounded-2xl border bg-card p-0 shadow-2xl", className)}>
        <div className="bg-slate-950 px-4 py-3 text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold">Tarih sec</div>
              <div className="mt-0.5 text-xs text-white/65">{displayDate(value)}</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-white/8 p-1">
            <button
              type="button"
              onClick={() => onChange(getLocalDateString())}
              className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/12"
            >
              Bugun
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date()
                onChange(getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)))
              }}
              className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/12"
            >
              Ay basi
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
            className="rounded-xl p-2 [--cell-size:--spacing(9)]"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

type ModernDateTimePickerProps = Omit<ModernDatePickerProps, "value" | "onChange"> & {
  value: string
  onChange: (value: string) => void
}

export function ModernDateTimePicker({
  label = "Tarih ve saat",
  value,
  onChange,
  disabled,
  align = "start",
  className,
  buttonClassName,
}: ModernDateTimePickerProps) {
  const [datePart = "", timePart = ""] = value ? value.split("T") : ["", ""]
  const safeTime = timePart?.slice(0, 5) || "09:00"

  return (
    <div className={cn("grid gap-2", className)}>
      <ModernDatePicker
        label={label}
        value={datePart}
        onChange={(nextDate) => onChange(`${nextDate}T${safeTime}`)}
        disabled={disabled}
        align={align}
        buttonClassName={buttonClassName}
      />
      <label className="flex h-11 items-center gap-2 rounded-xl border bg-background/85 px-3 shadow-sm">
        <Clock3 className="h-4 w-4 text-muted-foreground" />
        <Input
          type="time"
          value={safeTime}
          disabled={disabled}
          onChange={(event) => onChange(`${datePart || getLocalDateString()}T${event.target.value}`)}
          className="h-8 border-0 bg-transparent p-0 font-semibold shadow-none focus-visible:ring-0"
        />
      </label>
    </div>
  )
}
