"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Activity,
  BarChart3,
  BellRing,
  BellPlus,
  Building2,
  CalendarDays,
  Camera,
  DatabaseBackup,
  ChevronDown,
  ChevronRight,
  Columns3,
  Eye,
  FileSearch,
  Landmark,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MonitorCheck,
  Package,
  Settings,
  Shield,
  ShieldCheck,
  Soup,
  Coffee,
  TrendingDown,
  TrendingUp,
  UserCog,
  Wallet,
  WalletCards,
  Wrench,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSube } from "@/contexts/sube-context"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  readCachedDashboardPermissions,
  readCachedMenuVisibility,
  writeCachedDashboardPermissions,
  writeCachedMenuVisibility,
} from "@/lib/dashboard-permissions-cache"

interface SidebarProps {
  userEmail: string
  displayName?: string
}

interface KargoFirma {
  id: string
  ad: string
}

const menuItems = [
  { key: "dashboard", title: "Genel Bakış", href: "/dashboard", icon: LayoutDashboard },
  { key: "gelir", title: "Gelir Tablosu", href: "/dashboard/gelir", icon: TrendingUp, color: "text-emerald-500" },
  { key: "gider", title: "Gider Tablosu", href: "/dashboard/gider", icon: TrendingDown, color: "text-red-500" },
  { key: "vardiya", title: "Vardiya", href: "/dashboard/vardiya", icon: CalendarDays, color: "text-violet-500" },
  { key: "mesai", title: "Mesai", href: "/dashboard/mesai", icon: Camera, color: "text-amber-500" },
  { key: "mesai_takip", title: "Mesai Takip", href: "/dashboard/mesai-takip", icon: CalendarDays, color: "text-amber-500" },
  { key: "corbalar", title: "Çorbalar", href: "/dashboard/corbalar", icon: Soup, color: "text-orange-500" },
]

const maasMenuItem = { key: "maaslar", title: "Maaşlar", href: "/dashboard/maaslar", icon: WalletCards, color: "text-emerald-500" }

const adminMenuItems = [
  { key: "bildirim_gonder", title: "Bildirim Gonder", href: "/dashboard/bildirim-gonder", icon: BellPlus, color: "text-emerald-500" },
  { title: "Şube Ciro Raporları", href: "/dashboard/sube-ciro-raporlari", icon: BarChart3, color: "text-emerald-500" },
  { title: "Sütun Ayarları", href: "/dashboard/sutun-ayarlar", icon: Columns3, color: "text-sky-500" },
  { title: "Görünüm Ayarları", href: "/dashboard/gorunum-ayarlar", icon: Eye, color: "text-indigo-500" },
  { title: "Genel Ayarlar", href: "/dashboard/ayarlar", icon: Settings, color: "text-gray-400" },
  { title: "Güvenlik Ayarları", href: "/dashboard/guvenlik-ayarlar", icon: Shield, color: "text-emerald-500" },
  { title: "Gelişmiş Log", href: "/dashboard/gelismis-log", icon: FileSearch, color: "text-rose-500" },
  { title: "Sistem Sağlığı", href: "/dashboard/sistem-sagligi", icon: Activity, color: "text-cyan-500" },
  { title: "Mail İşlemleri", href: "/dashboard/mail-islemleri", icon: Mail, color: "text-emerald-500" },
  { title: "Admin Ayarları", href: "/dashboard/admin-ayarlar", icon: ShieldCheck, color: "text-amber-500" },
]

const bottomMenuItems = [
  { title: "Cay", href: "/dashboard/cay", icon: Coffee, color: "text-amber-500" },
  { title: "Bildirimler", href: "/dashboard/bildirimler", icon: BellRing, color: "text-emerald-500" },
  { title: "Hesap Ayarları", href: "/dashboard/hesap", icon: UserCog, color: "text-purple-500" },
]

const developerOnlyHrefs = new Set(["/dashboard/gelismis-log", "/dashboard/sistem-sagligi"])

const developerMenuItems = [
  { title: "Lisansli Cihazlar", href: "/dashboard/lisanslar", icon: MonitorCheck, color: "text-lime-500" },
  { title: "Operasyon Merkezi", href: "/dashboard/operasyon", icon: Wrench, color: "text-violet-500" },
  { title: "Log Backup", href: "/dashboard/log-backup", icon: DatabaseBackup, color: "text-cyan-500" },
]

