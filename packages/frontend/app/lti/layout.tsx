'use client'

import { UserInfoProvider } from '@/app/contexts/userContext'
import React, { useEffect, useState } from 'react'
import { LayoutProps } from '@/app/typings/types'
import { userApi } from '@/app/api/userApi'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { usePathname } from 'next/navigation'
import { User } from '@koh/common'
import StandardPageContainer from '@/app/components/standardPageContainer'
import Link from 'next/link'
import HeaderBar from '@/app/components/HeaderBar'
import ChatbotContextProvider from '@/app/(dashboard)/course/[cid]/components/chatbot/ChatbotProvider'
import { Spin } from 'antd'

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [profile, setProfile] = useState<User>()
  const [errorGettingUser, setErrorGettingUser] = useState<string | undefined>(
    undefined,
  )
  const pathname = usePathname()

  useEffect(() => {
    const fetchUserDetails = async () => {
      await userApi
        .getUser()
        .then((userDetails) => {
          setProfile(userDetails)
        })
        .catch((error) => {
          setErrorGettingUser(getErrorMessage(error))
        })
    }
    fetchUserDetails().then()
  }, [])

  return errorGettingUser != undefined ? (
    <main className="mt-20 flex content-center justify-center gap-3">
      <p>There was an error getting your user details: </p>
      <p>{errorGettingUser}</p>
    </main>
  ) : !profile ? (
    <main className="mt-20 flex content-center justify-center">
      <Spin size="large" className="text-nowrap" tip="Loading User...">
        <div className="p-16" />
      </Spin>
    </main>
  ) : (
    <div>
      <UserInfoProvider profile={profile}>
        <header className={`border-b border-b-zinc-200 bg-white`}>
          <StandardPageContainer className="!pl-0">
            <Link href={'#skip-link-target'} className="skip-link">
              Skip to main content
            </Link>
            <HeaderBar />
          </StandardPageContainer>
        </header>
        {/* This flex flex-grow is needed so that the scroll bar doesn't show up on every page */}
        <main className="flex flex-grow flex-col">
          <ChatbotContextProvider>
            <div className="p-1">{children}</div>
          </ChatbotContextProvider>
        </main>
      </UserInfoProvider>
    </div>
  )
}

export default Layout
