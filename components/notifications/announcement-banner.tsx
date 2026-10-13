"use client"

import { useEffect, useState } from "react"
import { Megaphone } from "lucide-react"

export function AnnouncementBanner() {
  const [items, setItems] = useState<any[]>([])
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    fetch("/api/announcements", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setItems(data.announcements || []))
      .catch(() => undefined)
  }, [])

  if (closed || items.length === 0) return null
  const item = items[0]

  return (
    <div className="fixed left-4 right-4 top-[calc(4rem+env(safe-area-inset-top))] z-40 mx-auto max-w-3xl rounded-2xl border border-emerald-500/30 bg-background/95 p-3 shadow-xl backdrop-blur lg:left-[18rem]">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white">
          <Megaphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{item.title}</p>
          <p className="text-sm text-muted-foreground">{item.body}</p>
        </div>
        <button type="button" onClick={() => setClosed(true)} className="rounded-lg px-2 py-1 text-xs font-bold text-muted-foreground hover:bg-muted">
          Kapat
        </button>
      </div>
    </div>
  )
}
