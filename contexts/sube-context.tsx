"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

interface Sube {
  id: string
  ad: string
  kod: string
}

interface SubeContextType {
  subeler: Sube[]
  currentSube: Sube | null
  userSube: Sube | null
  isAdmin: boolean
  setCurrentSube: (sube: Sube) => void
  loading: boolean
  currentUserId: string | null
  refreshKey: number // Şube değişince artır, componentler bunu izleyip yenilensin
  userVardiya: string | null // S=Sabah, A=Akşam, null=Hepsi
}

const SubeContext = createContext<SubeContextType | undefined>(undefined)
const subeCacheKey = "hesap_sube_context_cache"

type CachedSubeContext = {
  subeler: Sube[]
  currentSube: Sube | null
  userSube: Sube | null
  isAdmin: boolean
  currentUserId: string | null
  userVardiya: string | null
}

function readSubeCache(): CachedSubeContext | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(subeCacheKey)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeSubeCache(value: CachedSubeContext) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(subeCacheKey, JSON.stringify(value))
}

export function SubeProvider({ children }: { children: ReactNode }) {
  const [subeler, setSubeler] = useState<Sube[]>([])
  const [currentSube, setCurrentSube] = useState<Sube | null>(null)
  const [userSube, setUserSube] = useState<Sube | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [userVardiya, setUserVardiya] = useState<string | null>(null)
  const supabase = createClient()

  // Şube değişince refreshKey'i artır
  function handleSetCurrentSube(sube: Sube) {
    setCurrentSube(sube)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("current_sube_id", sube.id)
    }
    setRefreshKey(prev => prev + 1)
  }

  useEffect(() => {
    loadSubeData()
  }, [])

  async function loadSubeData() {
    setLoading(true)
    
    const userResult = await supabase.auth.getUser().catch(() => null)
    let user = userResult?.data?.user || null
    if (!user) {
      const sessionResult = await supabase.auth.getSession().catch(() => null)
      user = sessionResult?.data?.session?.user || null
    }

    if (!user) {
      const cached = readSubeCache()
      if (cached) {
        setSubeler(cached.subeler)
        setCurrentSube(cached.currentSube)
        setUserSube(cached.userSube)
        setIsAdmin(cached.isAdmin)
        setCurrentUserId(cached.currentUserId)
        setUserVardiya(cached.userVardiya)
      }
      setLoading(false)
      return
    }

    setCurrentUserId(user.id)

    // Tüm şubeleri çek
    const { data: subeData } = await supabase
      .from("subeler")
      .select("*")
      .eq("aktif", true)
      .order("ad")

    const cached = readSubeCache()
    const nextSubeler = (subeData && subeData.length > 0) ? subeData : cached?.subeler || []
    setSubeler(nextSubeler)

    // Kullanıcı profilini çek
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin, is_developer, sube_id, vardiya")
      .eq("user_id", user.id)
      .single()

    const nextIsAdmin = profile ? Boolean(profile.is_admin || profile.is_developer) : cached?.isAdmin || false
    const nextUserVardiya = profile ? profile.vardiya || null : cached?.userVardiya || null
    let nextUserSube: Sube | null = cached?.userSube || null
    let nextCurrentSube: Sube | null = cached?.currentSube || null

    if (profile) {
      setIsAdmin(nextIsAdmin)
      setUserVardiya(nextUserVardiya)
      // Kullanıcının şubesini bul
      if (profile.sube_id && nextSubeler) {
        const userSubeData = nextSubeler.find(s => s.id === profile.sube_id)
        if (userSubeData) {
          nextUserSube = userSubeData
          
          // Son secilen subeyi localStoragedan oku, eger varsa onu koru, yoksa kullanici subesini sec
          const savedSubeId = typeof window !== "undefined"
            ? window.localStorage.getItem("current_sube_id")
            : null
          const savedSube = savedSubeId ? nextSubeler.find(s => s.id === savedSubeId) : null
          nextCurrentSube = savedSube || userSubeData
        }
      } else if ((profile.is_admin || profile.is_developer) && nextSubeler && nextSubeler.length > 0) {
        // Admin ise son secilen subeyi koru, yoksa ilk subeyi sec.
        const savedSubeId = typeof window !== "undefined"
          ? window.localStorage.getItem("current_sube_id")
          : null
        const savedSube = savedSubeId ? nextSubeler.find(s => s.id === savedSubeId) : null
        nextCurrentSube = savedSube || nextSubeler[0]
      }
    } else if (cached) {
      setIsAdmin(cached.isAdmin)
      setUserVardiya(cached.userVardiya)
    }

    setUserSube(nextUserSube)
    setCurrentSube(nextCurrentSube)
    writeSubeCache({
      subeler: nextSubeler,
      currentSube: nextCurrentSube,
      userSube: nextUserSube,
      isAdmin: nextIsAdmin,
      currentUserId: user.id,
      userVardiya: nextUserVardiya,
    })

    setLoading(false)
  }

  return (
    <SubeContext.Provider value={{
      subeler,
      currentSube,
      userSube,
      isAdmin,
      setCurrentSube: handleSetCurrentSube,
      loading,
      currentUserId,
      refreshKey,
      userVardiya
    }}>
      {children}
    </SubeContext.Provider>
  )
}

export function useSube() {
  const context = useContext(SubeContext)
  if (context === undefined) {
    throw new Error("useSube must be used within a SubeProvider")
  }
  return context
}
