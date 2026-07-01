const fs = require("fs")
const path = require("path")
const { createClient } = require("@supabase/supabase-js")

for (const file of [".env", ".env.local"]) {
  const target = path.join(process.cwd(), file)
  if (!fs.existsSync(target)) continue
  for (const line of fs.readFileSync(target, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    const value = match[2].trim().replace(/^"|"$/g, "")
    if (!process.env[key] && value) process.env[key] = value
  }
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error("Supabase yönetici ayarları eksik.")
  const admin = createClient(url, key, { auth: { persistSession: false } })
  const bucket = process.env.BACKUP_STORAGE_BUCKET || "system-backups"
  const { data, error } = await admin.storage.getBucket(bucket)
  if (data) return console.log(`Private backup bucket ready: ${bucket}`)
  if (error && !/not found/i.test(error.message)) throw error
  const { error: createError } = await admin.storage.createBucket(bucket, { public: false, fileSizeLimit: 50 * 1024 * 1024 })
  if (createError && !/already exists/i.test(createError.message)) throw createError
  console.log(`Private backup bucket created: ${bucket}`)
}

main().catch((error) => { console.error(error); process.exit(1) })
