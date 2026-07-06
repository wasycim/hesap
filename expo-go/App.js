import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { StatusBar } from "expo-status-bar"
import * as Print from "expo-print"
import * as SecureStore from "expo-secure-store"
import * as Sharing from "expo-sharing"

const API_BASE_URL = "https://pamukkaleturizm.info"
const SESSION_KEY = "hesap.native.session"
const DEVICE_KEY = "hesap.native.deviceId"

function normalizeTc(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 11)
}

function formatMoney(value) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(value) || 0)
}

function formatDate(value) {
  if (!value) return "-"
  return new Date(`${value}T12:00:00`).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function monthLabel(month, year) {
  return new Date(year, month - 1, 1).toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  })
}

function formatMinutes(value) {
  const total = Number(value) || 0
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${hours ? `${hours} sa ` : ""}${minutes ? `${minutes} dk` : ""}`.trim() || "Doğrudan tutar"
}

function makeDeviceId() {
  return `native-${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

async function getDeviceIdentity() {
  let deviceId = await SecureStore.getItemAsync(DEVICE_KEY)
  if (!deviceId) {
    deviceId = makeDeviceId()
    await SecureStore.setItemAsync(DEVICE_KEY, deviceId)
  }

  return {
    deviceId,
    platform: Platform.OS === "ios" ? "ios" : "android",
    label: Platform.OS === "ios" ? "iPhone / iPad uygulaması" : "Android uygulaması",
  }
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || "İşlem tamamlanamadı.")
    error.status = response.status
    error.payload = payload
    throw error
  }
  return payload
}

