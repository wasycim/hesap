import { Client } from "pg"
import fs from "fs"
import path from "path"

const connectionString = "postgres://postgres.jchicxqyguywutnstwhu:wK33fJwtaW8XDaJN@aws-1-us-east-1.pooler.supabase.com:5432/postgres"

async function fullDump() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })

  await client.connect()
  console.log("Connected to Supabase PostgreSQL.")

  const tablesQuery = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)
  const tables = tablesQuery.rows.map(r => r.table_name)
  console.log(`Found ${tables.length} base tables in public schema.`)

  const dump = {
    exportedAt: new Date().toISOString(),
    database: "postgres",
    tables: {},
    authUsers: [],
    counts: {}
  }

  // Dump auth.users
  try {
    const authRes = await client.query(`SELECT * FROM auth.users`)
    dump.authUsers = authRes.rows
    dump.counts["auth.users"] = authRes.rows.length
    console.log(`Exported auth.users: ${authRes.rows.length} rows`)
  } catch (err) {
    console.warn("Could not dump auth.users directly:", err.message)
  }

  // Dump all public base tables
  for (const table of tables) {
    try {
      if (table === "backup_snapshots") {
        const res = await client.query(`SELECT id, title, interval, created_at, checksum, table_counts FROM "public"."backup_snapshots" ORDER BY id DESC`)
        dump.tables[table] = res.rows
        dump.counts[table] = res.rows.length
        console.log(`Exported public.backup_snapshots (metadata): ${res.rows.length} rows`)
      } else {
        const res = await client.query(`SELECT * FROM "public"."${table}"`)
        dump.tables[table] = res.rows
        dump.counts[table] = res.rows.length
        console.log(`Exported public.${table}: ${res.rows.length} rows`)
      }
    } catch (err) {
      console.error(`Failed to export public.${table}:`, err.message)
    }
  }

  await client.end()

  const backupDir = path.join(process.cwd(), "backups")
  fs.mkdirSync(backupDir, { recursive: true })

  const filename = `supabase-full-backup-${Date.now()}.json`
  const filePath = path.join(backupDir, filename)
  fs.writeFileSync(filePath, JSON.stringify(dump, null, 2), "utf8")

  const stats = fs.statSync(filePath)
  console.log(`\n========================================`)
  console.log(`FULL BACKUP SAVED SUCCESSFULLY!`)
  console.log(`File: ${filePath}`)
  console.log(`Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB (${stats.size} bytes)`)
  console.log(`Total Tables: ${Object.keys(dump.tables).length}`)
  console.log(`Total Rows: ${Object.values(dump.counts).reduce((a, b) => a + b, 0)}`)
  console.log(`========================================\n`)
}

fullDump().catch(console.error)
