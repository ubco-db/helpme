'use client'

import React, { ReactElement, useEffect, useState } from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import { Alert, Empty, message } from 'antd'
import CoursesSection from '@/app/(dashboard)/components/coursesSection'
import Image from 'next/image'
import { API } from '@/app/api'
import { LMSIntegrationPlatform, SemesterPartial } from '@koh/common'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSessionStorage } from '@/app/hooks/useSessionStorage'

export default function LtiLandingPage(): ReactElement {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [shouldClose, setShouldClose] = useState(false)
  const [lmsInfo, setLmsInfo] = useSessionStorage<{
    apiCourseId: string
    platform: LMSIntegrationPlatform
  }>('lms_info', null)

  function checkForceClose() {
    if (
      window &&
      window.self == window.top &&
      searchParams.get('force_close')
    ) {
      window.self.close()
      setShouldClose(true)
    }
  }

  useEffect(() => {
    checkForceClose()
  }, [window, window.self, window.top, searchParams])

  useEffect(() => {
    checkForceClose()
  }, [])

  useEffect(() => {
    if (shouldClose) return
    const platform = searchParams.get('lms_platform')
    const apiCourseId = searchParams.get('api_course_id')
    if (platform && apiCourseId) {
      setLmsInfo({ platform: platform as LMSIntegrationPlatform, apiCourseId })
    }
    const cid = searchParams.get('cid')
    if (cid) {
      const newSearchParams = new URLSearchParams()
      searchParams.forEach((v, k) =>
        k != 'cid' ? newSearchParams.set(k, v) : '',
      )
      router.push(
        `/lti/${cid}${newSearchParams.size > 0 ? '?' + newSearchParams.toString() : ''}`,
      )
    } else {
      router.push(pathname)
    }
  }, [router, searchParams])

  const { userInfo } = useUserInfo()

  const [semesters, setSemesters] = useState<SemesterPartial[]>([])

  useEffect(() => {
    if (shouldClose) return
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

  if (shouldClose) {
    return (
      <main
        className={'container mx-auto h-auto w-full max-w-lg pt-10 text-center'}
      >
        <title>HelpMe | Reload page</title>
        <div className="container mx-auto h-auto w-full pt-10 text-center">
          <Alert
            message="End Session"
            description="This tab/window should close automatically. Please close this tab/window and return to the LTI launch on the platform."
            type="info"
          />
        </div>
      </main>
    )
  }

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
            description={
              <div className={'flex w-full justify-center'}>
                <div className={'flex w-1/4 flex-col gap-2'}>
                  <p className={'font-semibold'}>
                    You are not enrolled in any courses.
                  </p>
                  {lmsInfo && lmsInfo.platform && (
                    <>
                      <p>
                        This page is being displayed in {lmsInfo.platform}. The
                        course in {lmsInfo.platform} it is being displayed for
                        may be linked with a HelpMe equivalent. Try refreshing
                        the page.
                      </p>
                      <p>
                        If refreshing the page does not work, contact your
                        instructor to ask them to connect their HelpMe course
                        with this {lmsInfo.platform} course so you can be
                        automatically added to their course.
                      </p>
                      <p>
                        If you&#39;re logged into an account which does not
                        share the same email as your {lmsInfo.platform} account,
                        the above options will not work. Ask your instructor for
                        an invite link to their HelpMe course.
                      </p>
                    </>
                  )}
                </div>
              </div>
            }
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
