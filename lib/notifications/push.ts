import crypto from "crypto"
import http2 from "http2"
import jwt from "jsonwebtoken"

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
const FCM_TOKEN_URL = "https://oauth2.googleapis.com/token"

export type PushDeliveryStatus = "sent" | "failed" | "skipped"

export type PushDeliveryResult = {
  ok: boolean
  status: PushDeliveryStatus
  error?: string
  response?: unknown
  statusCode?: number
}

type PushInput = {
  token: string
  title: string
  body: string
  href?: string
  notificationId?: string
  level?: "info" | "success" | "warning" | "error"
}

type UserDeviceRow = {
  id: string
  user_id: string
  platform: string | null
  push_token: string | null
}

type DeliverToUserInput = {
  userId: string
  notificationId: string
  title: string
  body: string
  href?: string
  level?: "info" | "success" | "warning" | "error"
}

function normalizePrivateKey(value?: string) {
  return String(value || "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n")
    .trim()
}

export function getPushProviderStatus() {
  const required = {
    FCM_PROJECT_ID: process.env.FCM_PROJECT_ID,
    FCM_CLIENT_EMAIL: process.env.FCM_CLIENT_EMAIL,
    FCM_PRIVATE_KEY: normalizePrivateKey(process.env.FCM_PRIVATE_KEY),
  }
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  return {
    provider: "fcm",
    configured: missing.length === 0,
    missing,
  }
}

export function getApnsProviderStatus(): ProviderStatus {
  const required = {
    APNS_KEY_ID: process.env.APNS_KEY_ID,
    APNS_TEAM_ID: process.env.APNS_TEAM_ID,
    APNS_PRIVATE_KEY: normalizePrivateKey(process.env.APNS_PRIVATE_KEY),
    APNS_BUNDLE_ID: process.env.APNS_BUNDLE_ID || process.env.NEXT_PUBLIC_APP_BUNDLE_ID || "wasy.system.hesap",
  }
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  return {
    provider: "apns",
    configured: missing.length === 0,
    missing,
  }
}

export function hashPushToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

type ProviderStatus = {
  provider: string
  configured: boolean
  missing: string[]
}

function isUnregisteredFcmResult(result: PushDeliveryResult) {
  const payload = result.response as any
  const details = Array.isArray(payload?.error?.details) ? payload.error.details : []
  return (
    result.statusCode === 404 ||
    payload?.error?.status === "NOT_FOUND" ||
    details.some((detail: any) => detail?.errorCode === "UNREGISTERED")
  )
}

function isUnregisteredApnsResult(result: PushDeliveryResult) {
  const payload = result.response as any
  return result.statusCode === 410 || payload?.reason === "Unregistered" || payload?.reason === "BadDeviceToken"
}

function isIosDevice(platform: string | null) {
  return String(platform || "").toLowerCase() === "ios"
}

async function getFcmAccessToken() {
  const status = getPushProviderStatus()
  if (!status.configured) {
    throw new Error(`Eksik FCM ayarları: ${status.missing.join(", ")}`)
  }

  const now = Math.floor(Date.now() / 1000)
  const assertion = jwt.sign(
    {
      iss: process.env.FCM_CLIENT_EMAIL,
      scope: FCM_SCOPE,
      aud: FCM_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    normalizePrivateKey(process.env.FCM_PRIVATE_KEY),
    { algorithm: "RS256" },
  )

  const response = await fetch(FCM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || "FCM erişim tokeni alınamadı.")
  }

  return String(payload.access_token)
}

export async function sendPushNotificationToToken(input: PushInput): Promise<PushDeliveryResult> {
  const provider = getPushProviderStatus()
  if (!provider.configured) {
    return {
      ok: false,
      status: "skipped",
      error: `FCM ayarları eksik: ${provider.missing.join(", ")}`,
    }
  }

  if (!input.token.trim()) {
    return { ok: false, status: "skipped", error: "Push token boş." }
  }

  try {
    const accessToken = await getFcmAccessToken()
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${process.env.FCM_PROJECT_ID}/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: input.token,
          notification: {
            title: input.title,
            body: input.body,
          },
          data: {
            href: input.href || "/dashboard",
            notificationId: input.notificationId || "",
            level: input.level || "info",
          },
          android: {
            priority: "HIGH",
            notification: {
              sound: "default",
              channel_id: "hesap_alerts",
            },
          },
          apns: {
            headers: {
              "apns-priority": "10",
            },
            payload: {
              aps: {
                sound: "default",
              },
            },
          },
        },
      }),
    })

    const text = await response.text()
    const payload = text ? JSON.parse(text) : null
    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        statusCode: response.status,
        response: payload,
        error: payload?.error?.message || "FCM push gönderimi başarısız.",
      }
    }

    return { ok: true, status: "sent", statusCode: response.status, response: payload }
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      error: error instanceof Error ? error.message : "Push gönderimi başarısız.",
    }
  }
}

