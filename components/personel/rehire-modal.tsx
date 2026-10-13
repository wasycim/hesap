"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { createRehirePayload, parseGirisCikisGecmisi } from "@/lib/personel-employment"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RotateCcw, CalendarDays, CheckCircle2, History } from "lucide-react"

interface RehireModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  personel: {
    id: string
    ad: string
    ise_giris_tarihi?: string | null
    isten_cikis_tarihi?: string | null
    giris_cikis_gecmisi?: any
  } | null
  onSuccess: () => void
}

function getTodayString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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

export function RehireModal({ open, onOpenChange, personel, onSuccess }: RehireModalProps) {
  const [rehireDate, setRehireDate] = useState<string>(getTodayString())
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  if (!personel) return null

  const history = parseGirisCikisGecmisi(
    personel.giris_cikis_gecmisi,
    personel.ise_giris_tarihi,
    personel.isten_cikis_tarihi
  )

  async function handleConfirm() {
    if (!personel) return
    if (!rehireDate) {
      toast.error("Lütfen geçerli bir işe giriş tarihi seçin.")
      return
    }

    setLoading(true)
    try {
      const payload = createRehirePayload(personel, rehireDate)
      const { error } = await supabase
        .from("personeller")
        .update(payload)
        .eq("id", personel.id)

      if (error) {
        toast.error(`Yeniden aktif edilirken hata oluştu: ${error.message}`)
        return
      }

      toast.success(`${personel.ad} yeniden aktif edildi (${formatDate(rehireDate)} tarihinde işe başladı).`)
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(`İşlem sırasında hata: ${err?.message || "Bilinmeyen hata"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Yeniden Aktif Et</DialogTitle>
              <DialogDescription className="text-xs">
                <span className="font-bold text-foreground">{personel.ad}</span> adlı personeli yeniden işe başlatın
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Previous Employment Period Info */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
              <History className="w-3.5 h-3.5" />
              <span>Önceki Çalışma Kaydı</span>
            </div>
            <div className="text-muted-foreground">
              {personel.isten_cikis_tarihi ? (
                <>
                  Bu personel <span className="font-bold text-rose-600 dark:text-rose-400">{formatDate(personel.isten_cikis_tarihi)}</span> tarihinde işten ayrılmıştı.
                </>
              ) : (
                "Bu personel şu anda pasif durumda."
              )}
            </div>
            {history.length > 0 && (
              <div className="text-[11px] text-muted-foreground pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                Önceki Giriş: <span className="font-semibold text-foreground">{formatDate(history[history.length - 1]?.ise_giris_tarihi)}</span>
              </div>
            )}
          </div>

          {/* New Entry Date Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
              <CalendarDays className="w-4 h-4 text-emerald-600" />
              İşe Giriş Tarihi Seçin:
            </label>
            <Input
              type="date"
              value={rehireDate}
              onChange={(e) => setRehireDate(e.target.value)}
              className="h-10 text-sm font-bold bg-background"
            />
            <p className="text-[11px] text-muted-foreground">
              Personel bu tarihten itibaren aktif olacak, vardiya ve maaş planlamalarına dahil edilecektir.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs font-semibold"
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !rehireDate}
            className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="w-4 h-4" />
            {loading ? "Kaydediliyor..." : "Yeniden İşe Başlat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
