import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeUserSync } from '@/components/theme-user-sync'
import { VercelToolbarBlocker } from '@/components/vercel-toolbar-blocker'
import { NativeAppBridge } from '@/components/mobile/native-app-bridge'
import { ConnectivityOverlay } from '@/components/mobile/connectivity-overlay'
import { ServiceWorkerRegistration } from '@/components/mobile/service-worker-registration'
import { ClientErrorReporter } from '@/components/system/client-error-reporter'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: 'Hesap Rapor Sistemi',
  description: 'Hesap ve finansal rapor yönetim sistemi',
  manifest: '/manifest.webmanifest',
  applicationName: 'Hesap Rapor',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Hesap Rapor',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: '/iconw.png',
        sizes: '1024x1024',
        type: 'image/png',
      },
    ],
    shortcut: '/iconw.png',
    apple: '/iconw.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="tr" className="bg-background" suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="hesap-theme">
          <ThemeUserSync />
          <ClientErrorReporter />
          <ServiceWorkerRegistration />
          <VercelToolbarBlocker />
          {children}
          <ConnectivityOverlay />
          <NativeAppBridge />
          <Toaster
            position="top-right"
            richColors
            toastOptions={{
              className: "border-emerald-700 bg-emerald-950 text-emerald-100",
            }}
          />
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </ThemeProvider>
      </body>
    </html>
  )
}