const permissionKeyByHref: Record<string, string> = {
  "/dashboard/bildirim-gonder": "bildirim_gonder",
  "/dashboard/sube-ciro-raporlari": "sube_ciro_raporlari",
  "/dashboard/sutun-ayarlar": "sutun_ayarlar",
  "/dashboard/gorunum-ayarlar": "gorunum_ayarlar",
  "/dashboard/ayarlar": "ayarlar",
  "/dashboard/guvenlik-ayarlar": "guvenlik_ayarlar",
  "/dashboard/gelismis-log": "gelismis_log",
  "/dashboard/sistem-sagligi": "sistem_sagligi",
  "/dashboard/mail-islemleri": "mail_islemleri",
  "/dashboard/admin-ayarlar": "admin_ayarlar",
  "/dashboard/lisanslar": "lisanslar",
  "/dashboard/operasyon": "operasyon",
  "/dashboard/log-backup": "log_backup",
  "/dashboard/cay": "cay",
  "/dashboard/bildirimler": "bildirimler",
  "/dashboard/hesap": "hesap",
}

function getMenuIconMotion(href: string) {
  if (href === "/dashboard") return "menu-icon-dashboard"
  if (href === "/dashboard/gelir") return "menu-icon-income"
  if (href === "/dashboard/gider") return "menu-icon-expense"
  if (href === "/dashboard/mesai-takip") return "menu-icon-pop"
  if (href === "/dashboard/corbalar") return "menu-icon-soup"
  if (href === "/dashboard/sube-ciro-raporlari") return "menu-icon-report"
  if (href === "/dashboard/14-no-hesap") return "menu-icon-bank"
  if (href === "/dashboard/ayarlar") return "menu-icon-spin"
  if (href === "/dashboard/guvenlik-ayarlar") return "menu-icon-security"
  if (href === "/dashboard/gelismis-log") return "menu-icon-report"
  if (href === "/dashboard/sistem-sagligi") return "menu-icon-pulse"
  if (href === "/dashboard/admin-ayarlar") return "menu-icon-admin"
  if (href.includes("sutun")) return "menu-icon-columns"
  if (href.includes("gorunum")) return "menu-icon-eye"
  if (href.includes("hesap")) return "menu-icon-account-settings"
  return "menu-icon-pop"
}

