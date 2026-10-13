import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { gunzipSync, gzipSync } from "node:zlib"
import { appSnapshotTables } from "@/lib/backup/tables"
import { sendBackupDeliveryEmail } from "@/lib/email/backup-delivery"
import { createAdminClient } from "@/lib/supabase/admin"

export type BackupInterval = "daily" | "weekly" | "monthly"

type BackupSettings = {
  dailyEnabled: boolean
  weeklyEnabled: boolean
  monthlyEnabled: boolean
  recipients: string[]
  attachLimitMb: number
  dailyRetention: number
  weeklyRetention: number
  monthlyRetention: number
}

export const defaultBackupSettings: BackupSettings = {
  dailyEnabled: true,
  weeklyEnabled: true,
  monthlyEnabled: true,
  recipients: [],
  attachLimitMb: 12,
  dailyRetention: 30,
  weeklyRetention: 12,
  monthlyRetention: 24,
}

export async function createAndDeliverBackup(interval: BackupInterval) {
  const admin = createAdminClient()
  const settings = await loadBackupSettings(admin)
  const enabled = interval === "daily" ? settings.dailyEnabled : interval === "weekly" ? settings.weeklyEnabled : settings.monthlyEnabled
  if (!enabled) return { ok: true, skipped: true, reason: `${interval} backup disabled` }

  const { tables, counts, skippedTables } = await collectTables(admin)
  const authUsers = await collectAuthUsers(admin)
  const exportedAt = new Date().toISOString()
  const payload = Buffer.from(JSON.stringify({
    type: "hesap-full-backup",
    version: 3,
    interval,
    exportedAt,
    skippedTables,
    counts,
    authUsers,
    tables,
  }))
  const compressed = gzipSync(payload, { level: 9 })
  const encrypted = encryptBackup(compressed)
  const checksum = createHash("sha256").update(encrypted).digest("hex")
  const fileName = `hesap-${interval}-${exportedAt.replace(/[:.]/g, "-")}.json.gz.enc`
  const objectPath = `${interval}/${fileName}`
  const bucket = process.env.BACKUP_STORAGE_BUCKET || "system-backups"

  await ensurePrivateBucket(admin, bucket)
  const { error: uploadError } = await admin.storage.from(bucket).upload(objectPath, encrypted, {
    contentType: "application/octet-stream",
    cacheControl: "0",
    upsert: false,
  })
  if (uploadError) throw new Error(`Yedek depoya yüklenemedi: ${uploadError.message}`)

  const rowCount = Object.values(counts).reduce((sum, count) => sum + Math.max(0, count), 0) + authUsers.length
  const { data: snapshot, error: snapshotError } = await admin.from("backup_snapshots").insert({
    title: `${intervalLabel(interval)} otomatik tam yedek - ${exportedAt.slice(0, 10)}`,
    interval,
    tables: interval === "daily" ? tables : {},
    table_counts: { ...counts, auth_users: authUsers.length },
    object_path: objectPath,
    size_bytes: encrypted.length,
    checksum_sha256: checksum,
    recipients: settings.recipients,
    encrypted: true,
    status: "completed",
    completed_at: new Date().toISOString(),
  }).select("id").single()
  if (snapshotError) {
    await admin.storage.from(bucket).remove([objectPath])
    throw new Error(`Yedek kaydı oluşturulamadı: ${snapshotError.message}`)
  }

  let deliveryError: string | null = null
  if (settings.recipients.length) {
    const attachLimit = settings.attachLimitMb * 1024 * 1024
    let downloadUrl: string | undefined
    if (encrypted.length > attachLimit) {
      const { data, error } = await admin.storage.from(bucket).createSignedUrl(objectPath, 7 * 24 * 60 * 60)
      if (error) deliveryError = error.message
      else downloadUrl = data.signedUrl
    }

    if (!deliveryError) {
      try {
        await sendBackupDeliveryEmail({
          recipients: settings.recipients,
          interval,
          fileName,
          file: encrypted.length <= attachLimit ? encrypted : undefined,
          downloadUrl,
          checksum,
          tableCount: Object.keys(tables).length,
          rowCount,
        })
      } catch (error) {
        deliveryError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  if (deliveryError) {
    await admin.from("backup_snapshots").update({ status: "delivery_failed", error_message: deliveryError }).eq("id", snapshot.id)
  }

  await applyRetention(admin, bucket, interval, retentionFor(settings, interval))
  await admin.from("security_events").insert({
    event_type: "scheduled_backup_created",
    details: { interval, object_path: objectPath, size_bytes: encrypted.length, checksum, skipped_tables: skippedTables, delivery_error: deliveryError },
  })

  if (deliveryError) throw new Error(`Yedek oluşturuldu ancak e-posta gönderilemedi: ${deliveryError}`)
  return { ok: true, interval, objectPath, sizeBytes: encrypted.length, checksum, counts, authUserCount: authUsers.length, skippedTables, recipients: settings.recipients.length }
}

async function collectTables(admin: ReturnType<typeof createAdminClient>) {
  const tables: Record<string, unknown[]> = {}
  const counts: Record<string, number> = {}
  const skippedTables: string[] = []
  const queue = [...appSnapshotTables]

  async function worker() {
    while (queue.length) {
      const table = queue.shift()
      if (!table) return
      try {
        const rows = await collectTable(admin, table)
        tables[table] = rows
        counts[table] = rows.length
      } catch (error) {
        if (isMissingTableError(error)) {
          skippedTables.push(table)
          counts[table] = -1
        } else throw error
      }
    }
  }

  await Promise.all(Array.from({ length: 4 }, () => worker()))
  return { tables, counts, skippedTables }
}

async function collectTable(admin: ReturnType<typeof createAdminClient>, table: string) {
  const rows: unknown[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin.from(table).select("*").range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
  }
}

async function collectAuthUsers(admin: ReturnType<typeof createAdminClient>) {
  const users: unknown[] = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 1000) return users
  }
}

function encryptBackup(compressed: Buffer) {
  const key = backupEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()])
  return Buffer.concat([Buffer.from("HESAPBK1"), iv, cipher.getAuthTag(), ciphertext])
}

