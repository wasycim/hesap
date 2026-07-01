import { NextRequest, NextResponse } from "next/server"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { decryptBackupFile } from "@/lib/backup/create-backup"
import { createAdminClient } from "@/lib/supabase/admin"

export const maxDuration = 120

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireDashboardAdmin()
  if (!guard.ok) return guard.response
  const { id } = await context.params
  const admin = createAdminClient()
  const { data: snapshot, error } = await admin
    .from("backup_snapshots")
    .select("id, interval, object_path, checksum_sha256")
    .eq("id", id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!snapshot?.object_path) return NextResponse.json({ error: "Yedek dosyası bulunamadı." }, { status: 404 })

  const bucket = process.env.BACKUP_STORAGE_BUCKET || "system-backups"
  const { data, error: downloadError } = await admin.storage.from(bucket).download(snapshot.object_path)
  if (downloadError) return NextResponse.json({ error: downloadError.message }, { status: 500 })

  const encrypted = Buffer.from(await data.arrayBuffer())
  const checksum = (await import("node:crypto")).createHash("sha256").update(encrypted).digest("hex")
  if (snapshot.checksum_sha256 && checksum !== snapshot.checksum_sha256) {
    return NextResponse.json({ error: "Yedek bütünlük kontrolü başarısız." }, { status: 409 })
  }

  const raw = decryptBackupFile(encrypted)
  const fileName = `hesap-${snapshot.interval || "backup"}-${new Date().toISOString().slice(0, 10)}.json`
  await admin.from("security_events").insert({
    user_id: guard.user.id,
    user_email: guard.user.email,
    event_type: "encrypted_backup_downloaded",
    details: { backup_id: id, object_path: snapshot.object_path },
  })
  return new NextResponse(new Uint8Array(raw), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  })
}

