import { NextRequest, NextResponse } from "next/server"
import { createAndDeliverBackup, type BackupInterval } from "@/lib/backup/create-backup"

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || request.nextUrl.searchParams.get("secret")
  if (!secret && process.env.NODE_ENV === "production") return NextResponse.json({ error: "CRON_SECRET yapılandırılmamış." }, { status: 503 })
  if (secret && provided !== secret) return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 401 })

  const value = request.nextUrl.searchParams.get("interval")
  if (!isInterval(value)) return NextResponse.json({ error: "Geçersiz yedek aralığı." }, { status: 400 })
  try {
    return NextResponse.json(await createAndDeliverBackup(value))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

function isInterval(value: string | null): value is BackupInterval {
  return value === "daily" || value === "weekly" || value === "monthly"
}

