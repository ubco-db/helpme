'use client'

import { ReactElement } from 'react'
import { Button, Empty } from 'antd'
import { OrganizationRole } from '@/app/typings/user'
import { useUserInfo } from '@/app/contexts/userContext'

export default function CoursesPage(): ReactElement {
  const { userInfo } = useUserInfo()

  return (
    <>
      <div className="flex items-center justify-between">
        <h1>My Courses</h1>
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
        <></>
      )}
    </>
  )
}
