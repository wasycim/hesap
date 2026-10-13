import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getUserAgent } from "@/lib/system/client-info"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const body = await request.json().catch(() => ({}))
  const message = String(body.message || "").trim().slice(0, 1000)
  if (!message) return NextResponse.json({ error: "Hata mesaji zorunlu." }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from("error_reports").insert({
    user_id: user?.id || null,
    path: String(body.path || "").slice(0, 500),
    message,
    stack: String(body.stack || "").slice(0, 8000),
    component_stack: String(body.componentStack || "").slice(0, 8000),
    user_agent: getUserAgent(request),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
