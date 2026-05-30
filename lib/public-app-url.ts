const productionAppUrl = "https://pamukkaleturizm.info"

function normalizeAppUrl(value?: string | null) {
  if (!value) return null

  const trimmed = value.trim().replace(/\/+$/, "")
  if (!trimmed) return null

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)
    const hostname = url.hostname.toLowerCase()

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")) {
      return null
    }

    return url.origin
  } catch {
    return null
  }
}

export function publicAppOrigin() {
  return (
    normalizeAppUrl(process.env.PASSWORD_RESET_BASE_URL) ||
    normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeAppUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    productionAppUrl
  )
}

export function shouldForcePublicOrigin(origin: string) {
  return normalizeAppUrl(origin) !== publicAppOrigin()
}
