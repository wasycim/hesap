type OfflineJob = {
  id: string
  url: string
  init: {
    method?: string
    headers?: Record<string, string>
    body?: string
  }
  createdAt: string
}

const storageKey = "hesap_offline_queue"

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
  window.localStorage.setItem(storageKey, JSON.stringify(jobs.slice(-100)))
  window.dispatchEvent(new CustomEvent("hesap-offline-queue-change", { detail: { count: jobs.length } }))
}

export function queueOfflineMutation(url: string, init: OfflineJob["init"]) {
  const jobs = readQueue()
  jobs.push({
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    url,
    init,
    createdAt: new Date().toISOString(),
  })
  writeQueue(jobs)
}

export function getOfflineQueueCount() {
  return readQueue().length
}

export async function flushOfflineMutations() {
  const jobs = readQueue()
  if (jobs.length === 0) return { synced: 0, remaining: 0 }

  const remaining: OfflineJob[] = []
  let synced = 0

  for (const job of jobs) {
    try {
      const response = await fetch(job.url, job.init)
      if (response.ok) {
        synced += 1
      } else {
        remaining.push(job)
      }
    } catch {
      remaining.push(job)
    }
  }

  writeQueue(remaining)
  return { synced, remaining: remaining.length }
}
