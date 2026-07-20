// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Noto_Sans_Thai } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from '@/components/ThemeProvider'
import { SCHOOL_CONFIG } from '@/lib/config'
import './globals.css'

const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: `${SCHOOL_CONFIG.name} — ระบบหลังบ้าน`,
  description: SCHOOL_CONFIG.description,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: SCHOOL_CONFIG.name,
  },
}

export const viewport: Viewport = {
  themeColor: SCHOOL_CONFIG.primaryColor,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={SCHOOL_CONFIG.name} />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${notoSansThai.variable} font-sans bg-surface dark:bg-[#1a2030] text-gray-900 dark:text-gray-100 antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        </ThemeProvider>
      </body>
    </html>
  )
}