function AnimatedShiftMenuIcon() {
  const [dateParts, setDateParts] = useState({ day: "", month: "" })

  useEffect(() => {
    const updateDate = () => {
      const now = new Date()
      setDateParts({
        day: new Intl.DateTimeFormat("tr-TR", { day: "2-digit", timeZone: "Europe/Istanbul" }).format(now),
        month: new Intl.DateTimeFormat("tr-TR", { month: "short", timeZone: "Europe/Istanbul" }).format(now).replace(".", ""),
      })
    }

    updateDate()
    const timer = window.setInterval(updateDate, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <span className="relative grid h-6 w-6 shrink-0 place-items-center text-violet-500 [perspective:90px]">
      <span className="absolute left-[3px] right-[3px] top-[5px] h-[17px] rounded-[5px] border border-current/70 bg-sidebar shadow-sm" />
      <span className="absolute left-[3px] right-[3px] top-[5px] h-[6px] rounded-t-[5px] bg-current" />
      <span className="absolute left-[7px] top-[2px] h-[6px] w-[2px] rounded-full bg-current" />
      <span className="absolute right-[7px] top-[2px] h-[6px] w-[2px] rounded-full bg-current" />
      <span className="absolute left-[5px] right-[5px] top-[11px] grid h-[9px] place-items-center rounded-[3px] bg-current/8">
        <span className="text-[8px] font-black leading-none text-current">{dateParts.day || "--"}</span>
      </span>
      <span className="absolute bottom-[2px] text-[4.5px] font-bold uppercase leading-none text-current/70">
        {dateParts.month || "---"}
      </span>
      <span className="absolute left-[5px] right-[5px] top-[11px] h-[9px] origin-top rounded-[3px] border border-current/35 bg-sidebar group-hover:animate-[shift-calendar-flip_1.15s_ease-in-out_1] group-focus-visible:animate-[shift-calendar-flip_1.15s_ease-in-out_1]">
        <span className="grid h-full place-items-center text-[8px] font-black leading-none text-current">{dateParts.day || "--"}</span>
      </span>
      <style jsx>{`
        @keyframes shift-calendar-flip {
          0%, 28%, 100% { opacity: 1; transform: rotateX(0deg) translateY(0); }
          45% { opacity: .92; transform: rotateX(68deg) translateY(1px); }
          58% { opacity: 0; transform: rotateX(88deg) translateY(4px); }
          76% { opacity: 0; transform: rotateX(0deg) translateY(-4px); }
        }
      `}</style>
    </span>
  )
}

function AnimatedMesaiTakipIcon() {
  return (
    <span className="relative grid h-5 w-5 shrink-0 place-items-center text-amber-500">
      <svg viewBox="0 0 24 24" className="h-5 w-5 overflow-visible" aria-hidden="true">
        <path d="M10 2h4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        <path d="M12 14v-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        <g className="mesai-tracker-arrow">
          <path
            d="M4 13a8 8 0 0 1 8-7 8 8 0 1 1-5.3 14L4 17.6"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path d="M9 17H4v5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </g>
      </svg>
      <style jsx>{`
        .mesai-tracker-arrow {
          transform-box: view-box;
          transform-origin: 12px 14px;
        }

        :global(.sidebar-menu-item:hover) .mesai-tracker-arrow,
        :global(.sidebar-menu-item:focus-visible) .mesai-tracker-arrow {
          animation: mesai-arrow-spin 900ms linear infinite;
        }

        @keyframes mesai-arrow-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </span>
  )
}

function AnimatedMesaiCameraIcon() {
  return (
    <span className="relative grid h-5 w-5 shrink-0 place-items-center text-amber-500">
      <svg viewBox="0 0 24 24" className="h-5 w-5 overflow-visible" aria-hidden="true">
        <path
          d="M7.4 7.4 9 5.2h5.2l1.6 2.2H18a2.6 2.6 0 0 1 2.6 2.6v6.4A2.6 2.6 0 0 1 18 19H6a2.6 2.6 0 0 1-2.6-2.6V10A2.6 2.6 0 0 1 6 7.4h1.4Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <circle cx="12" cy="13.2" r="3.1" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.4" cy="10.2" r="0.7" fill="currentColor" />
        <g className="mesai-camera-flash" transform="translate(18.4 8.1)">
          <path d="M0-1.8v-2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <path d="M1.4-1.4 2.8-2.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <path d="M1.8 0h2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <circle cx="0" cy="0" r="2.4" fill="currentColor" opacity="0.18" />
        </g>
      </svg>
      <style jsx>{`
        .mesai-camera-flash {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
        }

        :global(.sidebar-menu-item:hover) .mesai-camera-flash,
        :global(.sidebar-menu-item:focus-visible) .mesai-camera-flash {
          animation: mesai-camera-flash-pop 950ms ease-out infinite;
        }

        @keyframes mesai-camera-flash-pop {
          0%, 100% {
            opacity: 0;
            transform: scale(0.72);
          }
          12% {
            opacity: 1;
            transform: scale(1.15);
          }
          28% {
            opacity: 0.65;
            transform: scale(1);
          }
          42% {
            opacity: 0;
            transform: scale(1.28);
          }
        }
      `}</style>
    </span>
  )
}

export function DashboardSidebar({ userEmail, displayName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { subeler, currentSube, setCurrentSube, isAdmin: subeIsAdmin, userSube } = useSube()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [kargoOpen, setKargoOpen] = useState(false)
  const [kargoFirmalar, setKargoFirmalar] = useState<KargoFirma[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isDeveloper, setIsDeveloper] = useState(false)
  const [subeMenuOpen, setSubeMenuOpen] = useState(false)
  const [menuVisibility, setMenuVisibility] = useState<Record<string, boolean>>({})
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean> | null>(null)

  const isCarsiOrDarica = currentSube && (
    currentSube.id === "9a650980-23f4-4fe8-8b35-092bea7ab7fd" ||
    currentSube.id === "dda1d0e9-3a5e-487a-a2ae-ccb1adf85734" ||
    currentSube.kod === "CARSI" ||
    currentSube.kod === "DARICA"
  )

  useEffect(() => {
    checkAdminStatus()
    const cached = readCachedDashboardPermissions()
    if (cached) setUserPermissions(cached.permissions)
  }, [])

  useEffect(() => {
    const refreshPermissions = () => {
      if (document.visibilityState !== "hidden") fetchUserPermissions()
    }

    window.addEventListener("focus", refreshPermissions)
    document.addEventListener("visibilitychange", refreshPermissions)
    return () => {
      window.removeEventListener("focus", refreshPermissions)
      document.removeEventListener("visibilitychange", refreshPermissions)
    }
  }, [])

  useEffect(() => {
    if (currentSube) {
      fetchKargoFirmalar()
      fetchMenuVisibility()
    } else {
      setKargoFirmalar([])
      setMenuVisibility({})
    }
  }, [currentSube?.id])

  useEffect(() => {
    window.addEventListener("kargo-firmalar-changed", fetchKargoFirmalar)
    return () => window.removeEventListener("kargo-firmalar-changed", fetchKargoFirmalar)
  }, [currentSube?.id])

  useEffect(() => {
    if (pathname.startsWith("/dashboard/kargo-cari")) {
      setKargoOpen(true)
    }
  }, [pathname])

  async function checkAdminStatus() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin, is_developer")
      .eq("user_id", user.id)
      .single()

    setIsAdmin(Boolean(profile?.is_admin || profile?.is_developer))
    setIsDeveloper(Boolean(profile?.is_developer))
    fetchUserPermissions()
  }

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

  async function fetchKargoFirmalar() {
    if (!currentSube) return

    const { data } = await supabase
      .from("kargo_cari_firmalar")
      .select("id, ad")
      .eq("sube_id", currentSube.id)
      .eq("aktif", true)
      .order("sira", { ascending: true })

    setKargoFirmalar(data || [])
  }

  async function fetchMenuVisibility() {
    if (!currentSube) return

    const cached = readCachedMenuVisibility(currentSube.id)
    if (cached) setMenuVisibility(cached)

    const { data, error } = await supabase
      .from("sube_menu_izinleri")
      .select("menu_key, visible")
      .eq("sube_id", currentSube.id)

    if (error) return

    const visibility = (data || []).reduce((acc, item) => ({
      ...acc,
      [item.menu_key]: item.visible,
    }), {} as Record<string, boolean>)

    setMenuVisibility(visibility)
    writeCachedMenuVisibility(currentSube.id, visibility)
  }

  function canSeeMenu(key: string) {
    if (isCarsiOrDarica && (key === "gelir" || key === "gider" || key === "on_dort_no")) {
      return false
    }
    if (userPermissions === null) return key === "dashboard"
    if (userPermissions[key] === false) return false
    if (userPermissions[key] === true) return menuVisibility[key] !== false
    if (isDeveloper || isAdmin) return menuVisibility[key] !== false
    return false
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/giris")
    router.refresh()
  }

  const SidebarContent = () => (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-sidebar-foreground">Hesap Rapor</h1>
          <p className="text-xs text-sidebar-foreground/60">Yönetim Sistemi</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40">
          Menü
        </div>
        <ul className="space-y-1">
          {menuItems.filter(item => canSeeMenu(item.key)).map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "sidebar-menu-item group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  {item.href === "/dashboard/vardiya" ? (
                    <AnimatedShiftMenuIcon />
                  ) : item.href === "/dashboard/mesai" ? (
                    <AnimatedMesaiCameraIcon />
                  ) : item.href === "/dashboard/mesai-takip" ? (
                    <AnimatedMesaiTakipIcon />
                  ) : (
                    <item.icon className={cn("sidebar-menu-icon h-5 w-5", getMenuIconMotion(item.href), item.color)} />
                  )}
                  <span>{(item.key === "dashboard" && isCarsiOrDarica) ? "Hesap" : item.title}</span>
                </Link>
              </li>
            )
          })}

          {canSeeMenu("kargo_cari") && (
            <li>
              <button
                onClick={() => setKargoOpen(prev => !prev)}
                className={cn(
                    "sidebar-menu-item group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  pathname.startsWith("/dashboard/kargo-cari")
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <Package className="sidebar-menu-icon menu-icon-cube h-5 w-5 text-cyan-500" />
                  <span>Kargo Cari</span>
                </div>
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-500", kargoOpen ? "rotate-0" : "-rotate-90")} />
              </button>

              {kargoOpen && (
                <div className="mt-1 overflow-hidden">
                  <ul className="ml-4 mt-1 overflow-hidden border-l border-sidebar-border pl-4">
                  {isAdmin && (
                    <li className="sidebar-submenu-row-in">
                      <Link
                        href="/dashboard/kargo-cari"
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "sidebar-menu-item group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                          pathname === "/dashboard/kargo-cari"
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <Wallet className="sidebar-menu-icon menu-icon-wallet h-4 w-4 text-red-500" />
                        <span>Borç Özeti</span>
                      </Link>
                    </li>
                  )}
                  {kargoFirmalar.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-sidebar-foreground/50">
                      Firma yok. Genel Ayarlar'dan ekleyin.
                    </li>
                  ) : (
                    kargoFirmalar.map((firma, index) => {
                      const isActive = pathname === `/dashboard/kargo-cari/${firma.id}`
                      return (
                        <li key={firma.id} className="sidebar-submenu-row-in" style={{ animationDelay: `${80 + index * 60}ms` }}>
                          <Link
                            href={`/dashboard/kargo-cari/${firma.id}`}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "sidebar-menu-item group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all",
                              isActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            )}
                          >
                            <div className="h-2 w-2 rounded-full bg-cyan-500" />
                            <span>{firma.ad}</span>
                          </Link>
                        </li>
                      )
                    })
                  )}
                  </ul>
                </div>
              )}
            </li>
          )}

          {canSeeMenu("on_dort_no") && (
            <li>
              <Link
                href="/dashboard/14-no-hesap"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "sidebar-menu-item group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  pathname.startsWith("/dashboard/14-no-hesap")
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Landmark className="sidebar-menu-icon menu-icon-bank h-5 w-5 text-lime-500" />
                <span>Alt Şube Hesapları</span>
              </Link>
            </li>
          )}

          {canSeeMenu(maasMenuItem.key) && (() => {
            const isActive = pathname === maasMenuItem.href
            const Icon = maasMenuItem.icon
            return (
              <li key={maasMenuItem.href}>
                <Link
                  href={maasMenuItem.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "sidebar-menu-item group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className={cn("sidebar-menu-icon menu-icon-salary h-5 w-5", maasMenuItem.color)} />
                  <span>{maasMenuItem.title}</span>
                </Link>
              </li>
            )
          })()}

          {adminMenuItems.filter((item) => canSeeMenu(permissionKeyByHref[item.href] || (item as any).key || item.href) && (isDeveloper || !developerOnlyHrefs.has(item.href))).map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "sidebar-menu-item group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn("sidebar-menu-icon h-5 w-5", getMenuIconMotion(item.href), item.color)} />
                  <span>{item.title}</span>
                </Link>
              </li>
            )
          })}
          {developerMenuItems.filter((item) => canSeeMenu(permissionKeyByHref[item.href] || item.href)).map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "sidebar-menu-item group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn("sidebar-menu-icon h-5 w-5", getMenuIconMotion(item.href), item.color)} />
                  <span>{item.title}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {subeIsAdmin && subeler.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setSubeMenuOpen(!subeMenuOpen)}
              className="flex w-full items-center justify-between gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-3 py-2.5 text-sm font-medium text-white transition-all hover:from-indigo-600 hover:to-purple-600"
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>Şube: {currentSube?.ad || "Seçiniz"}</span>
              </div>
              {subeMenuOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {subeMenuOpen && (
              <div className="mt-1 rounded-lg border border-sidebar-border bg-sidebar-accent/20 p-1">
                {subeler.map((sube) => (
                  <button
                    key={sube.id}
                    onClick={() => {
                      setCurrentSube(sube)
                      setSubeMenuOpen(false)
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-all",
                      currentSube?.id === sube.id
                        ? "bg-indigo-100 font-medium text-indigo-700"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
                    )}
                  >
                    <div className={cn("h-2 w-2 rounded-full", currentSube?.id === sube.id ? "bg-indigo-500" : "bg-gray-400")} />
                    <span>Şube {sube.ad}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!subeIsAdmin && userSube && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-indigo-100 px-3 py-2 text-sm font-medium text-indigo-700">
            <Building2 className="h-4 w-4" />
            <span>Şube: {userSube.ad}</span>
          </div>
        )}

        <ul className="mb-3 space-y-1">
          {bottomMenuItems.filter((item) => canSeeMenu(permissionKeyByHref[item.href] || item.href)).map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "sidebar-menu-item group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn("sidebar-menu-icon h-5 w-5", getMenuIconMotion(item.href), item.color)} />
                  <span>{item.title}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="mb-3 flex items-center gap-2 rounded-lg bg-sidebar-accent/30 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-sidebar-foreground/90">{displayName || userEmail}</p>
            {displayName && <p className="truncate text-[10px] text-sidebar-foreground/50">{userEmail}</p>}
          </div>
          <ThemeToggle className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="sidebar-logout-button w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="logout-icon h-4 w-4" />
          <span>Çıkış Yap</span>
        </Button>
      </div>
    </>
  )

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 border bg-background/90 shadow-sm backdrop-blur lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-[min(18rem,86vw)] flex-col bg-sidebar pt-[env(safe-area-inset-top)] shadow-2xl transition-transform duration-300 ease-out lg:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <SidebarContent />
      </aside>

      <aside className="hidden w-64 flex-col bg-sidebar lg:flex">
        <SidebarContent />
      </aside>
    </>
  )
}
