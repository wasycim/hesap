import React, { useCallback, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Linking,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { StatusBar } from "expo-status-bar"
import { WebView } from "react-native-webview"

const BASE_URL = "https://pamukkaleturizm.info"
const START_URL = `${BASE_URL}/mobile?native=expo-ios`
const HOME_URL = `${BASE_URL}/mobile`

const ALLOWED_PREFIXES = [
  "/mobile",
  "/auth/",
  "/maintenance",
  "/_next/",
  "/api/",
  "/icon",
  "/apple-icon",
  "/manifest.webmanifest",
]

const injectedJavaScript = `
  (function () {
    try {
      document.documentElement.classList.add("hesap-mobile-app");
      window.localStorage.setItem("hesap.mobileApp", "true");
    } catch (error) {}
    true;
  })();
`

export default function App() {
  const webViewRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentUrl, setCurrentUrl] = useState(START_URL)

  const source = useMemo(() => ({ uri: START_URL }), [])

  const reload = useCallback(() => {
    setError("")
    webViewRef.current?.reload()
  }, [])

  const goHome = useCallback(() => {
    setError("")
    webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(HOME_URL)}; true;`)
  }, [])

  const shouldStartLoad = useCallback((request) => {
    let url
    try {
      url = new URL(request.url)
    } catch {
      return true
    }

    if (url.protocol === "about:" || url.protocol === "data:" || url.protocol === "blob:") return true

    if (url.hostname !== "pamukkaleturizm.info") {
      Linking.openURL(request.url).catch(() => undefined)
      return false
    }

    if (url.pathname === "/") {
      webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(HOME_URL)}; true;`)
      return false
    }

    if (url.pathname.startsWith("/dashboard")) {
      webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(HOME_URL)}; true;`)
      return false
    }

    return ALLOWED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  }, [])

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>MOBİL UYGULAMA</Text>
          <Text style={styles.title}>Hesap</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={goHome}>
            <Text style={styles.actionText}>Ana</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={reload}>
            <Text style={styles.actionText}>Yenile</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.webContainer}>
        <WebView
          ref={webViewRef}
          source={source}
          style={styles.webView}
          originWhitelist={["https://pamukkaleturizm.info/*"]}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled={Platform.OS === "android"}
          injectedJavaScript={injectedJavaScript}
          onShouldStartLoadWithRequest={shouldStartLoad}
          onNavigationStateChange={(event) => setCurrentUrl(event.url)}
          onLoadStart={() => {
            setLoading(true)
            setError("")
          }}
          onLoadEnd={() => setLoading(false)}
          onError={(event) => {
            setLoading(false)
            setError(event.nativeEvent.description || "Sayfa yüklenemedi.")
          }}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 500) {
              setError(`Sunucu hatası: ${event.nativeEvent.statusCode}`)
            }
          }}
        />

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#10b981" size="large" />
            <Text style={styles.loadingText}>Hesap yükleniyor…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Bağlantı kurulamadı</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorUrl}>{currentUrl}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={reload}>
              <Text style={styles.retryText}>Tekrar dene</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    minHeight: 74,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: Platform.OS === "android" ? 26 : 8,
    backgroundColor: "#0f172a",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800",
  },
  webContainer: {
    flex: 1,
    overflow: "hidden",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: "#f8fafc",
  },
  webView: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248,250,252,0.92)",
  },
  loadingText: {
    marginTop: 12,
    color: "#334155",
    fontWeight: "700",
  },
  errorBox: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 40,
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  errorTitle: {
    color: "#9f1239",
    fontSize: 16,
    fontWeight: "900",
  },
  errorText: {
    color: "#9f1239",
    marginTop: 6,
    fontWeight: "600",
  },
  errorUrl: {
    color: "#64748b",
    marginTop: 8,
    fontSize: 11,
  },
  retryButton: {
    marginTop: 14,
    alignSelf: "flex-start",
    borderRadius: 12,
    backgroundColor: "#0f172a",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryText: {
    color: "#f8fafc",
    fontWeight: "900",
  },
})
