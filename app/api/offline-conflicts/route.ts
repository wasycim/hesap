import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const admin = createAdminClient()
  const { error } = await admin.from("offline_conflicts").insert({
    user_id: user.id,
    mutation_path: String(body.mutation_path || "").slice(0, 500),
    client_payload: body.client_payload && typeof body.client_payload === "object" ? body.client_payload : {},
    server_payload: body.server_payload && typeof body.server_payload === "object" ? body.server_payload : {},
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