export default function App() {
  const now = useMemo(() => new Date(), [])
  const [booting, setBooting] = useState(true)
  const [session, setSession] = useState(null)
  const [pendingSession, setPendingSession] = useState(null)
  const [challenge, setChallenge] = useState(null)
  const [screen, setScreen] = useState("overview")
  const [loginForm, setLoginForm] = useState({ tcKimlik: "", password: "" })
  const [verifyCode, setVerifyCode] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [overview, setOverview] = useState(null)
  const [salary, setSalary] = useState(null)
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() })

  const persistSession = useCallback(async (nextSession) => {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(nextSession))
    setSession(nextSession)
  }, [])

  const clearSession = useCallback(async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined)
    setSession(null)
    setPendingSession(null)
    setChallenge(null)
    setOverview(null)
    setSalary(null)
    setScreen("overview")
  }, [])

  const refreshNativeSession = useCallback(async (activeSession, force = false) => {
    if (!activeSession?.refreshToken) return activeSession

    const expiresAtMs = Number(activeSession.expiresAt || 0) * 1000
    if (!force && expiresAtMs && expiresAtMs - Date.now() > 60_000) return activeSession

    const response = await fetch(`${API_BASE_URL}/api/mobile/native-refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: activeSession.refreshToken }),
    })
    const payload = await readJson(response)
    const nextSession = {
      ...activeSession,
      user: { ...(activeSession.user || {}), ...(payload.user || {}) },
      accessToken: payload.session.accessToken,
      refreshToken: payload.session.refreshToken || activeSession.refreshToken,
      expiresAt: payload.session.expiresAt,
    }
    await persistSession(nextSession)
    return nextSession
  }, [persistSession])

  const requestJson = useCallback(async (path, options = {}, givenSession = session) => {
    if (!givenSession?.accessToken) throw new Error("Oturum bulunamadı.")

    let activeSession = await refreshNativeSession(givenSession)
    const makeRequest = () => fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
        Authorization: `Bearer ${activeSession.accessToken}`,
      },
    })

    let response = await makeRequest()
    if (response.status === 401 && activeSession.refreshToken) {
      activeSession = await refreshNativeSession(activeSession, true)
      response = await makeRequest()
    }

    return readJson(response)
  }, [refreshNativeSession, session])

  const registerDevice = useCallback(async (activeSession) => {
    const identity = await getDeviceIdentity()
    await requestJson("/api/mobile/register-device", {
      method: "POST",
      body: JSON.stringify(identity),
    }, activeSession).catch(() => undefined)
  }, [requestJson])

  const finishTrustedLogin = useCallback(async (nextSession) => {
    await persistSession(nextSession)
    await registerDevice(nextSession)
    setPendingSession(null)
    setChallenge(null)
    setVerifyCode("")
    setError("")
  }, [persistSession, registerDevice])

  const startDeviceVerification = useCallback(async (nextSession) => {
    const identity = await getDeviceIdentity()
    const result = await requestJson("/api/auth/device-verification/start", {
      method: "POST",
      body: JSON.stringify(identity),
    }, nextSession)

    if (result.challengeRequired) {
      setPendingSession(nextSession)
      setChallenge({ ...result, ...identity })
      setSession(null)
      return
    }

    await finishTrustedLogin(nextSession)
  }, [finishTrustedLogin, requestJson])

  useEffect(() => {
    let active = true
    SecureStore.getItemAsync(SESSION_KEY)
      .then((value) => {
        if (!active || !value) return
        const parsed = JSON.parse(value)
        if (parsed?.accessToken) setSession(parsed)
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setBooting(false)
      })

    return () => {
      active = false
    }
  }, [])

  const loadOverview = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError("")
    try {
      setOverview(await requestJson("/api/mobile/overview"))
    } catch (reason) {
      if (reason.status === 401) await clearSession()
      setError(reason.message || "Genel bakış yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [clearSession, requestJson, session])

  const loadSalary = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError("")
    try {
      setSalary(await requestJson(`/api/mobile/salary?month=${period.month}&year=${period.year}`))
    } catch (reason) {
      if (reason.status === 401) await clearSession()
      setError(reason.message || "Maaş bilgisi yüklenemedi.")
      setSalary(null)
    } finally {
      setLoading(false)
    }
  }, [clearSession, period.month, period.year, requestJson, session])

  useEffect(() => {
    if (!session) return
    if (screen === "overview") loadOverview()
    if (screen === "salary") loadSalary()
  }, [loadOverview, loadSalary, screen, session])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      if (screen === "overview") await loadOverview()
      if (screen === "salary") await loadSalary()
    } finally {
      setRefreshing(false)
    }
  }, [loadOverview, loadSalary, screen])

  async function handleLogin() {
    const tcKimlik = normalizeTc(loginForm.tcKimlik)
    if (tcKimlik.length !== 11) {
      setError("TC kimlik 11 haneli olmalı.")
      return
    }
    if (!loginForm.password) {
      setError("Şifrenizi girin.")
      return
    }

    setAuthLoading(true)
    setError("")
    try {
      const response = await fetch(`${API_BASE_URL}/api/mobile/native-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ tcKimlik, password: loginForm.password }),
      })
      const payload = await readJson(response)
      const nextSession = {
        user: payload.user,
        profile: payload.profile,
        accessToken: payload.session.accessToken,
        refreshToken: payload.session.refreshToken,
        expiresAt: payload.session.expiresAt,
      }
      await startDeviceVerification(nextSession)
    } catch (reason) {
      setError(reason.message || "Giriş yapılamadı.")
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleVerifyCode() {
    if (!pendingSession || !challenge) return
    const code = verifyCode.replace(/\D/g, "")
    if (code.length !== 6) {
      setError("6 haneli doğrulama kodunu girin.")
      return
    }

    setAuthLoading(true)
    setError("")
    try {
      await requestJson("/api/auth/device-verification/verify", {
        method: "POST",
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          deviceId: challenge.deviceId,
          code,
        }),
      }, pendingSession)
      await finishTrustedLogin(pendingSession)
    } catch (reason) {
      setError(reason.message || "Kod doğrulanamadı.")
    } finally {
      setAuthLoading(false)
    }
  }

  function moveMonth(delta) {
    const date = new Date(period.year, period.month - 1 + delta, 1)
    setPeriod({ month: date.getMonth() + 1, year: date.getFullYear() })
  }

  async function shareSalaryPdf() {
    if (!salary) return
    try {
      const { uri } = await Print.printToFileAsync({
        html: salaryPdfHtml(salary),
        base64: false,
      })
      const available = await Sharing.isAvailableAsync()
      if (!available) {
        Alert.alert("PDF hazır", uri)
        return
      }
      await Sharing.shareAsync(uri, {
        dialogTitle: "Maaş PDF paylaş",
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
      })
    } catch (reason) {
      Alert.alert("PDF oluşturulamadı", reason?.message || "Tekrar deneyin.")
    }
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.splash}>
        <StatusBar style="light" />
        <ActivityIndicator color="#34d399" size="large" />
        <Text style={styles.splashText}>Hesap açılıyor…</Text>
      </SafeAreaView>
    )
  }

  if (challenge) {
    return (
      <AuthFrame>
        <Text style={styles.authEyebrow}>CİHAZ DOĞRULAMA</Text>
        <Text style={styles.authTitle}>Yeni cihaz kodu</Text>
        <Text style={styles.authText}>
          Bu cihaz ilk kez kullanılıyor. {challenge.maskedEmail || "E-posta adresinize"} gönderilen 6 haneli kodu girin.
        </Text>
        <TextInput
          style={styles.input}
          value={verifyCode}
          onChangeText={(value) => setVerifyCode(value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          keyboardType="number-pad"
          maxLength={6}
          placeholderTextColor="#94a3b8"
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton label="Cihazı doğrula" loading={authLoading} onPress={handleVerifyCode} />
        <TouchableOpacity onPress={clearSession} style={styles.secondaryLink}>
          <Text style={styles.secondaryLinkText}>Girişe dön</Text>
        </TouchableOpacity>
      </AuthFrame>
    )
  }

  if (!session) {
    return (
      <AuthFrame>
        <Text style={styles.authEyebrow}>HESAP MOBİL</Text>
        <Text style={styles.authTitle}>Native iOS giriş</Text>
        <Text style={styles.authText}>TestFlight uygulaması artık web sayfası açmaz; verileri güvenli API üzerinden çeker.</Text>
        <TextInput
          style={styles.input}
          value={loginForm.tcKimlik}
          onChangeText={(value) => setLoginForm((item) => ({ ...item, tcKimlik: normalizeTc(value) }))}
          placeholder="TC kimlik"
          keyboardType="number-pad"
          maxLength={11}
          placeholderTextColor="#94a3b8"
        />
        <TextInput
          style={styles.input}
          value={loginForm.password}
          onChangeText={(value) => setLoginForm((item) => ({ ...item, password: value }))}
          placeholder="Şifre"
          secureTextEntry
          placeholderTextColor="#94a3b8"
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton label="Giriş yap" loading={authLoading} onPress={handleLogin} />
      </AuthFrame>
    )
  }

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="light" backgroundColor="#0f172a" />
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topEyebrow}>Hesap Mobil</Text>
          <Text style={styles.topTitle}>{session.user?.displayName || "Kullanıcı"}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={clearSession}>
          <Text style={styles.logoutText}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TabButton label="Genel Bakış" active={screen === "overview"} onPress={() => setScreen("overview")} />
        <TabButton label="Maaşım" active={screen === "salary"} onPress={() => setScreen("salary")} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
      >
        {error ? <View style={styles.errorBox}><Text style={styles.errorBoxText}>{error}</Text></View> : null}
        {loading ? <InlineLoader /> : null}
        {screen === "overview" ? <OverviewScreen data={overview} /> : null}
        {screen === "salary" ? (
          <SalaryScreen
            data={salary}
            period={period}
            onPrev={() => moveMonth(-1)}
            onNext={() => moveMonth(1)}
            onShare={shareSalaryPdf}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function AuthFrame({ children }) {
  return (
    <SafeAreaView style={styles.authRoot}>
      <StatusBar style="light" backgroundColor="#0f172a" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.authKeyboard}>
        <View style={styles.authCard}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>H</Text>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function PrimaryButton({ label, loading, onPress }) {
  return (
    <TouchableOpacity style={[styles.primaryButton, loading && styles.disabledButton]} onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator color="#042f2e" /> : <Text style={styles.primaryText}>{label}</Text>}
    </TouchableOpacity>
  )
}

function TabButton({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

function InlineLoader() {
  return (
    <View style={styles.inlineLoader}>
      <ActivityIndicator color="#10b981" />
      <Text style={styles.inlineLoaderText}>Yükleniyor…</Text>
    </View>
  )
}

function OverviewScreen({ data }) {
  if (!data) return <EmptyState title="Genel bakış bekleniyor" text="Veriler yüklendiğinde burada görünecek." />

  return (
    <View>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>BUGÜN</Text>
        <Text style={styles.heroTitle}>{formatDate(data.date)}</Text>
        <Text style={styles.heroSub}>{data.branch?.ad || "Şube"} · Salt okunur özet</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Gelir" value={data.toplamGelir} tone="green" />
        <StatCard label="Gider" value={data.toplamGider} tone="red" />
        <StatCard label="Kalan" value={data.kalan} tone={Number(data.kalan) >= 0 ? "blue" : "red"} wide />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Telefon modu</Text>
        <Text style={styles.infoText}>Bu ekrandaki kartlar işlem sayfalarına yönlendirmez. Mobil uygulama sadece genel özet ve kişisel maaş detayını gösterir.</Text>
      </View>
    </View>
  )
}

function StatCard({ label, value, tone, wide }) {
  return (
    <View style={[styles.statCard, wide && styles.statWide, styles[`tone_${tone}`]]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{formatMoney(value)}</Text>
    </View>
  )
}

function SalaryScreen({ data, period, onPrev, onNext, onShare }) {
  return (
    <View>
      <View style={styles.periodRow}>
        <TouchableOpacity style={styles.circleButton} onPress={onPrev}><Text style={styles.circleButtonText}>‹</Text></TouchableOpacity>
        <Text style={styles.periodText}>{monthLabel(period.month, period.year)}</Text>
        <TouchableOpacity style={styles.circleButton} onPress={onNext}><Text style={styles.circleButtonText}>›</Text></TouchableOpacity>
      </View>

      {!data ? <EmptyState title="Maaş detayı bekleniyor" text="Bu ay için maaş verisi geldiğinde burada görünecek." /> : (
        <>
          <View style={styles.salaryHero}>
            <Text style={styles.salaryHeroLabel}>Net kalan</Text>
            <Text style={styles.salaryHeroValue}>{formatMoney(data.remaining)}</Text>
            <Text style={styles.salaryHeroSub}>{data.personel?.name || "Personel"} · {data.branch?.ad || "Şube"}</Text>
            <TouchableOpacity style={styles.pdfButton} onPress={onShare}>
              <Text style={styles.pdfButtonText}>PDF paylaş</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.salaryMetrics}>
            <MiniMetric label="Aylık maaş" value={data.baseSalary} />
            <MiniMetric label="Onaylı mesai" value={data.overtimeTotal} positive />
            <MiniMetric label="Avans" value={data.advanceTotal} negative />
          </View>

          <DetailSection title="Avanslar" empty="Bu ay avans kaydı yok." rows={(data.advances || []).map((item) => ({
            title: formatDate(item.date),
            meta: item.description,
            amount: `−${formatMoney(item.amount)}`,
            negative: true,
          }))} />
          <DetailSection title="Mesailer" empty="Bu ay onaylı mesai kaydı yok." rows={(data.overtime || []).map((item) => ({
            title: formatDate(item.date),
            meta: `${item.description}${item.minutes ? ` · ${formatMinutes(item.minutes)}` : ""}`,
            amount: `+${formatMoney(item.amount)}`,
            positive: true,
          }))} />
        </>
      )}
    </View>
  )
}

function MiniMetric({ label, value, positive, negative }) {
  return (
    <View style={styles.miniMetric}>
      <Text style={styles.miniMetricLabel}>{label}</Text>
      <Text style={[styles.miniMetricValue, positive && styles.positiveText, negative && styles.negativeText]}>
        {positive ? "+" : negative ? "−" : ""}{formatMoney(value)}
      </Text>
    </View>
  )
}

function DetailSection({ title, rows, empty }) {
  return (
    <View style={styles.detailSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.length ? rows.map((row, index) => (
        <View style={styles.detailRow} key={`${row.title}-${index}`}>
          <View style={styles.detailTextWrap}>
            <Text style={styles.detailTitle}>{row.title}</Text>
            <Text style={styles.detailMeta}>{row.meta}</Text>
          </View>
          <Text style={[styles.detailAmount, row.positive && styles.positiveText, row.negative && styles.negativeText]}>{row.amount}</Text>
        </View>
      )) : <Text style={styles.emptyText}>{empty}</Text>}
    </View>
  )
}

function EmptyState({ title, text }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  )
}

function salaryPdfHtml(data) {
  const advances = (data.advances || []).map((item) => `
    <tr><td>${formatDate(item.date)}</td><td>${escapeHtml(item.description)}</td><td class="negative">-${formatMoney(item.amount)}</td></tr>
  `).join("") || `<tr><td colspan="3">Avans kaydı yok.</td></tr>`
  const overtime = (data.overtime || []).map((item) => `
    <tr><td>${formatDate(item.date)}</td><td>${escapeHtml(item.description)} ${item.minutes ? `· ${formatMinutes(item.minutes)}` : ""}</td><td class="positive">+${formatMoney(item.amount)}</td></tr>
  `).join("") || `<tr><td colspan="3">Mesai kaydı yok.</td></tr>`

  return `
    <!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 28px; color: #0f172a; }
          h1 { margin: 0; font-size: 26px; }
          .sub { color: #64748b; margin-top: 6px; }
          .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 24px 0; }
          .metric { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; }
          .metric span { color: #64748b; font-size: 12px; }
          .metric strong { display: block; margin-top: 6px; font-size: 18px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; font-size: 12px; }
          th { background: #f8fafc; }
          .positive { color: #059669; font-weight: 800; }
          .negative { color: #dc2626; font-weight: 800; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(data.personel?.name || "Personel")} Maaş Detayı</h1>
        <div class="sub">${escapeHtml(data.branch?.ad || "Şube")} · ${monthLabel(data.period.month, data.period.year)}</div>
        <div class="metrics">
          <div class="metric"><span>Aylık Maaş</span><strong>${formatMoney(data.baseSalary)}</strong></div>
          <div class="metric"><span>Onaylı Mesai</span><strong class="positive">+${formatMoney(data.overtimeTotal)}</strong></div>
          <div class="metric"><span>Avans</span><strong class="negative">-${formatMoney(data.advanceTotal)}</strong></div>
          <div class="metric"><span>Net Kalan</span><strong>${formatMoney(data.remaining)}</strong></div>
        </div>
        <h2>Avanslar</h2>
        <table><thead><tr><th>Tarih</th><th>Açıklama</th><th>Tutar</th></tr></thead><tbody>${advances}</tbody></table>
        <h2>Mesailer</h2>
        <table><thead><tr><th>Tarih</th><th>Açıklama</th><th>Tutar</th></tr></thead><tbody>${overtime}</tbody></table>
      </body>
    </html>
  `
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
  },
  splashText: {
    marginTop: 14,
    color: "#cbd5e1",
    fontWeight: "800",
  },
  authRoot: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  authKeyboard: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  authCard: {
    borderRadius: 32,
    backgroundColor: "#ffffff",
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
  },
  logoCircle: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    marginBottom: 18,
  },
  logoText: {
    color: "#042f2e",
    fontSize: 28,
    fontWeight: "900",
  },
  authEyebrow: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  authTitle: {
    marginTop: 6,
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "900",
  },
  authText: {
    marginTop: 10,
    marginBottom: 16,
    color: "#64748b",
    lineHeight: 21,
    fontWeight: "600",
  },
  input: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbe3ed",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 15,
    marginTop: 10,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#34d399",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryText: {
    color: "#042f2e",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryLink: {
    alignItems: "center",
    paddingTop: 16,
  },
  secondaryLinkText: {
    color: "#0f766e",
    fontWeight: "800",
  },
  errorText: {
    marginTop: 12,
    color: "#dc2626",
    fontWeight: "800",
  },
  app: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  topBar: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 18 : 6,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topEyebrow: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  topTitle: {
    marginTop: 4,
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900",
  },
  logoutButton: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  logoutText: {
    color: "#f8fafc",
    fontWeight: "900",
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  tabButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  tabButtonActive: {
    backgroundColor: "#ffffff",
  },
  tabText: {
    color: "#cbd5e1",
    fontWeight: "900",
  },
  tabTextActive: {
    color: "#0f172a",
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#f8fafc",
  },
  contentInner: {
    padding: 18,
    paddingBottom: 34,
  },
  inlineLoader: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  inlineLoaderText: {
    color: "#334155",
    fontWeight: "800",
  },
  errorBox: {
    borderRadius: 18,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 14,
    marginBottom: 12,
  },
  errorBoxText: {
    color: "#991b1b",
    fontWeight: "800",
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: "#0f172a",
    padding: 20,
    marginBottom: 14,
  },
  heroEyebrow: {
    color: "#34d399",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: "#ffffff",
    marginTop: 8,
    fontSize: 28,
    fontWeight: "900",
  },
  heroSub: {
    color: "#cbd5e1",
    marginTop: 6,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: "48%",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statWide: {
    width: "100%",
  },
  statLabel: {
    color: "#64748b",
    fontWeight: "900",
  },
  statValue: {
    color: "#0f172a",
    marginTop: 8,
    fontSize: 21,
    fontWeight: "900",
  },
  tone_green: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  tone_red: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  tone_blue: {
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  infoCard: {
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginTop: 14,
  },
  infoTitle: {
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 16,
  },
  infoText: {
    color: "#64748b",
    marginTop: 6,
    lineHeight: 20,
    fontWeight: "600",
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  circleButtonText: {
    color: "#0f172a",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 33,
  },
  periodText: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  salaryHero: {
    borderRadius: 28,
    backgroundColor: "#064e3b",
    padding: 20,
    marginBottom: 12,
  },
  salaryHeroLabel: {
    color: "#a7f3d0",
    fontWeight: "900",
  },
  salaryHeroValue: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 6,
  },
  salaryHeroSub: {
    color: "#d1fae5",
    marginTop: 6,
    fontWeight: "700",
  },
  pdfButton: {
    marginTop: 16,
    alignSelf: "flex-start",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  pdfButtonText: {
    color: "#064e3b",
    fontWeight: "900",
  },
  salaryMetrics: {
    gap: 10,
    marginBottom: 12,
  },
  miniMetric: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  miniMetricLabel: {
    color: "#64748b",
    fontWeight: "900",
  },
  miniMetricValue: {
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 16,
  },
  positiveText: {
    color: "#059669",
  },
  negativeText: {
    color: "#dc2626",
  },
  detailSection: {
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 15,
    marginTop: 12,
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 17,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
    paddingBottom: 10,
  },
  detailTextWrap: {
    flex: 1,
  },
  detailTitle: {
    color: "#0f172a",
    fontWeight: "900",
  },
  detailMeta: {
    color: "#64748b",
    marginTop: 3,
    fontWeight: "600",
  },
  detailAmount: {
    color: "#0f172a",
    fontWeight: "900",
  },
  emptyCard: {
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 18,
  },
  emptyTitle: {
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 17,
  },
  emptyText: {
    color: "#64748b",
    marginTop: 5,
    lineHeight: 20,
    fontWeight: "600",
  },
})
