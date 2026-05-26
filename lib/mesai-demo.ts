export type MesaiEmployee = {
  id: string
  name: string
  role: string
  tcKimlik: string
  password: string
  qrCode: string
}

export type MesaiQrPayload = {
  type: "mesai-qr"
  employeeId: string
  issuedAt: number
  nonce: string
}

export const mesaiDemoEmployees: MesaiEmployee[] = [
  {
    id: "EMP-001",
    name: "Ayşe Yılmaz",
    role: "Kasiyer",
    tcKimlik: "10000000146",
    password: "123456",
    qrCode: "MESAI-EMP-001",
  },
  {
    id: "EMP-002",
    name: "Mehmet Demir",
    role: "Kurye",
    tcKimlik: "10000000154",
    password: "123456",
    qrCode: "MESAI-EMP-002",
  },
  {
    id: "EMP-003",
    name: "Elif Kaya",
    role: "Mutfak",
    tcKimlik: "10000000162",
    password: "123456",
    qrCode: "MESAI-EMP-003",
  },
]

function encodeBase64Url(value: string) {
  return btoa(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  return atob(padded)
}

export function createMesaiQrToken(employeeId: string) {
  const payload: MesaiQrPayload = {
    type: "mesai-qr",
    employeeId,
    issuedAt: Date.now(),
    nonce: crypto.randomUUID(),
  }

  return `MESAI_QR.${encodeBase64Url(JSON.stringify(payload))}`
}

export function parseMesaiQrToken(value: string): MesaiQrPayload | null {
  const token = value.trim()
  if (!token.startsWith("MESAI_QR.")) return null

  try {
    const payload = JSON.parse(decodeBase64Url(token.slice("MESAI_QR.".length))) as MesaiQrPayload
    if (payload.type !== "mesai-qr" || !payload.employeeId || !payload.issuedAt) return null
    return payload
  } catch {
    return null
  }
}

export function findMesaiEmployeeByScan(value: string) {
  const normalized = value.trim().toUpperCase()
  const payload = parseMesaiQrToken(value)

  if (payload) {
    return mesaiDemoEmployees.find((employee) => employee.id === payload.employeeId) || null
  }

  return mesaiDemoEmployees.find((employee) => (
    employee.qrCode === normalized || employee.id === normalized
  )) || null
}
