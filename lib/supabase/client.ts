import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

function isAuthLockError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "")
  return message.includes("Lock broken") || message.includes("was released because another request stole it")
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function withSerializedGetUser(client: ReturnType<typeof createBrowserClient>) {
  const auth = client.auth as typeof client.auth & { __serializedGetUser?: boolean }
  if (auth.__serializedGetUser) return client

  const originalGetUser = auth.getUser.bind(auth)
  let pendingGetUser: ReturnType<typeof originalGetUser> | null = null

  auth.getUser = ((...args: Parameters<typeof originalGetUser>) => {
    if (args.length > 0) return originalGetUser(...args)

    if (!pendingGetUser) {
      pendingGetUser = (async () => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            return await originalGetUser()
          } catch (error) {
            if (!isAuthLockError(error) || attempt === 2) throw error
            await sleep(120)
          }
        }

        return originalGetUser()
      })().finally(() => {
        pendingGetUser = null
      }) as ReturnType<typeof originalGetUser>
    }

    return pendingGetUser
  }) as typeof auth.getUser

  auth.__serializedGetUser = true
  return client
}

export function createClient() {
  if (!browserClient) {
    browserClient = withSerializedGetUser(createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ))
  }

  return browserClient
}
