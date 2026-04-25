"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Soup,
  Settings,
  UserCog,
  LogOut,
  Menu,
  X,
  Package,
  ChevronDown,
  ChevronRight,
  Wallet,
} from "lucide-react"
import { useState, useEffect } from "react"
import { useSube } from "@/contexts/sube-context"
import { Building2 } from "lucide-react"

interface SidebarProps {
  userEmail: string
}

interface KargoFirma {
  id: string
  ad: string
}

const menuItems = [
  {
    title: "Genel Bakis",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Gelir Tablosu",
    href: "/dashboard/gelir",
    icon: TrendingUp,
    color: "text-emerald-500",
  },
  {
    title: "Gider Tablosu",
    href: "/dashboard/gider",
    icon: TrendingDown,
    color: "text-red-500",
  },
  {
    title: "Corbalar",
    href: "/dashboard/corbalar",
    icon: Soup,
    color: "text-orange-500",
  },
]

// Kargo Cari'den sonra gosterilecek menuler
const afterKargoMenuItems = [
  {
    title: "Ayarlar",
    href: "/dashboard/ayarlar",
    icon: Settings,
    color: "text-gray-400",
  },
]

const bottomMenuItems = [
  {
    title: "Hesap Ayarlari",
    href: "/dashboard/hesap",
    icon: UserCog,
    color: "text-purple-500",
  },
]

export function DashboardSidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { subeler, currentSube, setCurrentSube, isAdmin: subeIsAdmin, userSube } = useSube()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [kargoOpen, setKargoOpen] = useState(false)
  const [kargoFirmalar, setKargoFirmalar] = useState<KargoFirma[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [subeMenuOpen, setSubeMenuOpen] = useState(false)

  useEffect(() => {
  fetchKargoFirmalar()
  checkAdminStatus()
}, [currentSube?.id])

  async function checkAdminStatus() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .single()

    setIsAdmin(profile?.is_admin || false)
  }

  // Kargo Cari altindaki bir sayfadaysak otomatik ac
  useEffect(() => {
    if (pathname.startsWith("/dashboard/kargo-cari")) {
      setKargoOpen(true)
    }
  }, [pathname])

  async function fetchKargoFirmalar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (!currentSube) return

const { data } = await supabase
  .from("kargo_cari_firmalar")
  .select("id, ad")
  .eq("sube_id", currentSube.id)
  .eq("aktif", true)
  .order("sira", { ascending: true })

    if (data) {
      setKargoFirmalar(data)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/giris")
    router.refresh()
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-sidebar-foreground">Hesap Rapor</h1>
          <p className="text-xs text-sidebar-foreground/60">Yonetim Sistemi</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40">
          Menu
        </div>
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", item.color)} />
                  <span>{item.title}</span>
                </Link>
              </li>
            )
          })}
          
          {/* Kargo Cari - Expandable */}
          <li>
            <button
              onClick={() => setKargoOpen(!kargoOpen)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                pathname.startsWith("/dashboard/kargo-cari")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-cyan-500" />
                <span>Kargo Cari</span>
              </div>
              {kargoOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            
            {/* Sub items */}
            {kargoOpen && (
              <ul className="mt-1 ml-4 space-y-1 border-l border-sidebar-border pl-4">
                {/* Borc Ozeti - Sadece Admin */}
                {isAdmin && (
                  <li>
                    <Link
                      href="/dashboard/kargo-cari"
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                        pathname === "/dashboard/kargo-cari"
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <Wallet className="h-4 w-4 text-red-500" />
                      <span>Borc Ozeti</span>
                    </Link>
                  </li>
                )}
                {kargoFirmalar.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-sidebar-foreground/50">
                    Firma yok. Ayarlar&apos;dan ekleyin.
                  </li>
                ) : (
                  kargoFirmalar.map((firma) => {
                    const isActive = pathname === `/dashboard/kargo-cari/${firma.id}`
                    return (
                      <li key={firma.id}>
                        <Link
                          href={`/dashboard/kargo-cari/${firma.id}`}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all",
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
            )}
          </li>
          
          {/* Ayarlar - Sadece Admin için */}
          {isAdmin && afterKargoMenuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", item.color)} />
                  <span>{item.title}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Bottom Menu & User */}
      <div className="border-t border-sidebar-border p-3">
        {/* Şube Seçici - Sadece Admin için */}
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
              {subeMenuOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
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
                        ? "bg-indigo-100 text-indigo-700 font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
                    )}
                  >
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      currentSube?.id === sube.id ? "bg-indigo-500" : "bg-gray-400"
                    )} />
                    <span>Şube {sube.ad}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Normal kullanıcı için şube göstergesi */}
        {!subeIsAdmin && userSube && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-indigo-100 px-3 py-2 text-sm font-medium text-indigo-700">
            <Building2 className="h-4 w-4" />
            <span>Şube: {userSube.ad}</span>
          </div>
        )}
        
        {/* Hesap Ayarları */}
        <ul className="mb-3 space-y-1">
          {bottomMenuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", item.color)} />
                  <span>{item.title}</span>
                </Link>
              </li>
            )
          })}
        </ul>
        
        <div className="mb-3 rounded-lg bg-sidebar-accent/30 px-3 py-2">
          <p className="truncate text-xs font-medium text-sidebar-foreground/80">
            {userEmail}
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span>Cikis Yap</span>
        </Button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar transition-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col bg-sidebar lg:flex">
        <SidebarContent />
      </aside>
    </>
  )
}
