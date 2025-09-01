'use client'

import React, { useEffect, useState } from 'react'
import { UserInfoProvider } from '@/app/contexts/userContext'
import { User } from '@koh/common'
import { Button, Spin } from 'antd'
import { LayoutProps } from '@/app/typings/types'
import ChatbotContextProvider from '../../../(dashboard)/course/[cid]/components/chatbot/ChatbotProvider'
import { AsyncToasterProvider } from '@/app/contexts/AsyncToasterContext'
import { ReloadOutlined } from '@ant-design/icons'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { API } from '@/app/api'
import StandardPageContainer from '@/app/components/standardPageContainer'
import Link from 'next/link'
import HeaderBar from '@/app/lti/(embed)/components/LtiHeaderBar'

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [profile, setProfile] = useState<User>()
  const [errorGettingUser, setErrorGettingUser] = useState<string | undefined>(
    undefined,
  )

  useEffect(() => {
    const fetchUserDetails = async () => {
      await API.profile
        .index()
        .then((userDetails) => {
          if (!userDetails.organization) {
            throw new Error('No organization found for user profile.')
          }
          setProfile(userDetails)
        })
        .catch((error) => {
          setErrorGettingUser(getErrorMessage(error))
        })
    }
    fetchUserDetails()
  }, [])

  return errorGettingUser ? (
    <main className="mt-20 flex flex-col content-center justify-center gap-3">
      <p>There was an error getting your user details: </p>
      <p>{errorGettingUser}</p>
      <Button
        type="primary"
        icon={<ReloadOutlined />}
        onClick={() => {
          window.location.reload()
        }}
      >
        Try again
      </Button>
    </main>
  ) : !profile ? (
    <main className="mt-20 flex content-center justify-center">
      <Spin size="large" className="text-nowrap" tip="Loading User...">
        <div className="p-16" />
      </Spin>
    </main>
  ) : (
    <AsyncToasterProvider>
      <UserInfoProvider profile={profile}>
        <header className={`border-b border-b-zinc-200 bg-white`}>
          <StandardPageContainer className="!pl-0">
            <Link href={'#skip-link-target'} className="skip-link">
              Skip to main content
            </Link>
            <HeaderBar />
          </StandardPageContainer>
        </header>
        <main className="flex flex-grow flex-col">
          <ChatbotContextProvider>
            <div
              className={
                'mx-auto flex w-full flex-grow flex-col px-1 sm:px-5 md:px-8 xl:max-w-[1500px]'
              }
            >
              {children}
            </div>
          </ChatbotContextProvider>
        </main>
      </UserInfoProvider>
    </AsyncToasterProvider>
  )
}

export default Layout
