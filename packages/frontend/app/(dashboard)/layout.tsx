'use client'

import React, { useEffect, useState } from 'react'
import { UserInfoProvider } from '../contexts/userContext'
import { User } from '@koh/common'
import { userApi } from '../api/userApi'
import Link from 'next/link'
import { Spin } from 'antd'
import HeaderBar from '../components/HeaderBar'
import { usePathname } from 'next/navigation'
import { LayoutProps } from '@/app/typings/types'
import StandardPageContainer from '../components/standardPageContainer'
import Image from 'next/image'
import ChatbotContextProvider from './course/[cid]/components/chatbot/ChatbotProvider'

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [profile, setProfile] = useState<User>()
  const pathname = usePathname()
  const URLSegments = pathname.split('/')

  useEffect(() => {
    const fetchUserDetails = async () => {
      const userDetails = await userApi.getUser()
      const response = await userDetails.json()
      setProfile(response)
    }
    fetchUserDetails()
  }, [])

  return !profile ? (
    <main className="mt-20 flex content-center justify-center">
      <Spin size="large" className="text-nowrap" tip="Loading User...">
        <div className="p-16" />
      </Spin>
    </main>
  ) : !profile.organization ? (
    <main className="mt-20 flex content-center justify-center">
      <p>
        It seems you do not have an organization! Please use a different account
        or contact an administrator.
      </p>
      <p>
        <Link className="text-blue-500" href="api/v1/logout">
          Log Out
        </Link>
      </p>
    </main>
  ) : (
    <UserInfoProvider profile={profile}>
      <header className={`border-b border-b-zinc-200 bg-white`}>
        <StandardPageContainer className="!pl-0">
          <Link href={'#skip-link-target'} className="skip-link">
            Skip to main content
          </Link>
          <HeaderBar />
        </StandardPageContainer>
      </header>
      {/* the main content of the page takes up 100% - (the height of the header bar). This is needed so that the scroll bar doesn't show up on every page */}
      <main className="h-[calc(100%-3.7rem)] min-h-[calc(100%-3.7rem)]">
        <ChatbotContextProvider>
          {pathname === '/courses' && (
            <Image
              unoptimized
              src={`/api/v1/organization/${profile.organization.orgId}/get_banner/${profile.organization.organizationBannerUrl}`}
              alt="Organization Banner"
              className="h-[20vh] w-full object-cover object-center"
              width={100}
              height={100}
            />
          )}
          {/* On certain pages (like pages with big tables), we want to let the width take up the whole page */}
          {URLSegments[4] === 'edit_questions' ||
          URLSegments[4] === 'chatbot_questions' ? (
            <div className="p-1">{children}</div>
          ) : (
            <StandardPageContainer className="min-h-full">
              {children}
            </StandardPageContainer>
          )}
        </ChatbotContextProvider>
      </main>
    </UserInfoProvider>
  )
}

export default Layout
