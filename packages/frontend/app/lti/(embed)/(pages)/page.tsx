'use client'

import React, { ReactElement, useEffect, useState } from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import { Empty, message } from 'antd'
import CoursesSection from '@/app/(dashboard)/components/coursesSection'
import Image from 'next/image'
import { API } from '@/app/api'
import { SemesterPartial } from '@koh/common'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LtiLandingPage(): ReactElement {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const cid = searchParams.get('cid')
    if (cid) {
      const newSearchParams = new URLSearchParams()
      searchParams.forEach((v, k) =>
        k != 'cid' ? newSearchParams.set(k, v) : '',
      )
      router.push(
        `/lti/${cid}${newSearchParams.size > 0 ? newSearchParams.toString() : ''}`,
      )
    }
  }, [router, searchParams])

  const { userInfo } = useUserInfo()

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
  }, [userInfo.organization?.orgId])

  return (
    <>
      <div className="mt-4 flex items-center rounded-[10px] bg-white p-3 shadow md:text-left lg:p-5 xl:max-w-[1500px]">
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
      </div>
      <div className="mt-5 flex items-center justify-between align-middle">
        <h1 className="mt-0">My Courses</h1>
      </div>
      <div className="flex min-h-96 items-start justify-center">
        {userInfo?.courses?.filter((userCourse) => userCourse.course.enabled)
          .length === 0 ? (
          <Empty
            className="max-h-min"
            description="You are not enrolled in any courses"
          />
        ) : (
          <CoursesSection
            semesters={semesters}
            enabledTableView={false}
            ltiView={true}
          />
        )}
      </div>
    </>
  )
}
