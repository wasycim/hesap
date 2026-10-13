import { NextRequest, NextResponse } from "next/server"
import { createAndDeliverBackup } from "@/lib/backup/create-backup"

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || request.nextUrl.searchParams.get("secret")
  if (!secret && process.env.NODE_ENV === "production") return NextResponse.json({ error: "CRON_SECRET yapılandırılmamış." }, { status: 503 })
  if (secret && provided !== secret) return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 401 })
  try {
    return NextResponse.json(await createAndDeliverBackup("daily"))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
