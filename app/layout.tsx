import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: 'Hesap Rapor Sistemi',
  description: 'Hesap ve finansal rapor yönetim sistemi',
  generator: 'v0.app',
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
        url: '/w-logo-light.svg',
        media: '(prefers-color-scheme: light)',
        type: 'image/svg+xml',
      },
      {
        url: '/w-logo-dark.svg',
        media: '(prefers-color-scheme: dark)',
        type: 'image/svg+xml',
      },
      {
        url: '/w-logo-light.svg',
        type: 'image/svg+xml',
      },
    ],
    shortcut: '/w-logo-light.svg',
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
          {children}
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
