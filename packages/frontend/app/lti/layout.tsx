'use client'

import { Suspense, useEffect, useState, type ReactNode } from 'react'
import type { LayoutProps } from 'antd'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import ThirdPartyCookiesWarning from '@/app/lti/components/ThirdPartyCookiesWarning'

export function CookieWrapper({ children }: { children: ReactNode }) {
  const [hasCookieAccess, setHasCookieAccess] = useState<boolean>(true)

  useEffect(() => {
    const checkCookieAccess = window.setTimeout(() => {
      try {
        const testCookie = '__helpme_cookie_test=1'
        const cookieAttributes =
          window.location.protocol === 'https:'
            ? '; SameSite=None; Secure'
            : '; SameSite=Lax'
        document.cookie = `${testCookie}; path=/${cookieAttributes}`
        setHasCookieAccess(document.cookie.split('; ').includes(testCookie))
        document.cookie = `__helpme_cookie_test=; Max-Age=0; path=/${cookieAttributes}`
      } catch (err: unknown) {
        console.error(err)
        setHasCookieAccess(false)
      }
    }, 0)

    return () => window.clearTimeout(checkCookieAccess)
  }, [])

  if (!hasCookieAccess) {
    return <ThirdPartyCookiesWarning />
  }
  return children
}

export default function Layout({ children }: LayoutProps) {
  return (
    <Suspense fallback={<CenteredSpinner tip={'Loading...'} />}>
      <CookieWrapper>{children}</CookieWrapper>
    </Suspense>
  )
}
