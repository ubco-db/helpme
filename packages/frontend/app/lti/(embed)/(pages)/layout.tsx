'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { UserInfoProvider } from '@/app/contexts/userContext'
import { User } from '@koh/common'
import { Button, Spin } from 'antd'
import { LayoutProps } from '@/app/typings/types'
import ChatbotContextProvider from '../../../(dashboard)/course/[cid]/components/chatbot/ChatbotProvider'
import { AsyncToasterProvider } from '@/app/contexts/AsyncToasterContext'
import { ReloadOutlined } from '@ant-design/icons'
import { fetchUserDetails } from '@/app/api'
import StandardPageContainer from '@/app/components/standardPageContainer'
import HeaderBar from '@/app/components/HeaderBar'
import { useLtiContext } from '@/app/contexts/LtiContext'
import VerifyEmailPage from '@/app/(auth)/verify/page'

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [profile, setProfile] = useState<User>()
  const [errorGettingUser, setErrorGettingUser] = useState<string | undefined>(
    undefined,
  )

  useEffect(() => {
    fetchUserDetails((userDetails) => {
      if (!userDetails.organization) {
        setErrorGettingUser('No organization found for user profile.')
        return
      }
      setProfile(userDetails)
    }, setErrorGettingUser)
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
  ) : !profile.emailVerified ? (
    <VerifyEmailPage />
  ) : (
    <AsyncToasterProvider>
      <UserInfoProvider profile={profile}>
        <header className={`border-b border-b-zinc-200 bg-white`}>
          <StandardPageContainer className="!pl-0">
            <HeaderBar />
          </StandardPageContainer>
        </header>
        <IFrameWrapper>
          <ChatbotContextProvider>
            <div
              className={
                'mx-auto flex w-full flex-grow flex-col px-1 sm:px-5 md:px-8 xl:max-w-[1500px]'
              }
            >
              {children}
            </div>
          </ChatbotContextProvider>
        </IFrameWrapper>
      </UserInfoProvider>
    </AsyncToasterProvider>
  )
}

export default Layout

function IFrameWrapper({
  children,
}: {
  children: React.ReactNode
}): React.ReactNode {
  const { windowSize } = useLtiContext()

  const [frameHeight, setFrameHeight] = useState<number>(window.innerHeight)
  useEffect(() => {
    const throttleTime = 500 // ms between setState's to prevent re-rendering too frequently
    let currentTimer: NodeJS.Timeout | undefined = undefined
    let canUpdate = true

    const onResize = () => {
      if (canUpdate) {
        if (currentTimer !== undefined) {
          clearTimeout(currentTimer)
        }
        setFrameHeight(window.innerHeight)
        canUpdate = false
        currentTimer = setTimeout(() => (canUpdate = true), throttleTime)
      }
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const frameRatio = useMemo(
    () => (windowSize ? frameHeight / windowSize.height : undefined),
    [frameHeight, windowSize],
  )

  if (frameRatio == undefined) {
    return children
  }

  const factor = Math.floor(frameRatio * 100)
  const offset = Math.floor((100 - factor) / 2)
  const transform = `scale(${factor}%) translate(0,-${offset}%)`

  return (
    <main
      style={{
        transform,
      }}
      className={'flex flex-grow flex-col'}
    >
      {children}
    </main>
  )
}
