import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ announcements: [] })

  const { data, error } = await supabase
    .from("app_announcements")
    .select("id, title, body, level, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(5)

  if (error) return NextResponse.json({ announcements: [] })
  return NextResponse.json({ announcements: data || [] })
}
