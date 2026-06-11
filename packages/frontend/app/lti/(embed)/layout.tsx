'use client'

import { LayoutProps } from 'antd'
import { LtiContextProvider } from '@/app/contexts/LtiContext'
import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { useSessionStorage } from '@/app/hooks/useSessionStorage'
import { LMSIntegrationPlatform } from '@koh/common'

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const searchParams = useSearchParams()

  const [ltiStorageTarget, setLtiStorageTarget] = useSessionStorage<string>(
    'lti_storage_target',
    null,
  )

  const [_, setLmsInfo] = useSessionStorage<{
    platform: LMSIntegrationPlatform
    apiCourseId: string
  }>('lms_info', null)

  useEffect(() => {
    const param = searchParams.get('lti_storage_target')
    if (param) {
      setLtiStorageTarget(param)
    }
    const apiCourseId = searchParams.get('api_course_id')
    const platform = searchParams.get('lms_platform')
    if (apiCourseId && platform) {
      setLmsInfo({
        apiCourseId,
        platform: platform as LMSIntegrationPlatform,
      })
    }
  }, [searchParams])

  if (global.window) {
    return (
      <LtiContextProvider
        window={global.window}
        lti_storage_target={ltiStorageTarget ?? undefined}
      >
        {children}
      </LtiContextProvider>
    )
  } else {
    return children
  }
}

export default Layout
