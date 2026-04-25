"use client"

import { useState } from "react"
import { GelirSpreadsheet } from "@/components/dashboard/gelir-spreadsheet"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react"

const months = [
  "Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran",
  "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"
]

const years = [2026, 2027, 2028, 2029, 2030]

export default function GelirPage() {
  const [month, setMonth] = useState("Nisan")
  const [year, setYear] = useState(2026)

  const prevMonth = () => {
    const currentIndex = months.indexOf(month)
    if (currentIndex === 0) {
      if (year > 2026) {
        setMonth(months[11])
        setYear(year - 1)
      }
    } else {
      if (year === 2026 && currentIndex <= 3) return
      setMonth(months[currentIndex - 1])
    }
  }

  const nextMonth = () => {
    const currentIndex = months.indexOf(month)
    if (currentIndex === 11) {
      if (year < 2030) {
        setMonth(months[0])
        setYear(year + 1)
      }
    } else {
      setMonth(months[currentIndex + 1])
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 bg-emerald-600 text-white">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6" />
          <h1 className="text-xl font-bold">Gelir Tablosu</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={prevMonth}
            className="text-white hover:bg-emerald-700"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-32 bg-emerald-700 border-emerald-500 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-24 bg-emerald-700 border-emerald-500 text-white">
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
            className="text-white hover:bg-emerald-700"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <GelirSpreadsheet month={month} year={year} />
      </div>
    </div>
  )
}
