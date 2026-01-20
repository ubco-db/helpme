'use client'

import { Suspense, useEffect, useState } from 'react'
import { LayoutProps } from 'antd'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import ThirdPartyCookiesWarning from '@/app/lti/components/ThirdPartyCookiesWarning'

export function CookieWrapper({ children }: { children: React.ReactNode }) {
  const [hasCookieAccess, setHasCookieAccess] = useState<boolean>(true)

  useEffect(() => {
    const checkThirdPartyCookieStatus = async () => {
      try {
        const storageAccessible =
          document.hasStorageAccess &&
          typeof document.hasStorageAccess === 'function'
            ? await document.hasStorageAccess()
            : false
        setHasCookieAccess(storageAccessible)
      } catch (err: any) {
        console.error(err)
      }
    }
    checkThirdPartyCookieStatus().then()
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
