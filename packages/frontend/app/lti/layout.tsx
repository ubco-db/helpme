'use client'

import { Suspense, useEffect, useState } from 'react'
import StandardPageContainer from '@/app/components/standardPageContainer'
import { Button, LayoutProps, Result } from 'antd'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import Link from 'next/link'
import { ExpandOutlined } from '@ant-design/icons'

export function CookieWrapper({ children }: { children: React.ReactNode }) {
  const launchUrl = `${process.env.NEXT_PUBLIC_HOST_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}${process.env.NEXT_PUBLIC_HOSTNAME === 'localhost' && process.env.NEXT_PUBLIC_DEV_PORT ? `:${process.env.NEXT_PUBLIC_DEV_PORT}` : ''}/?launch_from_lti=true`
  const [hasCookieAccess, setHasCookieAccess] = useState<boolean>(true)

  useEffect(() => {
    const checkThirdPartyCookieStatus = async () => {
      if (!(await document.hasStorageAccess())) {
        setHasCookieAccess(false)
      }
    }
    checkThirdPartyCookieStatus().then()
  }, [])

  if (!hasCookieAccess) {
    return (
      <StandardPageContainer>
        <Result
          status="error"
          title="Third-Party Cookies Disabled"
          extra={[
            <div className="mt-12 flex flex-col gap-2 text-center" key="error">
              <p>
                Third-Party Cookies are required to use the HelpMe LTI tool.
              </p>
              <p>
                To use HelpMe, visit it in a dedicated tab or window by clicking
                the button below:
              </p>
              <div>
                <Link href={launchUrl} target={'_blank'}>
                  <Button
                    variant={'solid'}
                    color={'primary'}
                    icon={<ExpandOutlined />}
                  >
                    Open HelpMe In New Window
                  </Button>
                </Link>
              </div>
            </div>,
          ]}
        />
      </StandardPageContainer>
    )
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
