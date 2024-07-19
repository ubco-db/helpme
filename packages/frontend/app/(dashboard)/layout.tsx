'use client'

import React, { useEffect, useState } from 'react'
import { UserInfoProvider } from '../contexts/userContext'
import { User } from '@koh/common'
import { userApi } from '../api/userApi'
import Image from 'next/image'
import Link from 'next/link'
import { Spin } from 'antd'
import Navbar from '../components/navbar'
import { usePathname } from 'next/navigation'
import { LayoutProps } from '@/app/typings/types'
import StandardPageContainer from '../components/StandardPageContainer'

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [profile, setProfile] = useState<User>()
  const pathname = usePathname()

  useEffect(() => {
    const fetchUserDetails = async () => {
      const userDetails = await userApi.getUser()
      const response = await userDetails.json()

      setProfile(response)
    }

    fetchUserDetails()
  }, [])

  return profile ? (
    <UserInfoProvider profile={profile}>
      <header className={`bg-white`}>
        <StandardPageContainer>
          <Link href={'#skip-link-target'} className="skip-link">
            Skip to main content
          </Link>
          <Navbar />
        </StandardPageContainer>
      </header>
      <main>
        {pathname === '/courses' && (
          <Image
            // TODO pull image from backend
            src={
              'https://www.ubc.ca/_assets/img/our-campuses/ubco-aerials-our-campus_1920x700.jpg'
            }
            alt="Organization Banner"
            className="h-[20vh] w-full object-cover object-center"
            width={100}
            height={100}
            priority
            unoptimized={true}
          />
        )}
        <StandardPageContainer>
          <div>{children}</div>
        </StandardPageContainer>
      </main>
    </UserInfoProvider>
  ) : (
    <Spin />
  )
}

export default Layout
