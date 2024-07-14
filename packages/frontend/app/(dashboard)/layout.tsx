'use client'

import React, { useEffect, useState } from 'react'
import { UserInfoProvider } from '../contexts/userContext'
import { User } from '@koh/common'
import { userApi } from '../api/userApi'
import Image from 'next/image'
import Link from 'next/link'
import { Spin } from 'antd'
import OrganizationCard from './components/organizationCard'
import StandardPageContainer from '../components/standardPageContainer'
import Navbar from '../components/navbar'
import { usePathname } from 'next/navigation'

interface LayoutProps {
  children: React.ReactNode
}

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
        <Link href={'#first-course-button'} className="skip-link">
          Skip to main content
        </Link>
        <Navbar />
      </StandardPageContainer>
      {pathname === '/courses' && (
        <Image
          // TODO pull image from backend
          src={
            'https://www.ubc.ca/_assets/img/our-campuses/ubco-aerials-our-campus_1920x700.jpg'
          }
          alt="Organization Banner"
          className="h-60 w-full object-cover object-center"
          width={100}
          height={100}
          priority
          unoptimized={true}
        />
      )}
      <StandardPageContainer>
        <div>{children}</div>
      </StandardPageContainer>
    </UserInfoProvider>
  ) : (
    <Spin />
  )
}

export default Layout
