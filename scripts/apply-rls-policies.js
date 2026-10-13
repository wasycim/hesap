const fs = require("fs")
const path = require("path")
const { PrismaClient } = require("@prisma/client")

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env")
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    const value = match[2].trim().replace(/^"|"$/g, "")
    if (!process.env[key]) process.env[key] = value
  }
}

async function main() {
  loadEnv()
  const prisma = new PrismaClient()
  const migrationPath = path.join(process.cwd(), "supabase", "migrations", "20260527130000_enable_rls_for_attendance_and_shifts.sql")
  const sql = fs.readFileSync(migrationPath, "utf8")
  const statements = []
  let current = ""
  let inDollarQuote = false

  for (let index = 0; index < sql.length; index += 1) {
    const pair = sql.slice(index, index + 2)
    if (pair === "$$") {
      inDollarQuote = !inDollarQuote
      current += pair
      index += 1
      continue
    }

    const char = sql[index]
    if (char === ";" && !inDollarQuote) {
      const statement = current.trim()
      if (statement) statements.push(statement)
      current = ""
      continue
    }

    current += char
  }

  if (current.trim()) statements.push(current.trim())

  try {
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement)
    }
    console.log("RLS policies applied.")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
