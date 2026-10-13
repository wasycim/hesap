"use client"

import { parseGirisCikisGecmisi, GirisCikisDonemi } from "@/lib/personel-employment"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { History, CalendarDays, CheckCircle2, UserX } from "lucide-react"

interface EmploymentHistoryCardProps {
  personel: {
    ad: string
    aktif?: boolean
    ise_giris_tarihi?: string | null
    isten_cikis_tarihi?: string | null
    giris_cikis_gecmisi?: any
  }
}

function formatDate(val?: string | null) {
  if (!val) return "-"
  const clean = val.includes("T") ? val.split("T")[0] : val
  if (clean.includes("-")) {
    const parts = clean.split("-")
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`
  }
  return clean
}

function calculateDuration(startDateStr?: string | null, endDateStr?: string | null): string {
  if (!startDateStr) return "-"
  const start = new Date(startDateStr)
  if (isNaN(start.getTime())) return "-"
  const end = endDateStr ? new Date(endDateStr) : new Date()

  let years = end.getFullYear() - start.getFullYear()
  let months = end.getMonth() - start.getMonth()
  let days = end.getDate() - start.getDate()

  if (days < 0) {
    months -= 1
    const prevMonthEnd = new Date(end.getFullYear(), end.getMonth(), 0).getDate()
    days += prevMonthEnd
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  const parts = []
  if (years > 0) parts.push(`${years} yıl`)
  if (months > 0) parts.push(`${months} ay`)
  if (days > 0 || parts.length === 0) parts.push(`${days} gün`)

  return parts.join(" ")
}

export function EmploymentHistoryCard({ personel }: EmploymentHistoryCardProps) {
  const history = parseGirisCikisGecmisi(
    personel.giris_cikis_gecmisi,
    personel.ise_giris_tarihi,
    personel.isten_cikis_tarihi
  )

  if (history.length === 0) return null

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
            <History className="w-4 h-4 text-emerald-600" />
            İstihdam Geçmişi & Çalışma Dönemleri ({history.length} Dönem)
          </CardTitle>
          <CardDescription className="text-xs">
            Personelin tüm işe başlama ve işten ayrılma kayıtları
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-muted-foreground uppercase">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">İşe Giriş Tarihi</th>
                <th className="p-3">İşten Çıkış Tarihi</th>
                <th className="p-3">Çalışma Süresi</th>
                <th className="p-3">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map((period, idx) => {
                const isOngoing = !period.isten_cikis_tarihi
                const isRehiredPeriod = idx > 0
                return (
                  <tr key={idx} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-bold text-muted-foreground">{idx + 1}. Dönem</td>
                    <td className="p-3 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{formatDate(period.ise_giris_tarihi)}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      {period.isten_cikis_tarihi ? (
                        <div className="flex items-center gap-1.5 font-semibold text-rose-600 dark:text-rose-400">
                          <UserX className="w-3.5 h-3.5" />
                          <span>{formatDate(period.isten_cikis_tarihi)}</span>
                        </div>
                      ) : (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Devam Ediyor</span>
                      )}
                    </td>
                    <td className="p-3 font-medium text-muted-foreground">
                      {calculateDuration(period.ise_giris_tarihi, period.isten_cikis_tarihi)}
                    </td>
                    <td className="p-3">
                      {isOngoing ? (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 font-bold text-[10px] px-2 py-0.5">
                          {isRehiredPeriod ? `Yeniden İşe Başladı (${formatDate(period.ise_giris_tarihi)})` : "Aktif Çalışıyor"}
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 font-bold text-[10px] px-2 py-0.5">
                          İşten Ayrıldı ({formatDate(period.isten_cikis_tarihi)})
                        </Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
