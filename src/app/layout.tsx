import type { Metadata, Viewport } from 'next'
import { Providers } from '@/components/ui/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'AI Office', template: '%s — AI Office' },
  description: 'Your AI-powered workspace with smart workers and seamless handoffs',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
