import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "info.pamukkaleturizm.hesap",
  appName: "Hesap",
  webDir: "mobile-shell",
  server: {
    url: "https://pamukkaleturizm.info",
    cleartext: false,
    androidScheme: "https",
    iosScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0f172a",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0f172a",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
}

export default config
