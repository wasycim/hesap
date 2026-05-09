"use client"

import { useState } from "react"
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
  getInitialEndYear,
  getInitialMonth,
  getInitialYear,
  makeYears,
} from "@/lib/date-navigation"

export default function GiderPage() {
  const [month, setMonth] = useState(getInitialMonth())
  const [year, setYear] = useState(getInitialYear())
  const [endYear, setEndYear] = useState(getInitialEndYear())
  const years = makeYears(endYear)

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
      if (year >= endYear) {
        setEndYear(endYear + 5)
      }
      if (year < endYear + 5) {
        setMonth(MONTHS[0])
        setYear(year + 1)
      }
    } else {
      setMonth(MONTHS[currentIndex + 1])
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 bg-red-600 text-white">
        <div className="flex items-center gap-3">
          <TrendingDown className="h-6 w-6" />
          <h1 className="text-xl font-bold">Gider Tablosu</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={prevMonth}
            className="text-white hover:bg-red-700"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-32 bg-red-700 border-red-500 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.filter((_, index) => year !== START_YEAR || index >= START_MONTH_INDEX).map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-24 bg-red-700 border-red-500 text-white">
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

      <div className="flex-1 overflow-auto p-4">
        <GiderSpreadsheet month={month} year={year} />
      </div>
    </div>
  )
}
