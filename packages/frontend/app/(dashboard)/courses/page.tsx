/* eslint-disable @next/next/no-img-element */
'use client'

import { ReactElement, useEffect } from 'react'
import { Button, Empty } from 'antd'
import { OrganizationRole } from '@/app/typings/user'
import { useUserInfo } from '@/app/contexts/userContext'
import CoursesSection from '../components/coursesSection'
import OrganizationCard from '../components/organizationCard'

export default function CoursesPage(): ReactElement {
  const { userInfo } = useUserInfo()

  useEffect(() => {
    document.title = 'Courses'
  }, [])

  return (
    <>
      <OrganizationCard>
        <img
          src={`/api/v1/organization/${userInfo?.organization?.orgId}/get_logo/${userInfo?.organization?.organizationLogoUrl}`}
          className="h-15 object-contain object-center p-1"
          alt="Organization Logo"
          width={100}
          height={100}
        />
        <div>
          <h1>{userInfo?.organization?.organizationName}</h1>
          <p className="my-0">
            {userInfo?.organization?.organizationDescription}
          </p>
        </div>
      </OrganizationCard>
      <div className="mt-5 flex items-center justify-between align-middle">
        <h1 className="mt-0">My Courses</h1>
        {(userInfo?.organization?.organizationRole ===
          OrganizationRole.PROFESSOR ||
          userInfo?.organization?.organizationRole ===
            OrganizationRole.ADMIN) && (
          <Button type="primary" href={`organization/course/add`}>
            Add New Course
          </Button>
        )}
      </div>
      {userInfo?.courses?.length === 0 ? (
        <Empty description="You are not enrolled in any course" />
      ) : (
        <CoursesSection courses={userInfo.courses} />
      )}
    </>
  )
}
