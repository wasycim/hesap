"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, LogOut, WalletCards } from "lucide-react"
import { Haptics, ImpactStyle } from "@capacitor/haptics"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const items = [
  { href: "/mobile", label: "Genel Bakış", icon: BarChart3 },
  { href: "/mobile/maasim", label: "Maaşım", icon: WalletCards },
]

export function IosAppShell({ children, displayName }: { children: React.ReactNode; displayName: string }) {
  const pathname = usePathname()

  async function logout() {
    await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined)
    await createClient().auth.signOut().catch(() => undefined)
    window.location.href = "/auth/giris"
  }

  const nav = (
    <>
      {items.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)}
            className={cn("ios-nav-item", active && "ios-nav-item-active")}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </>
  )

  return (
    <div className="ios-app-shell">
      <aside className="ios-sidebar">
        <div className="ios-sidebar-brand">
          <img src="/iconw.png" alt="Hesap" className="h-11 w-16 object-contain object-left" />
          <div><strong>Hesap</strong><span>{displayName}</span></div>
        </div>
        <nav>{nav}</nav>
        <button type="button" onClick={logout} className="ios-nav-item ios-logout"><LogOut className="h-5 w-5" /><span>Çıkış</span></button>
      </aside>

      <main className="ios-content">{children}</main>

      <nav className="ios-tabbar">
        {nav}
        <button type="button" onClick={logout} className="ios-nav-item ios-logout"><LogOut className="h-5 w-5" /><span>Çıkış</span></button>
      </nav>
    </div>
  )
}

