'use client'

import { userApi } from '@/app/api/userApi'
import { ReactElement, useEffect, useState } from 'react'
import { User } from '@koh/common'
import { Button, Empty } from 'antd'
import { OrganizationRole } from '@/app/typings/user'

export default function CoursesPage(): ReactElement {
  return (
    <>
      <div className="flex items-center justify-between">
        <h1>My Courses</h1>
        {/* {(profile?.organization?.organizationRole ===
          OrganizationRole.PROFESSOR ||
          profile?.organization?.organizationRole ===
          OrganizationRole.ADMIN) && (
            <Button type="primary" href={`organization/course/add`}>
              Add New Course
            </Button>
          )} */}
      </div>
      {/* {profile?.courses.length === 0 ? (
        <Empty description="You are not enrolled in any course" />
      ) : (
        <></>
      )} */}
    </>
  )
}