function getApnsJwt() {
  return jwt.sign(
    {
      iss: process.env.APNS_TEAM_ID,
      iat: Math.floor(Date.now() / 1000),
    },
    normalizePrivateKey(process.env.APNS_PRIVATE_KEY),
    {
      algorithm: "ES256",
      header: {
        alg: "ES256",
        kid: process.env.APNS_KEY_ID,
      },
      expiresIn: "50m",
    },
  )
}

function isApnsProduction() {
  return String(process.env.APNS_ENV || "production").toLowerCase() !== "sandbox"
}

type ApnsEnvironment = "production" | "sandbox"

function getApnsOrigin(environment: ApnsEnvironment) {
  return environment === "production" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com"
}

function getApnsEnvironmentFromConfig(): ApnsEnvironment {
  return isApnsProduction() ? "production" : "sandbox"
}

function getAlternateApnsEnvironment(environment: ApnsEnvironment): ApnsEnvironment {
  return environment === "production" ? "sandbox" : "production"
}

function isApnsEnvironmentMismatch(result: PushDeliveryResult) {
  const payload = result.response as any
  return payload?.reason === "BadEnvironmentKeyInToken" || payload?.primary_response?.reason === "BadEnvironmentKeyInToken"
}

export async function sendApnsNotificationToToken(input: PushInput): Promise<PushDeliveryResult> {
  const provider = getApnsProviderStatus()
  if (!provider.configured) {
    return {
      ok: false,
      status: "skipped",
      error: `APNs ayarları eksik: ${provider.missing.join(", ")}`,
    }
  }

  const deviceToken = input.token.replace(/\s/g, "")
  if (!deviceToken) {
    return { ok: false, status: "skipped", error: "APNs token boş." }
  }

  const primaryEnvironment = getApnsEnvironmentFromConfig()
  const primaryResult = await sendApnsRequest(input, deviceToken, primaryEnvironment)
  if (!isApnsEnvironmentMismatch(primaryResult)) return primaryResult

  const fallbackEnvironment = getAlternateApnsEnvironment(primaryEnvironment)
  const fallbackResult = await sendApnsRequest(input, deviceToken, fallbackEnvironment)
  if (fallbackResult.ok) {
    return {
      ...fallbackResult,
      response: {
        delivered_via: fallbackEnvironment,
        retried_after: primaryEnvironment,
        primary_response: primaryResult.response || null,
        fallback_response: fallbackResult.response || null,
      },
    }
  }

  return {
    ...fallbackResult,
    error: fallbackResult.error || primaryResult.error,
    response: {
      primary_environment: primaryEnvironment,
      fallback_environment: fallbackEnvironment,
      primary_response: primaryResult.response || null,
      fallback_response: fallbackResult.response || null,
    },
  }
}

function sendApnsRequest(input: PushInput, deviceToken: string, environment: ApnsEnvironment): Promise<PushDeliveryResult> {
  const origin = getApnsOrigin(environment)
  const topic = process.env.APNS_BUNDLE_ID || process.env.NEXT_PUBLIC_APP_BUNDLE_ID || "wasy.system.hesap"
  const payload = JSON.stringify({
    aps: {
      alert: {
        title: input.title,
        body: input.body,
      },
      sound: "default",
      badge: 1,
      "thread-id": "hesap",
    },
    href: input.href || "/dashboard",
    notificationId: input.notificationId || "",
    level: input.level || "info",
  })

  return new Promise((resolve) => {
    const client = http2.connect(origin)
    let settled = false
    let statusCode = 0
    let responseBody = ""
    let timeout: NodeJS.Timeout | null = null

    const finish = (result: PushDeliveryResult) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      client.close()
      resolve(result)
    }

    client.on("error", (error) => {
      finish({
        ok: false,
        status: "failed",
        error: error instanceof Error ? error.message : "APNs bağlantısı başarısız.",
      })
    })

    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${getApnsJwt()}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    })

    timeout = setTimeout(() => {
      request.close()
      finish({
        ok: false,
        status: "failed",
        response: { environment },
        error: "APNs istegi zaman asimina ugradi.",
      })
    }, 10_000)

    request.setEncoding("utf8")
    request.on("response", (headers) => {
      statusCode = Number(headers[":status"] || 0)
    })
    request.on("data", (chunk) => {
      responseBody += chunk
    })
    request.on("error", (error) => {
      finish({
        ok: false,
        status: "failed",
        error: error instanceof Error ? error.message : "APNs bildirimi gönderilemedi.",
      })
    })
    request.on("end", () => {
      const response = responseBody ? safeJsonParse(responseBody) : null
      if (statusCode >= 200 && statusCode < 300) {
        finish({ ok: true, status: "sent", statusCode, response: { environment, response } })
        return
      }

      finish({
        ok: false,
        status: "failed",
        statusCode,
        response: { environment, ...(response || {}) },
        error: response?.reason || `APNs push gönderimi başarısız (${statusCode}).`,
      })
    })
    request.end(payload)
  })
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return { raw: value }
  }
}

