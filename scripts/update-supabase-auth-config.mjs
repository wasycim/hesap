import fs from "node:fs"
import path from "node:path"

const appUrl = "https://pamukkaleturizm.info"
const recoveryTemplatePath = path.join(process.cwd(), "docs", "supabase-password-reset-email.html")

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/)
    if (!match || process.env[match[1]]) continue

    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[match[1]] = value
  }
}

function projectRefFromEnv() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF

  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!rawUrl) return null

  try {
    return new URL(rawUrl).hostname.split(".")[0]
  } catch {
    return null
  }
}

function normalizeAllowList(value) {
  if (Array.isArray(value)) return value
  if (typeof value === "string") return value.split(",").map(item => item.trim()).filter(Boolean)
  return []
}

async function requestJson(url, options) {
  const response = await fetch(url, options)
  const text = await response.text()
  const body = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message = body?.message || body?.error || text || response.statusText
    throw new Error(`${response.status} ${message}`)
  }

  return body
}

loadDotEnv(path.join(process.cwd(), ".env.local"))
loadDotEnv(path.join(process.cwd(), ".env"))

const token = process.env.SUPABASE_ACCESS_TOKEN
const projectRef = projectRefFromEnv()

if (!token) {
  throw new Error("SUPABASE_ACCESS_TOKEN yok. Supabase Dashboard > Account > Access Tokens ekranından PAT oluşturup bu değişkenle çalıştır.")
}

if (!projectRef) {
  throw new Error("SUPABASE_PROJECT_REF veya SUPABASE_URL bulunamadı.")
}

const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
}

const currentConfig = await requestJson(apiUrl, { headers })
const existingAllowList = normalizeAllowList(currentConfig.uri_allow_list)
const requiredRedirects = [
  `${appUrl}/auth/callback`,
  `${appUrl}/auth/sifre-sifirla`,
  `${appUrl}/**`,
]
const mergedAllowList = Array.from(new Set([...existingAllowList, ...requiredRedirects]))
const uriAllowList = Array.isArray(currentConfig.uri_allow_list) ? mergedAllowList : mergedAllowList.join(",")

await requestJson(apiUrl, {
  method: "PATCH",
  headers,
  body: JSON.stringify({
    site_url: appUrl,
    uri_allow_list: uriAllowList,
    mailer_subjects_recovery: "Hesap şifreni yenile",
    mailer_templates_recovery_content: fs.readFileSync(recoveryTemplatePath, "utf8"),
  }),
})

console.log(`Supabase Auth ayarları güncellendi: ${projectRef}`)
console.log(`Site URL: ${appUrl}`)
console.log("Reset mail şablonu production callback ve token_hash akışına alındı.")
