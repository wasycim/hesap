"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  BarChart3,
  CalendarDays,
  Camera,
  ChevronDown,
  Columns3,
  Eye,
  FileSearch,
  Landmark,
  LayoutDashboard,
  Mail,
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
import { useSube } from "@/contexts/sube-context"
import { createClient } from "@/lib/supabase/client"
import {
  readCachedDashboardPermissions,
  readCachedMenuVisibility,
  writeCachedDashboardPermissions,
  writeCachedMenuVisibility,
} from "@/lib/dashboard-permissions-cache"
import { getSubeHesapInfo } from "@/lib/sube-utils"

const NAV_ITEMS = [
  { key: "dashboard", title: "Genel Bakış", href: "/dashboard", icon: LayoutDashboard, color: "text-slate-500" },
  { key: "gelir", title: "Gelir Tablosu", href: "/dashboard/gelir", icon: TrendingUp, color: "text-emerald-500" },
  { key: "gider", title: "Gider Tablosu", href: "/dashboard/gider", icon: TrendingDown, color: "text-red-500" },
  { key: "corbalar", title: "Çorbalar", href: "/dashboard/corbalar", icon: Soup, color: "text-orange-500" },
  { key: "maaslar", title: "Maaşlar", href: "/dashboard/maaslar", icon: WalletCards, color: "text-emerald-500" },
  { key: "mesai", title: "Mesai", href: "/dashboard/mesai", icon: Camera, color: "text-amber-500" },
  { key: "vardiya", title: "Vardiya", href: "/dashboard/vardiya", icon: CalendarDays, color: "text-violet-500" },
  { key: "mesai_takip", title: "Mesai Takip", href: "/dashboard/mesai-takip", icon: CalendarDays, color: "text-amber-500" },
  { key: "on_dort_no", title: "Alt Şube Hesapları", href: "/dashboard/14-no-hesap", icon: Landmark, color: "text-lime-500" },
  { key: "sube_ciro_raporlari", title: "Şube Ciro Raporları", href: "/dashboard/sube-ciro-raporlari", icon: BarChart3, color: "text-emerald-500" },
  { key: "sutun_ayarlar", title: "Sütun Ayarları", href: "/dashboard/sutun-ayarlar", icon: Columns3, color: "text-sky-500" },
  { key: "gorunum_ayarlar", title: "Görünüm Ayarları", href: "/dashboard/gorunum-ayarlar", icon: Eye, color: "text-indigo-500" },
  { key: "ayarlar", title: "Genel Ayarlar", href: "/dashboard/ayarlar", icon: Settings, color: "text-gray-500" },
  { key: "guvenlik_ayarlar", title: "Güvenlik Ayarları", href: "/dashboard/guvenlik-ayarlar", icon: Shield, color: "text-emerald-500" },
  { key: "gelismis_log", title: "Gelişmiş Log", href: "/dashboard/gelismis-log", icon: FileSearch, color: "text-rose-500" },
  { key: "sistem_sagligi", title: "Sistem Sağlığı", href: "/dashboard/sistem-sagligi", icon: Activity, color: "text-cyan-500" },
  { key: "mail_islemleri", title: "Mail İşlemleri", href: "/dashboard/mail-islemleri", icon: Mail, color: "text-emerald-500" },
  { key: "admin_ayarlar", title: "Admin Ayarları", href: "/dashboard/admin-ayarlar", icon: ShieldCheck, color: "text-amber-500" },
  { key: "hesap", title: "Hesap Ayarları", href: "/dashboard/hesap", icon: UserCog, color: "text-purple-500" },
]

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function QuickCommand() {
  const { isAdmin, currentSube } = useSube()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [kargoOpen, setKargoOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [kargoFirmalar, setKargoFirmalar] = useState<Array<{ id: string; ad: string }>>([])
  const [menuVisibility, setMenuVisibility] = useState<Record<string, boolean>>({})
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean> | null>(null)

  useEffect(() => {
    const cached = readCachedDashboardPermissions()
    if (cached) setUserPermissions(cached.permissions)
    fetchUserPermissions()

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
    if (open) fetchUserPermissions()
  }, [open])

  useEffect(() => {
    async function loadCurrentSubeData() {
      if (!currentSube) {
        setKargoFirmalar([])
        setMenuVisibility({})
        return
      }

      const cachedVisibility = readCachedMenuVisibility(currentSube.id)
      if (cachedVisibility) setMenuVisibility(cachedVisibility)

      const [firmalarResult, visibilityResult] = await Promise.all([
        supabase
          .from("kargo_cari_firmalar")
          .select("id, ad")
          .eq("sube_id", currentSube.id)
          .eq("aktif", true)
          .order("sira", { ascending: true }),
        supabase
          .from("sube_menu_izinleri")
          .select("menu_key, visible")
          .eq("sube_id", currentSube.id),
      ])

      setKargoFirmalar(firmalarResult.data || [])
      if (visibilityResult.error) return

      const nextVisibility = (visibilityResult.data || []).reduce((acc, item) => ({
        ...acc,
        [item.menu_key]: item.visible,
      }), {} as Record<string, boolean>)
      setMenuVisibility(nextVisibility)
      writeCachedMenuVisibility(currentSube.id, nextVisibility)
    }

    loadCurrentSubeData()
  }, [currentSube?.id])

  async function fetchUserPermissions() {
    const response = await fetch("/api/user/permissions", { cache: "no-store" }).catch(() => null)
    if (!response) {
      const cached = readCachedDashboardPermissions()
      setUserPermissions(cached?.permissions || {})
      return
    }

    const data = await response.json().catch(() => ({}))
    if (response.ok && data.permissions && typeof data.permissions === "object") {
      setUserPermissions(data.permissions)
      writeCachedDashboardPermissions({
        permissions: data.permissions,
        role: data.role || null,
      })
      return
    }

    const cached = readCachedDashboardPermissions()
    setUserPermissions(cached?.permissions || {})
  }

  function canSeeMenu(key: string) {
    if (userPermissions === null) return key === "dashboard"
    if (userPermissions[key] === false) return false
    if (userPermissions[key] === true) return menuVisibility[key] !== false
    if (isAdmin) return menuVisibility[key] !== false
    return false
  }

  const subeHesapInfo = getSubeHesapInfo(currentSube)
  const subeHesapItem = subeHesapInfo
    ? {
        key: "sube_hesap",
        title: subeHesapInfo.title,
        href: subeHesapInfo.href,
        icon: Wallet,
        color: subeHesapInfo.key === "besA" ? "text-emerald-500" : "text-indigo-500",
      }
    : null
  const navigationItems = subeHesapItem
    ? [NAV_ITEMS[0], subeHesapItem, ...NAV_ITEMS.slice(3)]
    : NAV_ITEMS

  const results = useMemo(() => {
    const cleanQuery = normalize(query.trim())
    return navigationItems
      .filter(item => (
        item.key === "sube_hesap"
          ? canSeeMenu("gelir") && canSeeMenu("gider")
          : canSeeMenu(item.key)
      ))
      .filter(item => !cleanQuery || normalize(item.title).includes(cleanQuery))
      .slice(0, 10)
  }, [currentSube?.id, isAdmin, query, menuVisibility, userPermissions])

  const cleanQuery = normalize(query.trim())
  const showKargoGroup = canSeeMenu("kargo_cari") && (
    !cleanQuery ||
    normalize("Kargo Cari").includes(cleanQuery) ||
    kargoFirmalar.some(firma => normalize(firma.ad).includes(cleanQuery))
  )
  const shouldOpenKargo = kargoOpen || Boolean(cleanQuery)
  const visibleKargoFirmalar = kargoFirmalar.filter(firma => (
    !cleanQuery ||
    normalize("Kargo Cari").includes(cleanQuery) ||
    normalize(firma.ad).includes(cleanQuery)
  ))
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

          {results.length === 0 && !showKargoGroup && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">Sonuç bulunamadı.</div>
          )}
        </div>
      </div>
    </div>
  )
}
