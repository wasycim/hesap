"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Landmark, TrendingDown, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { GelirSpreadsheet } from "@/components/dashboard/gelir-spreadsheet"
import { GiderSpreadsheet } from "@/components/dashboard/gider-spreadsheet"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import {
  MONTHS,
  START_MONTH_INDEX,
  START_YEAR,
  getInitialMonth,
  getInitialYear,
  makeYearWindow,
} from "@/lib/date-navigation"
import { isDaricaSube } from "@/lib/sube-utils"

export default function DaricaHesapPage() {
  const [month, setMonth] = useState(getInitialMonth())
  const [year, setYear] = useState(getInitialYear())
  const [activeTab, setActiveTab] = useState("gelir")
  const { currentSube, loading } = useSube()
  const { isDirty } = useUnsavedChanges()
  const router = useRouter()
  const years = makeYearWindow(year)
  const isDarica = isDaricaSube(currentSube)

  useEffect(() => {
    if (!loading && currentSube && !isDarica) router.replace("/dashboard")
  }, [currentSube, isDarica, loading, router])

  function canChangeView() {
    if (!isDirty) return true
    toast.warning("Önce açık tablodaki değişiklikleri kaydedin.")
    return false
  }

  function prevMonth() {
    if (!canChangeView()) return
    const currentIndex = MONTHS.indexOf(month)
    if (currentIndex === 0) {
      if (year > START_YEAR) {
        setMonth(MONTHS[11])
        setYear(current => current - 1)
      }
      return
    }
    if (year === START_YEAR && currentIndex <= START_MONTH_INDEX) return
    setMonth(MONTHS[currentIndex - 1])
  }

  function nextMonth() {
    if (!canChangeView()) return
    const currentIndex = MONTHS.indexOf(month)
    if (currentIndex === 11) {
      setMonth(MONTHS[0])
      setYear(current => current + 1)
      return
    }
    setMonth(MONTHS[currentIndex + 1])
  }

  if (loading || !currentSube || !isDarica) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b bg-card px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Darıca Hesap</h1>
              <p className="text-sm text-muted-foreground">Gelir ve gider kayıtları tek sayfada.</p>
            </div>
          </div>

          <div className="grid grid-cols-[auto_1fr_0.8fr_auto] items-center gap-2 sm:flex">
            <Button variant="outline" size="icon" onClick={prevMonth} aria-label="Önceki ay">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={month} onValueChange={value => {
              if (canChangeView()) setMonth(value)
            }}>
              <SelectTrigger className="w-full min-w-0 sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.filter((_, index) => year !== START_YEAR || index >= START_MONTH_INDEX).map(item => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year.toString()} onValueChange={value => {
              if (canChangeView()) setYear(Number(value))
            }}>
              <SelectTrigger className="w-full min-w-0 sm:w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(item => (
                  <SelectItem key={item} value={item.toString()}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={nextMonth} aria-label="Sonraki ay">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={value => {
          if (canChangeView()) setActiveTab(value)
        }}
        className="flex-1 gap-0"
      >
        <div className="border-b bg-muted/30 px-4 py-3 sm:px-6 lg:px-8">
          <TabsList className="grid h-10 w-full max-w-md grid-cols-2">
            <TabsTrigger value="gelir" className="gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Gelir Tablosu
            </TabsTrigger>
            <TabsTrigger value="gider" className="gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Gider Tablosu
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="gelir" className="m-0 p-3 sm:p-4">
          <GelirSpreadsheet month={month} year={year} />
        </TabsContent>
        <TabsContent value="gider" className="m-0 p-3 sm:p-4">
          <GiderSpreadsheet month={month} year={year} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
