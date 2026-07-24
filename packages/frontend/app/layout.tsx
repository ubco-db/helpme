import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/app/utils/generalUtils'
import AntdProvider from './components/AntdProvider'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { Suspense } from 'react'

// Suppressing that annoying antd warning that says to not use message.success()/info()/error()
// It's a lot more annoying and more work to use their context stuff as opposed to just being able to import
// `message` function and use it right away.
if (typeof window !== 'undefined') {
  const originalWarn = console.warn
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes(
        '[antd: message] Static function can not consume context',
      )
    ) {
      return
    }
    originalWarn(...args)
  }
}

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
            {children}
          </Suspense>
        </AntdProvider>
      </body>
    </html>
  )
}
