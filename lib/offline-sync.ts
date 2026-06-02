type OfflineJob = {
  id: string
  url: string
  init: {
    method?: string
    headers?: Record<string, string>
    body?: string
    credentials?: RequestCredentials
  }
  meta?: {
    label?: string
    queuedResponseBody?: Record<string, unknown>
  }
  createdAt: string
}

const storageKey = "hesap_offline_queue"
const responseCacheKey = "hesap_offline_response_cache"
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"])
let originalFetch: typeof fetch | null = null

type CachedResponse = {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  createdAt: string
}

function readQueue(): OfflineJob[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeQueue(jobs: OfflineJob[]) {
  if (typeof window === "undefined") return
  const nextJobs = jobs.slice(-250)
  window.localStorage.setItem(storageKey, JSON.stringify(nextJobs))
  window.dispatchEvent(new CustomEvent("hesap-offline-queue-change", { detail: { count: nextJobs.length } }))
}

function readResponseCache(): Record<string, CachedResponse> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(responseCacheKey)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeResponseCache(cache: Record<string, CachedResponse>) {
  if (typeof window === "undefined") return
  const entries = Object.entries(cache)
    .sort(([, a], [, b]) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 120)
  window.localStorage.setItem(responseCacheKey, JSON.stringify(Object.fromEntries(entries)))
}

function requestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

function normalizeUrl(url: string) {
  if (typeof window === "undefined") return url
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.origin === window.location.origin ? `${parsed.pathname}${parsed.search}` : parsed.toString()
  } catch {
    return url
  }
}

export function queueOfflineMutation(url: string, init: OfflineJob["init"], meta?: OfflineJob["meta"]) {
  const jobs = readQueue()
  jobs.push({
    id: requestId(),
    url: normalizeUrl(url),
    init,
    meta,
    createdAt: new Date().toISOString(),
  })
  writeQueue(jobs)
}

export function getOfflineQueueCount() {
  return readQueue().length
}

export function getOfflineQueue() {
  return readQueue()
}

export async function flushOfflineMutations() {
  const jobs = readQueue()
  if (jobs.length === 0) return { synced: 0, remaining: 0 }

  const fetcher = originalFetch || fetch
  const remaining: OfflineJob[] = []
  let synced = 0

  for (const job of jobs) {
    try {
      const response = await fetcher(job.url, job.init)
      if (response.ok) {
        synced += 1
      } else {
        const serverPayload = await response.clone().json().catch(() => ({ status: response.status }))
        await fetcher("/api/offline-conflicts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mutation_path: job.url,
            client_payload: { init: job.init, meta: job.meta, createdAt: job.createdAt },
            server_payload: serverPayload,
          }),
        }).catch(() => undefined)
        remaining.push(job)
      }
    } catch {
      remaining.push(job)
    }
  }

  writeQueue(remaining)
  return { synced, remaining: remaining.length }
}

function shouldQueueRequest(request: Request) {
  const method = request.method.toUpperCase()
  if (!unsafeMethods.has(method)) return false

  const url = new URL(request.url)
  const contentType = request.headers.get("content-type") || ""
  if (contentType.includes("multipart/form-data")) return false
  if (url.pathname.includes("/auth/")) return false
  if (url.pathname === "/api/personel/scan-terminal") return false

  if (url.origin === window.location.origin) {
    if (!url.pathname.startsWith("/api/")) return false
    if (url.pathname === "/api/admin/backup") return false
    return true
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    try {
      const supabaseOrigin = new URL(supabaseUrl).origin
      return url.origin === supabaseOrigin && url.pathname.includes("/rest/v1/")
    } catch {
      return false
    }
  }

  return false
}

function shouldCacheRequest(request: Request) {
  if (request.method.toUpperCase() !== "GET") return false
  const url = new URL(request.url)

  if (url.origin === window.location.origin) {
    if (!url.pathname.startsWith("/api/")) return false
    if (url.pathname.includes("/auth/")) return false
    if (url.pathname === "/api/admin/backup") return false
    return true
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    try {
      const supabaseOrigin = new URL(supabaseUrl).origin
      return url.origin === supabaseOrigin && url.pathname.includes("/rest/v1/")
    } catch {
      return false
    }
  }

  return false
}

function headersToRecord(headers: Headers) {
  const record: Record<string, string> = {}
  headers.forEach((value, key) => {
    record[key] = value
  })
  return record
}

async function serializeRequest(request: Request) {
  const body = request.method.toUpperCase() === "GET" || request.method.toUpperCase() === "HEAD"
    ? undefined
    : await request.clone().text()

  if (body && body.length > 512_000) {
    throw new Error("Offline kuyruk icin veri boyutu cok buyuk.")
  }

  return {
    method: request.method,
    headers: headersToRecord(request.headers),
    body,
    credentials: request.credentials,
  }
}

async function queueRequest(request: Request) {
  const serialized = await serializeRequest(request)
  queueOfflineMutation(request.url, serialized, {
    label: request.url,
    queuedResponseBody: {
      queued: true,
      offline: true,
      message: "Islem kaydedildi. Internet geldiginde otomatik senkronize edilecek.",
    },
  })

  return new Response(JSON.stringify({
    queued: true,
    offline: true,
    message: "Islem kaydedildi. Internet geldiginde otomatik senkronize edilecek.",
  }), {
    status: 202,
    headers: {
      "Content-Type": "application/json",
      "X-Hesap-Offline-Queued": "1",
    },
  })
}

async function cacheResponse(request: Request, response: Response) {
  const contentType = response.headers.get("content-type") || ""
  if (!response.ok || !contentType.includes("json")) return

  const body = await response.clone().text().catch(() => "")
  if (!body || body.length > 1_000_000) return

  const cache = readResponseCache()
  cache[normalizeUrl(request.url)] = {
    status: response.status,
    statusText: response.statusText,
    headers: headersToRecord(response.headers),
    body,
    createdAt: new Date().toISOString(),
  }
  writeResponseCache(cache)
}

function cachedResponseFor(request: Request) {
  const cached = readResponseCache()[normalizeUrl(request.url)]
  if (!cached) return null

  return new Response(cached.body, {
    status: cached.status || 200,
    statusText: cached.statusText || "OK",
    headers: {
      ...cached.headers,
      "Content-Type": cached.headers["content-type"] || "application/json",
      "X-Hesap-Offline-Cache": "1",
    },
  })
}

export function installOfflineMutationQueue() {
  if (typeof window === "undefined" || originalFetch) return

  originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    if (shouldCacheRequest(request)) {
      if (!navigator.onLine) {
        const cached = cachedResponseFor(request)
        if (cached) return cached
      }

      try {
        const response = await originalFetch!(request.clone())
        await cacheResponse(request, response.clone())
        return response
      } catch (error) {
        const cached = cachedResponseFor(request)
        if (cached) return cached
        throw error
      }
    }

    if (!shouldQueueRequest(request)) {
      return originalFetch!(input, init)
    }

    if (!navigator.onLine) {
      return queueRequest(request)
    }

    try {
      return await originalFetch!(request.clone())
    } catch (error) {
      if (!navigator.onLine) {
        return queueRequest(request)
      }
      throw error
    }
  }
}
