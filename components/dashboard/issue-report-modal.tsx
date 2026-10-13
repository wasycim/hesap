"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { AlertCircle, Bug, CheckCircle2, Loader2, Send, X } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"

interface IssueReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userEmail?: string
  displayName?: string
}

export function IssueReportModal({
  open,
  onOpenChange,
  userEmail,
  displayName,
}: IssueReportModalProps) {
  const pathname = usePathname()
  const { toast } = useToast()

  const [baslik, setBaslik] = React.useState("")
  const [detay, setDetay] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (open) {
      setErrorMessage(null)
    } else {
      setBaslik("")
      setDetay("")
      setErrorMessage(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedBaslik = baslik.trim()
    const trimmedDetay = detay.trim()

    if (!trimmedBaslik) {
      setErrorMessage("Lütfen sorunun konu başlığını yazınız.")
      return
    }

    if (trimmedBaslik.length < 3) {
      setErrorMessage("Konu başlığı en az 3 karakter olmalıdır.")
      return
    }

    if (!trimmedDetay) {
      setErrorMessage("Lütfen sorun detayını yazınız.")
      return
    }

    if (trimmedDetay.length < 5) {
      setErrorMessage("Sorun detayı en az 5 karakter olmalıdır.")
      return
    }

    setIsSubmitting(true)

    try {
      const pageUrl = typeof window !== "undefined" ? window.location.href : pathname
      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : ""

      const response = await fetch("/api/sorun-bildir", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baslik: trimmedBaslik,
          detay: trimmedDetay,
          pageUrl,
          userAgent,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Sorun bildirilirken bir hata oluştu.")
      }

      toast({
        title: "Sorun Bildirildi",
        description: "Bildiriminiz sistem geliştiricisine (developer) e-posta olarak anında iletildi.",
      })

      onOpenChange(false)
    } catch (err: any) {
      setErrorMessage(err.message || "Bir hata oluştu, lütfen tekrar deneyiniz.")
      toast({
        variant: "destructive",
        title: "Gönderilemedi",
        description: err.message || "Sorun bildirimi gönderilemedi.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border border-border shadow-2xl">
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-red-600/90 via-rose-600/90 to-amber-600/90 p-5 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm shadow-inner">
              <Bug className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white tracking-tight">
                Sorun Bildir
              </DialogTitle>
              <DialogDescription className="text-xs text-white/80">
                Geliştirici ekibine doğrudan hata ve sorun bildirin
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* BILGI ROZETI */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-medium text-foreground">
                Anında E-Posta Bildirimi
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Gönderdiğiniz sorun doğrudan developer hesabının bağlı olduğu e-posta adresine anında iletilir.
              </p>
            </div>
          </div>

          {/* BILDIREN KULLANICI DETAYI */}
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Bildiren: </span>
              <span>{displayName || userEmail || "Giriş Yapmış Kullanıcı"}</span>
              {userEmail && displayName && (
                <span className="text-[11px] opacity-75"> ({userEmail})</span>
              )}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground/80 truncate max-w-[150px]">
              {pathname}
            </div>
          </div>

          {/* HATA MESAJI VARSA */}
          {errorMessage && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* KONU BASLIGI */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Konu Başlığı <span className="text-red-500">*</span></span>
              <span className="text-[10px] text-muted-foreground font-normal">
                {baslik.length}/120
              </span>
            </label>
            <Input
              value={baslik}
              onChange={(e) => setBaslik(e.target.value.slice(0, 120))}
              placeholder="Örn: Vardiya kaydederken sayfa donuyor"
              className="text-sm h-10"
              autoFocus
              disabled={isSubmitting}
              required
            />
          </div>

          {/* SORUN DETAYI */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Sorun Detayı <span className="text-red-500">*</span></span>
              <span className="text-[10px] text-muted-foreground font-normal">
                Hata mesajı, ekran veya işlem detayları
              </span>
            </label>
            <Textarea
              value={detay}
              onChange={(e) => setDetay(e.target.value)}
              placeholder="Hangi işlemi yaparken bu hata ile karşılaştınız? Varsa ekrandaki hata mesajını veya adımları yazınız..."
              rows={5}
              className="text-sm resize-none"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* FOOTER BUTONLAR */}
          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              İptal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !baslik.trim() || !detay.trim()}
              className="gap-2 bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>İletiliyor...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Sorunu Geliştiriciye Gönder</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
