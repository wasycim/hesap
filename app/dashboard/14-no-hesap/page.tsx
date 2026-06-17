"use client"

import { Landmark } from "lucide-react"
import { OnDortNoHesapTable } from "@/components/dashboard/on-dort-no-hesap-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

      <Tabs defaultValue="gelir" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-xl border bg-card p-1 sm:grid-cols-3">
          <TabsTrigger value="gelir" className="h-10">Gelir Kalemleri</TabsTrigger>
          <TabsTrigger value="on_dort" className="h-10">14 No Kalemleri</TabsTrigger>
          <TabsTrigger value="banka" className="h-10">Banka ve Kalan</TabsTrigger>
        </TabsList>

        <TabsContent value="gelir" className="mt-0">
          <OnDortNoHesapTable section="gelir" embedded />
        </TabsContent>
        <TabsContent value="on_dort" className="mt-0">
          <OnDortNoHesapTable section="on_dort" embedded />
        </TabsContent>
        <TabsContent value="banka" className="mt-0">
          <OnDortNoHesapTable section="banka" embedded />
        </TabsContent>
      </Tabs>
    </div>
  )
}
