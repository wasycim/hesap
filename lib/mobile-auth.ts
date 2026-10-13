import "server-only"

import type { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function getRequestAuthUser(request: NextRequest) {
  const authorization = request.headers.get("authorization") || ""
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i)
  const accessToken = bearerMatch?.[1]?.trim()

  if (accessToken) {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.getUser(accessToken)
    if (!error && data.user) return data.user
    return null
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}
