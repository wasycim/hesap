"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  CalendarDays,
  Camera,
  ChevronDown,
  Columns3,
  Eye,
  Landmark,
  LayoutDashboard,
  Package,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Soup,
  TrendingDown,
  TrendingUp,
  UserCog,
  Wallet,
  WalletCards,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { useSube } from "@/contexts/sube-context"

const NAV_ITEMS = [
  { title: "Genel Bakış", href: "/dashboard", adminOnly: false, icon: LayoutDashboard, color: "text-slate-500" },
  { title: "Gelir Tablosu", href: "/dashboard/gelir", adminOnly: false, icon: TrendingUp, color: "text-emerald-500" },
  { title: "Gider Tablosu", href: "/dashboard/gider", adminOnly: false, icon: TrendingDown, color: "text-red-500" },
  { title: "Çorbalar", href: "/dashboard/corbalar", adminOnly: false, icon: Soup, color: "text-orange-500" },
  { title: "Maaşlar", href: "/dashboard/maaslar", adminOnly: true, icon: WalletCards, color: "text-emerald-500" },
  { title: "Mesai", href: "/dashboard/mesai", adminOnly: false, icon: Camera, color: "text-amber-500" },
  { title: "Vardiya", href: "/dashboard/vardiya", adminOnly: true, icon: CalendarDays, color: "text-violet-500" },
  { title: "Mesai Takip", href: "/dashboard/mesai-takip", adminOnly: true, icon: CalendarDays, color: "text-amber-500" },
  { title: "Şube Ciro Raporları", href: "/dashboard/sube-ciro-raporlari", adminOnly: true, icon: BarChart3, color: "text-emerald-500" },
  { title: "Sütun Ayarları", href: "/dashboard/sutun-ayarlar", adminOnly: true, icon: Columns3, color: "text-sky-500" },
  { title: "Görünüm Ayarları", href: "/dashboard/gorunum-ayarlar", adminOnly: true, icon: Eye, color: "text-indigo-500" },
  { title: "Genel Ayarlar", href: "/dashboard/ayarlar", adminOnly: true, icon: Settings, color: "text-gray-500" },
  { title: "Güvenlik Ayarları", href: "/dashboard/guvenlik-ayarlar", adminOnly: true, icon: Shield, color: "text-emerald-500" },
  { title: "Admin Ayarları", href: "/dashboard/admin-ayarlar", adminOnly: true, icon: ShieldCheck, color: "text-amber-500" },
  { title: "Hesap Ayarları", href: "/dashboard/hesap", adminOnly: false, icon: UserCog, color: "text-purple-500" },
]

const ON_DORT_NO_ITEMS = [
  { title: "Gelir Kalemleri", href: "/dashboard/14-no-hesap/gelir-kalemleri" },
  { title: "14 No Kalemleri", href: "/dashboard/14-no-hesap/14-no-kalemleri" },
  { title: "Banka ve Kalan", href: "/dashboard/14-no-hesap/banka-ve-kalan" },
]

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function QuickCommand() {
  const { isAdmin, currentSube } = useSube()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [kargoOpen, setKargoOpen] = useState(false)
  const [onDortNoOpen, setOnDortNoOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [kargoFirmalar, setKargoFirmalar] = useState<Array<{ id: string; ad: string }>>([])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("tr-TR") === "k") {
        event.preventDefault()
        setOpen(prev => !prev)
      }
      if (event.key === "Escape") setOpen(false)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    async function loadKargoFirmalar() {
      if (!currentSube) {
        setKargoFirmalar([])
        return
      }

      const { data } = await supabase
        .from("kargo_cari_firmalar")
        .select("id, ad")
        .eq("sube_id", currentSube.id)
        .eq("aktif", true)
        .order("sira", { ascending: true })

      setKargoFirmalar(data || [])
    }

    loadKargoFirmalar()
  }, [currentSube?.id])

  const results = useMemo(() => {
    const cleanQuery = normalize(query.trim())
    return NAV_ITEMS
      .filter(item => isAdmin || !item.adminOnly)
      .filter(item => !cleanQuery || normalize(item.title).includes(cleanQuery))
      .slice(0, 10)
  }, [isAdmin, query])

  const cleanQuery = normalize(query.trim())
  const showKargoGroup = !cleanQuery || normalize("Kargo Cari").includes(cleanQuery) || kargoFirmalar.some(firma => normalize(firma.ad).includes(cleanQuery))
  const shouldOpenKargo = kargoOpen || Boolean(cleanQuery)
  const visibleKargoFirmalar = kargoFirmalar.filter(firma => !cleanQuery || normalize("Kargo Cari").includes(cleanQuery) || normalize(firma.ad).includes(cleanQuery))
  const visibleOnDortNoItems = ON_DORT_NO_ITEMS.filter(item => (
    !cleanQuery ||
    normalize("14 No Hesap").includes(cleanQuery) ||
    normalize(item.title).includes(cleanQuery) ||
    normalize(`14 No Hesap ${item.title}`).includes(cleanQuery)
  ))
  const showOnDortNoGroup = isAdmin && visibleOnDortNoItems.length > 0
  const shouldOpenOnDortNo = onDortNoOpen || Boolean(cleanQuery)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-20 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Sayfa ara..."
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {results.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <span>{item.title}</span>
            </Link>
          ))}
          {showKargoGroup && (
            <div>
              <button
                type="button"
                onClick={() => setKargoOpen(prev => !prev)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <span className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-cyan-500" />
                  Kargo Cari
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${shouldOpenKargo ? "rotate-0" : "-rotate-90"}`} />
              </button>
              {shouldOpenKargo && (
                <div className="ml-6 mt-1 space-y-1 border-l pl-3">
                  {isAdmin && (
                    <Link
                      href="/dashboard/kargo-cari"
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      <Wallet className="mr-2 inline h-4 w-4 text-red-500" />
                      Borç Özeti
                    </Link>
                  )}
                  {visibleKargoFirmalar.map(firma => (
                    <Link
                      key={firma.id}
                      href={`/dashboard/kargo-cari/${firma.id}`}
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      <Package className="mr-2 inline h-4 w-4 text-cyan-500" />
                      {firma.ad}
                    </Link>
                  ))}
                  {visibleKargoFirmalar.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Firma yok.</div>
                  )}
                </div>
              )}
            </div>
          )}
          {showOnDortNoGroup && (
            <div>
              <button
                type="button"
                onClick={() => setOnDortNoOpen(prev => !prev)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <span className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-lime-500" />
                  14 No Hesap
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${shouldOpenOnDortNo ? "rotate-0" : "-rotate-90"}`} />
              </button>
              {shouldOpenOnDortNo && (
                <div className="ml-6 mt-1 space-y-1 border-l pl-3">
                  {visibleOnDortNoItems.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      <Landmark className="mr-2 inline h-4 w-4 text-lime-500" />
                      {item.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          {results.length === 0 && !showKargoGroup && !showOnDortNoGroup && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">Sonuç bulunamadı.</div>
          )}
        </div>
      </div>
    </div>
  )
}
