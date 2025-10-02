'use client'

import SidebarNavigation from './components/SidebarNavigation'
import React, { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { fetchUserDetails } from '@/app/api'
import { Button, Spin } from 'antd'
import { LogoutOutlined, ReloadOutlined } from '@ant-design/icons'
import { AsyncToasterProvider } from '@/app/contexts/AsyncToasterContext'
import { UserInfoProvider } from '@/app/contexts/userContext'
import StandardPageContainer from '@/app/components/standardPageContainer'
import Link from 'next/link'
import HeaderBar from '@/app/components/HeaderBar'
import FooterBar from '@/app/(dashboard)/components/FooterBar'
import { User } from '@koh/common'

export default function AdminLayout({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode
}) {
  const [profile, setProfile] = useState<User>()
  const [errorGettingUser, setErrorGettingUser] = useState<string | undefined>(
    undefined,
  )
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    fetchUserDetails(setProfile, setErrorGettingUser, router, pathname)
  }, [])

  return errorGettingUser ? (
    <main className="mt-20 flex content-center justify-center gap-3">
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
      <Button
        icon={<LogoutOutlined />}
        onClick={() => {
          router.push(`/api/v1/logout?redirect=${pathname}`)
        }}
        danger
      >
        Log Out
      </Button>
    </main>
  ) : !profile ? (
    <main className="mt-20 flex content-center justify-center">
      <Spin size="large" className="text-nowrap" tip="Loading User...">
        <div className="p-16" />
      </Spin>
    </main>
  ) : (
    <>
      <title>HelpMe Admin</title>
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
          {/* This flex flex-grow is needed so that the scroll bar doesn't show up on every page */}
          <main className="flex flex-grow flex-col">
            <StandardPageContainer className="flex-grow">
              <h2>Administration</h2>
              <div className="mt-5 w-full gap-8 space-y-3 md:grid md:grid-cols-10 md:space-y-0">
                <SidebarNavigation />
                <div className="md:col-span-8">{children}</div>
              </div>
            </StandardPageContainer>
          </main>
          <FooterBar />
        </UserInfoProvider>
      </AsyncToasterProvider>
    </>
  )
}
