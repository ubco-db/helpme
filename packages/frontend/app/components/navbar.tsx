'use client'

import React from 'react'
import Image from 'next/image'
import { useUserInfo } from '@/app/contexts/userContext'

const Navbar: React.FC = () => {
  const { userInfo } = useUserInfo()

  return (
    <div className="my-1 flex h-16 items-center p-0">
      <div className="mr-5 flex items-center">
        <div className="color-[#262626] flex items-center align-middle text-xl font-medium capitalize">
          {userInfo?.organization && (
            <a href="/courses" aria-disabled="true" tabIndex={-1}>
              <Image
                width={100}
                height={100}
                className="h-16 w-full object-contain"
                alt="Organization Logo"
                src={`https://ires.ubc.ca/files/2020/02/ubc-logo.png`}
              />
            </a>
          )}
          <span className="ml-x">
            {userInfo?.organization?.organizationName}
          </span>
        </div>
      </div>
    </div>
  )
}

export default Navbar
