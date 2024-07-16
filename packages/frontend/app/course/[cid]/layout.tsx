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
import StandardPageContainer from '@/app/components/StandardPageContainer'

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
      <StandardPageContainer>
        <Link href={'#skip-link-destination'} className="skip-link">
          Skip to main content
        </Link>
        <Navbar />
      </StandardPageContainer>
      <StandardPageContainer>
        <div>{children}</div>
      </StandardPageContainer>
    </UserInfoProvider>
  ) : (
    <Spin />
  )
}

export default Layout
