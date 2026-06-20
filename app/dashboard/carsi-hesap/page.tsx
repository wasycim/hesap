"use client"

import { Landmark } from "lucide-react"
import { OnDortNoHesapTable } from "@/components/dashboard/on-dort-no-hesap-table"

export default function CarsiHesapPage() {
  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-indigo-500/15 text-indigo-500">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Çarşı Hesap Tablosu</h1>
            <p className="text-sm text-muted-foreground">
              Çarşı şubesi Gelir Kalemleri, Gider Kalemleri ve Kalan hesapları tek ekranda.
            </p>
          </div>
        </div>
      </div>

      <OnDortNoHesapTable embedded forcedSubeId="9a650980-23f4-4fe8-8b35-092bea7ab7fd" />
    </div>
  )
}
