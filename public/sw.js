const CACHE_NAME = "hesap-shell-v5"
const API_CACHE_NAME = "hesap-api-v3"
const SHELL_URLS = [
  "/offline.html",
  "/auth/giris",
  "/dashboard",
  "/dashboard/gelir",
  "/dashboard/mesai",
  "/dashboard/mesai-takip",
  "/dashboard/vardiya",
  "/dashboard/hesap",
  "/manifest.webmanifest",
  "/iconw.png",
  "/icon.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => ![CACHE_NAME, API_CACHE_NAME].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

function isSameOriginApi(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/api/") && !url.pathname.includes("/auth/")
}

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined)
          return response
        })
        .catch(async () => {
          return (await caches.match(request)) || (await caches.match("/dashboard")) || (await caches.match("/offline.html"))
        }),
    )
    return
  }

  if (isSameOriginApi(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(API_CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined)
          }
          return response
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            new Response(JSON.stringify({ offline: true, cached: false, items: [], data: null }), {
              status: 200,
              headers: { "Content-Type": "application/json", "X-Hesap-Offline": "1" },
            })
          )
        }),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined)
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
