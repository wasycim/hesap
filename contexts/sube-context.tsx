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
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
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

    if (subeData) {
      setSubeler(subeData)
    }

    // Kullanıcı profilini çek
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin, sube_id, vardiya")
      .eq("user_id", user.id)
      .single()

    if (profile) {
      setIsAdmin(profile.is_admin || false)
      setUserVardiya(profile.vardiya || null)

      // Kullanıcının şubesini bul
      if (profile.sube_id && subeData) {
        const userSubeData = subeData.find(s => s.id === profile.sube_id)
        if (userSubeData) {
          setUserSube(userSubeData)
          setCurrentSube(userSubeData)
        }
      } else if (profile.is_admin && subeData && subeData.length > 0) {
        // Admin ise son secilen subeyi koru, yoksa ilk subeyi sec.
        const savedSubeId = typeof window !== "undefined"
          ? window.localStorage.getItem("current_sube_id")
          : null
        const savedSube = savedSubeId ? subeData.find(s => s.id === savedSubeId) : null
        setCurrentSube(savedSube || subeData[0])
      }
    }

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
