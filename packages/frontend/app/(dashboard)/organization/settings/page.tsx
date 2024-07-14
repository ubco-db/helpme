'use client'

import { ReactElement } from 'react'
import { useUserInfo } from '@/app/contexts/userContext'

export default function OrganizationSettings(): ReactElement {
  const { userInfo } = useUserInfo()

  return (
    <>
      <div>Just a test page for navigation. Feel free to remove this dima</div>
    </>
  )
}
