import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { cn } from '@/app/utils/generalUtils'

const interFontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'HelpMe',
  description:
    'HelpMe is a platform to help you find course help when you need it.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <html lang="en" id="html">
        <body
          className={cn(
            'bg-background min-h-screen font-sans antialiased',
            interFontSans.variable,
          )}
        >
          <AntdRegistry>{children}</AntdRegistry>
        </body>
      </html>
    </>
  )
}
