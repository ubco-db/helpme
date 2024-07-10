'use client'

import React, { useEffect, useState } from 'react'
import { UserInfoProvider } from '../contexts/userContext'
import { User } from '@koh/common'
import { userApi } from '../api/userApi'
import Image from 'next/image'
import Link from 'next/link'
import { Col, Row, Spin } from 'antd'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [profile, setProfile] = useState<User>()

  useEffect(() => {
    const fetchUserDetails = async () => {
      const userDetails = await userApi.getUser()
      const response = await userDetails.json()

      setProfile(response)
    }

    fetchUserDetails()
  }, [])

  return profile ? (
    <UserInfoProvider>
      {/* Stand Page Container Component */}
      <div>
        <Link href={'#first-course-button'} className="skip-link">
          Skip to main content
        </Link>
      </div>
      <Image
        src={`/api/v1/organization/${profile?.organization?.orgId}/get_banner/${profile?.organization?.organizationBannerUrl}`}
        width={100}
        height={100}
        alt="Organization Banner"
        style={{
          width: '100%',
          height: '20vh',
          objectFit: 'cover',
          objectPosition: 'center',
        }}
      />

      {/* <OrganizationCard> */}
      <Row
        gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}
        style={{ alignItems: 'center' }}
      >
        <Col xs={{ span: 24 }} sm={{ span: 3 }}>
          <Image
            src={`/api/v1/organization/${profile?.organization?.orgId}/get_logo/${profile?.organization?.organizationLogoUrl}`}
            style={{
              width: '100%',
              height: '10vh',
              objectFit: 'contain',
              objectPosition: 'center',
            }}
            alt="Organization Logo"
            width={100}
            height={100}
          />
        </Col>
        <Col xs={{ span: 24 }} sm={{ span: 21 }}>
          <h1>{profile?.organization?.organizationName}</h1>
          <p>{profile?.organization?.organizationDescription}</p>
        </Col>
      </Row>
      {/* </OrganizationCard> */}
      <div style={{ marginTop: 20 }}>{children}</div>
      {/* Stand Page Container Component */}
    </UserInfoProvider>
  ) : (
    <Spin />
  )
}

export default Layout
