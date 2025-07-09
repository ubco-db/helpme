'use client'

import { ReactElement, useEffect, useState } from 'react'
import { Alert, Button, Empty, message, Segmented } from 'antd'
import { useUserInfo } from '@/app/contexts/userContext'
import CoursesSection from '../components/coursesSection'
import OrganizationCard from '../components/organizationCard'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { AppstoreOutlined, BarsOutlined } from '@ant-design/icons'
import ArchivedCoursesSection from '../components/ArchivedCoursesSection'
import { API } from '@/app/api'
import { SemesterPartial } from '@koh/common'
import { useOrganizationSettings } from '@/app/hooks/useOrganizationSettings'
import { checkCourseCreatePermissions } from '@/app/utils/generalUtils'

export default function CoursesPage(): ReactElement {
  const { userInfo } = useUserInfo()
  const searchParams = useSearchParams()
  const error = searchParams.get('err')
  const organizationSettings = useOrganizationSettings(
    userInfo?.organization?.orgId ?? -1,
  )

  // Initialize enabledTableView from localStorage
  const [enabledTableView, setEnabledTableView] = useState(() => {
    if (typeof window !== 'undefined') {
      const storedValue = localStorage.getItem('enabledTableView')
      return storedValue === 'true'
    }
    return false
  })
  const [semesters, setSemesters] = useState<SemesterPartial[]>([])

  useEffect(() => {
    API.semesters
      .get(userInfo.organization?.orgId || -1)
      .then((semesters) => {
        setSemesters(semesters)
      })
      .catch((error) => {
        console.error(error)
        message.error(
          'Failed to fetch semesters for organization with id: ' +
            userInfo.organization?.orgId,
        )
      })
  }, [])

  return (
    <>
      <title>HelpMe | My Courses</title>
      <OrganizationCard>
        <Image
          src={`/api/v1/organization/${userInfo?.organization?.orgId}/get_logo/${userInfo?.organization?.organizationLogoUrl}`}
          className="mr-2 max-h-20 object-contain object-center p-1 md:max-h-80"
          alt="Organization Logo"
          width={80}
          height={80}
        />
        <div>
          <h1>{userInfo?.organization?.organizationName}</h1>
          <p className="my-0">
            {userInfo?.organization?.organizationDescription}
          </p>
        </div>
      </OrganizationCard>
      {error && (
        <Alert
          description
          className="my-2"
          message={
            'Error Joining Queue: ' +
            (error === 'notInCourse'
              ? 'You must be a member of that course to join that queue'
              : error === 'inviteNotFound'
                ? 'That queue invite has been deleted or does not exist. If you believe this is an error, please contact your professor.'
                : error === 'courseNotFound'
                  ? 'That course has been deleted or does not exist'
                  : error === 'badCourseInviteCode'
                    ? 'Unable to enroll in course as the course does not have a course invite code set. If you believe this is an error, please contact your professor.'
                    : `An unexpected error occurred: ${error}`)
          }
          type="warning"
          showIcon
          closable
        />
      )}
      <div className="mt-5 flex items-center justify-between align-middle">
        <h1 className="mt-0">My Courses</h1>
        <div className="flex flex-col items-end justify-between gap-2 md:flex-row md:items-center">
          {checkCourseCreatePermissions(userInfo, organizationSettings) && (
            <Button type="primary" href={`organization/course/add`}>
              Add New Course
            </Button>
          )}
          <Segmented
            options={[
              { value: false, icon: <AppstoreOutlined />, title: 'Card View' },
              { value: true, icon: <BarsOutlined />, title: 'Table View' },
            ]}
            defaultValue={enabledTableView}
            onChange={(value) => {
              setEnabledTableView(value)
              if (typeof window !== 'undefined') {
                localStorage.setItem('enabledTableView', value.toString())
              }
            }}
          />
        </div>
      </div>
      <div className="flex min-h-96 items-start justify-center">
        {userInfo?.courses?.filter((userCourse) => userCourse.course.enabled)
          .length === 0 ? (
          <Empty
            className="max-h-min"
            description="You are not enrolled in any course"
          />
        ) : (
          <CoursesSection
            semesters={semesters}
            enabledTableView={enabledTableView}
          />
        )}
      </div>
      {userInfo?.courses?.filter((userCourse) => !userCourse.course.enabled)
        .length !== 0 && (
        <ArchivedCoursesSection
          archivedCourses={userInfo.courses.filter(
            (userCourse) => !userCourse.course.enabled,
          )}
          semesters={semesters}
        />
      )}
    </>
  )
}
