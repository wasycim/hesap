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
  Columns3,
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
  {
    title: "Sütun Ayarları",
    href: "/dashboard/sutun-ayarlar",
    icon: Columns3,
    color: "text-sky-500",
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
