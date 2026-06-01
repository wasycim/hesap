"use client"

import { useEffect, useState } from "react"
import { RefreshCw, WifiOff } from "lucide-react"
import { flushOfflineMutations, getOfflineQueueCount, installOfflineMutationQueue } from "@/lib/offline-sync"

export function ConnectivityOverlay() {
  const [online, setOnline] = useState(true)
  const [queueCount, setQueueCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    const updateQueue = () => setQueueCount(getOfflineQueueCount())

    installOfflineMutationQueue()
    updateOnline()
    updateQueue()
    window.addEventListener("online", updateOnline)
    window.addEventListener("offline", updateOnline)
    window.addEventListener("hesap-offline-queue-change", updateQueue)

    return () => {
      window.removeEventListener("online", updateOnline)
      window.removeEventListener("offline", updateOnline)
      window.removeEventListener("hesap-offline-queue-change", updateQueue)
    }
  }, [])

  useEffect(() => {
    if (!online || queueCount === 0) return
    setSyncing(true)
    flushOfflineMutations()
      .then((result) => setQueueCount(result.remaining))
      .finally(() => setSyncing(false))
  }, [online, queueCount])

  if (online) {
    return queueCount > 0 || syncing ? (
      <div className="fixed bottom-4 right-4 z-[9997] rounded-full border bg-background px-4 py-2 text-xs font-semibold shadow-lg">
        {syncing ? "Bekleyen islemler senkronize ediliyor..." : `${queueCount} islem bekliyor`}
      </div>
    ) : null
  }

  return (
    <div className="fixed inset-x-3 bottom-4 z-[10001] mx-auto max-w-xl rounded-2xl border border-amber-400/40 bg-slate-950/95 p-3 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300">
          <WifiOff className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Internet baglantisi yok</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-300">
            Kaydedilen islemler kuyruga alinir ve baglanti gelince otomatik senkronize edilir.
          </p>
          {queueCount > 0 ? <p className="mt-1 text-xs font-semibold text-amber-300">{queueCount} islem bekliyor.</p> : null}
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 text-xs font-bold text-white shadow-lg shadow-emerald-950/40"
        >
          <RefreshCw className="h-4 w-4" />
          Yenile
        </button>
      </div>
    </div>
  )
}
