"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { GiderSpreadsheet } from "@/components/dashboard/gider-spreadsheet"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronLeft, ChevronRight, TrendingDown } from "lucide-react"
import {
  MONTHS,
  START_MONTH_INDEX,
  START_YEAR,
  getInitialMonth,
  getInitialYear,
  makeYearWindow,
} from "@/lib/date-navigation"
import { useSube } from "@/contexts/sube-context"
import { getSubeHesapInfo } from "@/lib/sube-utils"

export default function GiderPage() {
  const [month, setMonth] = useState(getInitialMonth())
  const [year, setYear] = useState(getInitialYear())
  const years = makeYearWindow(year)
  const { currentSube } = useSube()
  const router = useRouter()
  const subeHesapInfo = getSubeHesapInfo(currentSube)

  useEffect(() => {
    if (subeHesapInfo) router.replace(subeHesapInfo.href)
  }, [router, subeHesapInfo])

  const prevMonth = () => {
    const currentIndex = MONTHS.indexOf(month)
    if (currentIndex === 0) {
      if (year > START_YEAR) {
        setMonth(MONTHS[11])
        setYear(year - 1)
      }
    } else {
      if (year === START_YEAR && currentIndex <= START_MONTH_INDEX) return
      setMonth(MONTHS[currentIndex - 1])
    }
  }

  const nextMonth = () => {
    const currentIndex = MONTHS.indexOf(month)
    if (currentIndex === 11) {
      setMonth(MONTHS[0])
      setYear(year + 1)
    } else {
      setMonth(MONTHS[currentIndex + 1])
    }
  }

  if (subeHesapInfo) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {subeHesapInfo.title} açılıyor...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 bg-red-600 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <TrendingDown className="h-6 w-6" />
          <h1 className="text-xl font-bold">Gider Tablosu</h1>
        </div>
        
        <div className="grid grid-cols-[auto_1fr_0.8fr_auto] items-center gap-2 sm:flex">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={prevMonth}
            className="text-white hover:bg-red-700"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-full min-w-0 bg-red-700 border-red-500 text-white sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.filter((_, index) => year !== START_YEAR || index >= START_MONTH_INDEX).map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-full min-w-0 bg-red-700 border-red-500 text-white sm:w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={nextMonth}
            className="text-white hover:bg-red-700"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-4">
        <GiderSpreadsheet month={month} year={year} />
      </div>
    </div>
  )
}
