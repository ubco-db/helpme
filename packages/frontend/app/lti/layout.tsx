'use client'

import { Suspense, useEffect, useState } from 'react'
import { LayoutProps } from 'antd'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import ThirdPartyCookiesWarning from '@/app/lti/components/ThirdPartyCookiesWarning'

export function CookieWrapper({ children }: { children: React.ReactNode }) {
  const [hasCookieAccess, setHasCookieAccess] = useState<boolean>(true)

  useEffect(() => {
    const checkThirdPartyCookieStatus = async () => {
      if (
        !(document.hasStorageAccess ? await document.hasStorageAccess() : false)
      ) {
        setHasCookieAccess(false)
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
