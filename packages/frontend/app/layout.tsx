import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/app/utils/generalUtils'
import AntdProvider from './components/AntdProvider'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { Suspense } from 'react'
import { WebSocketProvider } from '@/app/contexts/WebSocketContext'

const interFontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'HelpMe',
  description:
    'HelpMe is a platform used by professors and students to improve student learning. Features include queues, anytime questions, and a course chatbot.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" id="html">
      <body
        className={cn(
          'bg-background flex flex-grow flex-col font-sans antialiased',
          interFontSans.variable,
        )}
      >
        <AntdProvider>
          <Suspense fallback={<CenteredSpinner tip={'Loading...'} />}>
            <WebSocketProvider>{children}</WebSocketProvider>
          </Suspense>
        </AntdProvider>
      </body>
    </html>
  )
}
