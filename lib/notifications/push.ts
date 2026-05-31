import crypto from "crypto"
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

export function hashPushToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
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

export async function deliverPushToUserDevices(admin: any, input: DeliverToUserInput) {
  const { data: devices, error: deviceError } = await admin
    .from("user_devices")
    .select("id, user_id, platform, push_token")
    .eq("user_id", input.userId)
    .eq("enabled", true)
    .not("push_token", "is", null)

  if (deviceError) throw new Error(deviceError.message)

  const targetDevices = ((devices || []) as UserDeviceRow[]).filter((device) => String(device.push_token || "").trim())
  if (!targetDevices.length) {
    await admin
      .from("app_notifications")
      .update({ push_status: "skipped", push_error: "Kayıtlı push token bulunamadı." })
      .eq("id", input.notificationId)
    return { sent: 0, failed: 0, skipped: 0, deviceCount: 0, configured: getPushProviderStatus().configured, missing: getPushProviderStatus().missing }
  }

  const providerStatus = getPushProviderStatus()
  const deliveryRows = []
  const results: PushDeliveryResult[] = []

  for (const device of targetDevices) {
    const result = providerStatus.configured
      ? await sendPushNotificationToToken({
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
          error: `FCM ayarları eksik: ${providerStatus.missing.join(", ")}`,
        }

    results.push(result)
    deliveryRows.push({
      notification_id: input.notificationId,
      user_id: input.userId,
      device_id: device.id,
      provider: "fcm",
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
    configured: providerStatus.configured,
    missing: providerStatus.missing,
  }
}
