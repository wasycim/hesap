const fs = require("fs")
const path = require("path")
const { PrismaClient } = require("@prisma/client")

function loadEnvFile(fileName) {
  const envPath = path.join(process.cwd(), fileName)
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    const value = match[2].trim().replace(/^"|"$/g, "")
    if (!process.env[key] && value) process.env[key] = value
  }
}

function splitSql(sql) {
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
  return statements
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || ""
  }
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL || ""
  }

  const prisma = new PrismaClient()
  const sql = fs.readFileSync(path.join(process.cwd(), "scripts", "016_push_and_advanced_logs.sql"), "utf8")

  try {
    for (const statement of splitSql(sql)) {
      await prisma.$executeRawUnsafe(statement)
    }
    console.log("Push and advanced log schema applied.")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
