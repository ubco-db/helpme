/* eslint-disable @next/next/no-img-element */
'use client'

import React, { useEffect, useState } from 'react'
import { UserInfoProvider } from '../contexts/userContext'
import { User } from '@koh/common'
import { userApi } from '../api/userApi'
import Link from 'next/link'
import { Spin } from 'antd'
import HeaderBar from '../components/HeaderBar'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutProps } from '@/app/typings/types'
import StandardPageContainer from '../components/StandardPageContainer'

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [profile, setProfile] = useState<User>()
  const pathname = usePathname()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    const fetchUserDetails = async () => {
      const userDetails = await userApi.getUser()
      const response = await userDetails.json()

      setProfile(response)
      setIsLoading(false)
      console.log('done loading!')
    }

    fetchUserDetails()
  }, [])

  // after 5 seconds of loading, redirect to login page (this way, the user is not stuck on loading screen forever)
  useEffect(() => {
    let timer: string | number | NodeJS.Timeout | undefined
    if (isLoading) {
      timer = setTimeout(() => {
        router.push('/login')
      }, 5000) // 5 seconds
    }

    return () => clearTimeout(timer) // Cleanup on unmount or if loading ends
  }, [isLoading, router])

  return profile ? (
    <UserInfoProvider profile={profile}>
      <header className={`border-b border-b-zinc-200 bg-white`}>
        <StandardPageContainer>
          <Link href={'#skip-link-target'} className="skip-link">
            Skip to main content
          </Link>
          <HeaderBar />
        </StandardPageContainer>
      </header>
      <main>
        {pathname === '/courses' && (
          <img
            src={`/api/v1/organization/${profile.organization?.orgId}/get_banner/${profile.organization?.organizationBannerUrl}`}
            alt="Organization Banner"
            className="h-[20vh] w-full object-cover object-center"
            width={100}
            height={100}
          />
        )}
        <StandardPageContainer>
          <div>{children}</div>
        </StandardPageContainer>
      </main>
    </UserInfoProvider>
  ) : (
    <main className="mt-20 flex content-center justify-center">
      <Spin size="large" className="text-nowrap" tip="Loading User...">
        <div className="p-16" />
      </Spin>
    </main>
  )
}

export default Layout
