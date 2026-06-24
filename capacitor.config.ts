import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "wasy.system.hesap",
  appName: "Hesap",
  webDir: "mobile-shell",
  server: {
    androidScheme: "https",
    iosScheme: "https",
    allowNavigation: ["pamukkaleturizm.info"],
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
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
}

export default config
