"use client"

export type CachedDashboardPermissions = {
  permissions: Record<string, boolean>
  role?: string | null
  savedAt: string
}

const permissionCacheKey = "hesap.dashboard.permissions.v1"
const menuVisibilityPrefix = "hesap.dashboard.menuVisibility.v1"

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage)
}

export function readCachedDashboardPermissions() {
  if (!canUseStorage()) return null
  const cached = safeParse<CachedDashboardPermissions | null>(
    window.localStorage.getItem(permissionCacheKey),
    null,
  )
  if (!cached || !cached.permissions || typeof cached.permissions !== "object") return null
  return cached
}

export function writeCachedDashboardPermissions(payload: {
  permissions: Record<string, boolean>
  role?: string | null
}) {
  if (!canUseStorage()) return
  if (!payload.permissions || typeof payload.permissions !== "object") return
  window.localStorage.setItem(permissionCacheKey, JSON.stringify({
    permissions: payload.permissions,
    role: payload.role || null,
    savedAt: new Date().toISOString(),
  }))
}

export function menuVisibilityCacheKey(subeId?: string | null) {
  return `${menuVisibilityPrefix}:${subeId || "none"}`
}

export function readCachedMenuVisibility(subeId?: string | null) {
  if (!canUseStorage()) return null
  const cached = safeParse<{
    visibility: Record<string, boolean>
    savedAt: string
  } | null>(window.localStorage.getItem(menuVisibilityCacheKey(subeId)), null)
  if (!cached || !cached.visibility || typeof cached.visibility !== "object") return null
  return cached.visibility
}

export function writeCachedMenuVisibility(subeId: string | null | undefined, visibility: Record<string, boolean>) {
  if (!canUseStorage()) return
  if (!visibility || typeof visibility !== "object") return
  window.localStorage.setItem(menuVisibilityCacheKey(subeId), JSON.stringify({
    visibility,
    savedAt: new Date().toISOString(),
  }))
}