async function sendNativePushNotification(provider: "apns" | "fcm", input: PushInput) {
  return provider === "apns" ? sendApnsNotificationToToken(input) : sendPushNotificationToToken(input)
}

export async function deliverPushToUserDevices(admin: any, input: DeliverToUserInput) {
  const { data: devices, error: deviceError } = await admin
    .from("user_devices")
    .select("id, user_id, platform, push_token")
    .eq("user_id", input.userId)
    .eq("enabled", true)
    .not("push_token", "is", null)

  if (deviceError) throw new Error(deviceError.message)

  const targetDevices = ((devices || []) as UserDeviceRow[]).filter((device) => String(device.push_token || "").trim())
  const fcmProviderStatus = getPushProviderStatus()
  const apnsProviderStatus = getApnsProviderStatus()
  if (!targetDevices.length) {
    await admin
      .from("app_notifications")
      .update({ push_status: "skipped", push_error: "Kayıtlı push token bulunamadı." })
      .eq("id", input.notificationId)
    return {
      sent: 0,
      failed: 0,
      skipped: 0,
      deviceCount: 0,
      configured: fcmProviderStatus.configured || apnsProviderStatus.configured,
      missing: [...fcmProviderStatus.missing, ...apnsProviderStatus.missing],
    }
  }

  const deliveryRows = []
  const results: PushDeliveryResult[] = []

  for (const device of targetDevices) {
    const provider = isIosDevice(device.platform) ? "apns" : "fcm"
    const activeProviderStatus = provider === "apns" ? apnsProviderStatus : fcmProviderStatus
    let result: PushDeliveryResult
    try {
      result = activeProviderStatus.configured
        ? await sendNativePushNotification(provider, {
            token: String(device.push_token),
            title: input.title,
            body: input.body,
            href: input.href,
            notificationId: input.notificationId,
            level: input.level,
          })
        : {
            ok: false,
            status: "skipped" as const,
            error: `${provider.toUpperCase()} ayarları eksik: ${activeProviderStatus.missing.join(", ")}`,
          }
    } catch (error) {
      result = {
        ok: false,
        status: "failed",
        error: error instanceof Error ? error.message : `${provider.toUpperCase()} push gonderimi tamamlanamadi.`,
      }
    }

    results.push(result)
    if ((provider === "apns" && isUnregisteredApnsResult(result)) || (provider === "fcm" && isUnregisteredFcmResult(result))) {
      await admin
        .from("user_devices")
        .update({
          push_token: null,
          enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", device.id)
    }
    deliveryRows.push({
      notification_id: input.notificationId,
      user_id: input.userId,
      device_id: device.id,
      provider,
      status: result.status,
      title: input.title,
      href: input.href || "/dashboard",
      token_hash: hashPushToken(String(device.push_token)),
      response: result.response || null,
      error: result.error || null,
    })
  }

  if (deliveryRows.length) {
    await admin.from("push_delivery_logs").insert(deliveryRows)
  }

  const sent = results.filter((result) => result.status === "sent").length
  const failed = results.filter((result) => result.status === "failed").length
  const skipped = results.filter((result) => result.status === "skipped").length
  const pushStatus = sent === targetDevices.length ? "sent" : sent > 0 ? "partial" : skipped > 0 && failed === 0 ? "skipped" : "failed"

  await admin
    .from("app_notifications")
    .update({
      push_status: pushStatus,
      push_sent_at: sent > 0 ? new Date().toISOString() : null,
      push_error: results.find((result) => result.error)?.error || null,
    })
    .eq("id", input.notificationId)

  return {
    sent,
    failed,
    skipped,
    deviceCount: targetDevices.length,
    configured: fcmProviderStatus.configured || apnsProviderStatus.configured,
    missing: [...fcmProviderStatus.missing, ...apnsProviderStatus.missing],
  }
}
