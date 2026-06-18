"use client"

import { Landmark } from "lucide-react"
import { OnDortNoHesapTable } from "@/components/dashboard/on-dort-no-hesap-table"

export default function AltSubeHesaplariPage() {
  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-lime-500/15 text-lime-500">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Alt Şube Hesapları</h1>
            <p className="text-sm text-muted-foreground">
              Gelir kalemleri, 14 no kalemleri, banka ve kalan hesapları tek ekranda.
            </p>
          </div>
        </div>
      </div>

      <OnDortNoHesapTable embedded />
    </div>
  )
}
