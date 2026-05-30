"use client"

import { useEffect, useState } from "react"
import { RefreshCw, WifiOff } from "lucide-react"
import { flushOfflineMutations, getOfflineQueueCount } from "@/lib/offline-sync"

export function ConnectivityOverlay() {
  const [online, setOnline] = useState(true)
  const [queueCount, setQueueCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    const updateQueue = () => setQueueCount(getOfflineQueueCount())

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
        {syncing ? "Bekleyen işlemler senkronize ediliyor..." : `${queueCount} işlem bekliyor`}
      </div>
    ) : null
  }

  return (
    <div className="fixed inset-0 z-[10001] grid place-items-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/10">
          <WifiOff className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-normal">İnternet bağlantısı yok</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Bağlantı geri geldiğinde bekleyen güvenlik kayıtları otomatik senkronize edilir. Kontrol ettikten sonra sayfayı yeniden yükleyebilirsiniz.
        </p>
        {queueCount > 0 ? <p className="mt-3 text-xs font-semibold text-amber-300">{queueCount} işlem bekliyor.</p> : null}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-950/40"
        >
          <RefreshCw className="h-4 w-4" />
          Yeniden yükle
        </button>
      </div>
    </div>
  )
}
