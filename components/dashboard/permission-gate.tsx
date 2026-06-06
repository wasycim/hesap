"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  readCachedDashboardPermissions,
  writeCachedDashboardPermissions,
} from "@/lib/dashboard-permissions-cache"

const routePermissions: Array<{ prefix: string; key: string }> = [
  { prefix: "/dashboard/gelir", key: "gelir" },
  { prefix: "/dashboard/gider", key: "gider" },
  { prefix: "/dashboard/vardiya", key: "vardiya" },
  { prefix: "/dashboard/mesai-takip", key: "mesai_takip" },
  { prefix: "/dashboard/mesai", key: "mesai" },
  { prefix: "/dashboard/corbalar", key: "corbalar" },
  { prefix: "/dashboard/kargo-cari", key: "kargo_cari" },
  { prefix: "/dashboard/14-no-hesap", key: "on_dort_no" },
  { prefix: "/dashboard/maaslar", key: "maaslar" },
  { prefix: "/dashboard/bildirim-gonder", key: "bildirim_gonder" },
  { prefix: "/dashboard/sube-ciro-raporlari", key: "sube_ciro_raporlari" },
  { prefix: "/dashboard/sutun-ayarlar", key: "sutun_ayarlar" },
  { prefix: "/dashboard/gorunum-ayarlar", key: "gorunum_ayarlar" },
  { prefix: "/dashboard/ayarlar", key: "ayarlar" },
  { prefix: "/dashboard/guvenlik-ayarlar", key: "guvenlik_ayarlar" },
  { prefix: "/dashboard/gelismis-log", key: "gelismis_log" },
  { prefix: "/dashboard/sistem-sagligi", key: "sistem_sagligi" },
  { prefix: "/dashboard/mail-islemleri", key: "mail_islemleri" },
  { prefix: "/dashboard/admin-ayarlar", key: "admin_ayarlar" },
  { prefix: "/dashboard/lisanslar", key: "lisanslar" },
  { prefix: "/dashboard/operasyon", key: "operasyon" },
  { prefix: "/dashboard/log-backup", key: "log_backup" },
  { prefix: "/dashboard/cay", key: "cay" },
  { prefix: "/dashboard/bildirimler", key: "bildirimler" },
  { prefix: "/dashboard/hesap", key: "hesap" },
]

function permissionKeyForPath(pathname: string) {
  if (pathname === "/dashboard") return "dashboard"
  return routePermissions.find((item) => pathname.startsWith(item.prefix))?.key || "dashboard"
}

export function DashboardPermissionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const permissionKey = useMemo(() => permissionKeyForPath(pathname), [pathname])
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    async function checkPermission() {
      setAllowed(null)
      const response = await fetch("/api/user/permissions", { cache: "no-store" }).catch(() => null)
      const data = await response?.json().catch(() => ({}))
      const permissions = data?.permissions && typeof data.permissions === "object"
        ? data.permissions
        : readCachedDashboardPermissions()?.permissions || {}

      if (data?.permissions && typeof data.permissions === "object") {
        writeCachedDashboardPermissions({
          permissions: data.permissions,
          role: data.role || null,
        })
      }

      const nextAllowed = permissions[permissionKey] !== false && permissions[permissionKey] === true

      if (cancelled) return
      if (!nextAllowed && pathname !== "/dashboard") {
        router.replace("/dashboard")
        return
      }
      setAllowed(nextAllowed || pathname === "/dashboard")
    }

    checkPermission()
    return () => {
      cancelled = true
    }
  }, [pathname, permissionKey, router])

  if (allowed === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
