import fs from "fs"
import path from "path"

const backupFile = path.join(process.cwd(), "backups", "supabase-full-backup-1791927397541.json")
const raw = fs.readFileSync(backupFile, "utf8")
const dump = JSON.parse(raw)

console.log("Backup loaded:", dump.exportedAt, "Tables:", Object.keys(dump.tables).length, "Rows:", Object.values(dump.counts).reduce((a, b) => a + b, 0))

// Let's create an SQL file for PostgreSQL
const sqlFile = path.join(process.cwd(), "backups", "full-database-restore.sql")
const writeStream = fs.createWriteStream(sqlFile, { encoding: "utf8" })

writeStream.write("-- HESAP FULL DATABASE RESTORE SCRIPT\n")
writeStream.write(`-- Exported at: ${dump.exportedAt}\n`)
writeStream.write("SET statement_timeout = 0;\n")
writeStream.write("SET client_encoding = 'UTF8';\n")
writeStream.write("SET standard_conforming_strings = on;\n\n")

function escapeSqlValue(val) {
  if (val === null || val === undefined) return "NULL"
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE"
  if (typeof val === "number") return String(val)
  if (typeof val === "object") {
    if (val instanceof Date) return `'${val.toISOString()}'`
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`
  }
  return `'${String(val).replace(/'/g, "''")}'`
}

for (const [table, rows] of Object.entries(dump.tables)) {
  if (!rows || rows.length === 0) continue

  writeStream.write(`-- Table: ${table} (${rows.length} rows)\n`)
  writeStream.write(`ALTER TABLE IF EXISTS "public"."${table}" DISABLE TRIGGER ALL;\n`)

  const cols = Object.keys(rows[0])
  const colNames = cols.map(c => `"${c}"`).join(", ")

  for (const row of rows) {
    const vals = cols.map(c => escapeSqlValue(row[c])).join(", ")
    writeStream.write(`INSERT INTO "public"."${table}" (${colNames}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`)
  }

  writeStream.write(`ALTER TABLE IF EXISTS "public"."${table}" ENABLE TRIGGER ALL;\n\n`)
}

writeStream.end(() => {
  const stats = fs.statSync(sqlFile)
  console.log("SQL Restore file generated:", sqlFile, `(${(stats.size / (1024 * 1024)).toFixed(2)} MB)`)
})
