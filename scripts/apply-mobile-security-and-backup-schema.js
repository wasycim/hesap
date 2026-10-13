const fs = require("fs")
const path = require("path")
const { PrismaClient } = require("@prisma/client")

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

process.env.DATABASE_URL ||= process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || ""
process.env.DIRECT_URL ||= process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL || ""

function splitSql(sql) {
  const statements = []
  let current = ""
  let dollarQuoted = false
  for (let index = 0; index < sql.length; index += 1) {
    const pair = sql.slice(index, index + 2)
    if (pair === "$$") {
      dollarQuoted = !dollarQuoted
      current += pair
      index += 1
    } else if (sql[index] === ";" && !dollarQuoted) {
      if (current.trim()) statements.push(current.trim())
      current = ""
    } else current += sql[index]
  }
  if (current.trim()) statements.push(current.trim())
  return statements
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const sql = fs.readFileSync(path.join(process.cwd(), "scripts", "021_mobile_security_and_backup.sql"), "utf8")
    for (const statement of splitSql(sql)) await prisma.$executeRawUnsafe(statement)
    console.log("Mobile security and backup schema applied.")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => { console.error(error); process.exit(1) })

