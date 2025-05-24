import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/app/utils/generalUtils'
import AntdProvider from './components/AntdProvider'

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
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  )
}
