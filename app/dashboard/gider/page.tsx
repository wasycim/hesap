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

const months = [
  "Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran",
  "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"
]

const START_YEAR = 2026
const currentDate = new Date()
const currentMonth = months[currentDate.getMonth()]
const currentYear = currentDate.getFullYear()
const years = Array.from({ length: Math.max(currentYear + 4, 2030) - START_YEAR + 1 }, (_, index) => START_YEAR + index)

export default function GiderPage() {
  const [month, setMonth] = useState(currentMonth)
  const [year, setYear] = useState(currentYear)

  const prevMonth = () => {
    const currentIndex = months.indexOf(month)
    if (currentIndex === 0) {
      if (year > START_YEAR) {
        setMonth(months[11])
        setYear(year - 1)
      }
    } else {
      if (year === START_YEAR && currentIndex <= 3) return
      setMonth(months[currentIndex - 1])
    }
  }

  const nextMonth = () => {
    const currentIndex = months.indexOf(month)
    if (currentIndex === 11) {
      if (year < years[years.length - 1]) {
        setMonth(months[0])
        setYear(year + 1)
      }
    } else {
      setMonth(months[currentIndex + 1])
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
              {months.map(m => (
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