export function decryptBackupFile(file: Buffer) {
  if (file.length < 37 || file.subarray(0, 8).toString("utf8") !== "HESAPBK1") throw new Error("Yedek dosyası biçimi geçersiz.")
  const iv = file.subarray(8, 20)
  const tag = file.subarray(20, 36)
  const ciphertext = file.subarray(36)
  const decipher = createDecipheriv("aes-256-gcm", backupEncryptionKey(), iv)
  decipher.setAuthTag(tag)
  return gunzipSync(Buffer.concat([decipher.update(ciphertext), decipher.final()]))
}

function backupEncryptionKey() {
  const configured = process.env.BACKUP_ENCRYPTION_KEY
  if (!configured) throw new Error("BACKUP_ENCRYPTION_KEY yapılandırılmamış.")
  const decoded = Buffer.from(configured, "base64")
  return decoded.length === 32 ? decoded : createHash("sha256").update(configured).digest()
}

async function ensurePrivateBucket(admin: ReturnType<typeof createAdminClient>, bucket: string) {
  const { data, error } = await admin.storage.getBucket(bucket)
  if (data) return
  if (error && !/not found/i.test(error.message)) throw error
  const { error: createError } = await admin.storage.createBucket(bucket, { public: false, fileSizeLimit: 50 * 1024 * 1024 })
  if (createError && !/already exists/i.test(createError.message)) throw createError
}

async function loadBackupSettings(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin.from("app_settings").select("value").eq("key", "backup_delivery").maybeSingle()
  if (error) throw error
  return sanitizeBackupSettings(data?.value)
}

export function sanitizeBackupSettings(input: any): BackupSettings {
  const emails = Array.isArray(input?.recipients) ? input.recipients : []
  return {
    dailyEnabled: input?.dailyEnabled !== false,
    weeklyEnabled: input?.weeklyEnabled !== false,
    monthlyEnabled: input?.monthlyEnabled !== false,
    recipients: Array.from(new Set(emails.map((item: unknown) => String(item).trim().toLowerCase()).filter((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))).slice(0, 20) as string[],
    attachLimitMb: clamp(input?.attachLimitMb, 1, 18, 12),
    dailyRetention: clamp(input?.dailyRetention, 7, 365, 30),
    weeklyRetention: clamp(input?.weeklyRetention, 4, 104, 12),
    monthlyRetention: clamp(input?.monthlyRetention, 6, 120, 24),
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value)
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback
}

function retentionFor(settings: BackupSettings, interval: BackupInterval) {
  return interval === "daily" ? settings.dailyRetention : interval === "weekly" ? settings.weeklyRetention : settings.monthlyRetention
}

async function applyRetention(admin: ReturnType<typeof createAdminClient>, bucket: string, interval: BackupInterval, keep: number) {
  const { data, error } = await admin.storage.from(bucket).list(interval, { limit: 1000, sortBy: { column: "name", order: "desc" } })
  if (error) throw error
  const expired = (data || []).filter((item) => item.name.endsWith(".enc")).slice(keep).map((item) => `${interval}/${item.name}`)
  if (expired.length) {
    await admin.storage.from(bucket).remove(expired)
    await admin.from("backup_snapshots").delete().in("object_path", expired)
  }
}

function isMissingTableError(error: unknown) {
  const text = String((error as { message?: string })?.message || error).toLowerCase()
  return text.includes("does not exist") || text.includes("schema cache") || text.includes("could not find the table")
}

function intervalLabel(interval: BackupInterval) {
  return interval === "daily" ? "Günlük" : interval === "weekly" ? "Haftalık" : "Aylık"
}
