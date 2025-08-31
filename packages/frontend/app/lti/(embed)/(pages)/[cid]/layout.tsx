'use client'
import { use, useEffect, useMemo, useState } from 'react'

import { useLtiContext } from '@/app/contexts/LtiContext'
import { API } from '@/app/api'
import { CourseSettingsResponse, GetCourseResponse } from '@koh/common'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { LtiCourseProvider } from '@/app/contexts/LtiCourseContext'

type Params = Promise<{ cid: string }>

export default function Layout(props: {
  children: React.ReactNode
  params: Params
}) {
  const params = use(props.params)

  const { children } = props

  const { cid } = params
  const courseId = Number(cid)

  const { authToken } = useLtiContext()
  const customAPI = useMemo(() => API.withAuthorization(authToken), [authToken])

  const [course, setCourse] = useState<GetCourseResponse>()
  const [courseFeatures, setCourseFeatures] = useState<CourseSettingsResponse>()
  const [getCourseError, setGetCourseError] = useState<string>()

  useEffect(() => {
    const getData = async () => {
      let succeeded = false
      await customAPI.course
        .get(courseId)
        .then((course) => {
          setCourse(course)
          succeeded = true
        })
        .catch((err) => {
          setGetCourseError(getErrorMessage(err))
        })
      if (succeeded) {
        await customAPI.course
          .getCourseFeatures(courseId)
          .then((courseFeatures) => {
            setCourseFeatures(courseFeatures)
          })
          .catch((_) => {})
      }
    }
    getData()
  }, [courseId])

  if (getCourseError) {
    return (
      <div className="flex h-[100vh] w-full flex-grow items-center">
        <div
          className={
            'w-full rounded-md border-red-500 bg-red-200 p-4 text-center text-lg text-red-700'
          }
        >
          <p className={'text-xl font-semibold'}>Failed to Load Page</p>
          <p>{getCourseError}</p>
        </div>
      </div>
    )
  }

  return (
    <LtiCourseProvider
      courseId={courseId}
      course={course}
      courseFeatures={courseFeatures}
    >
      {children}
    </LtiCourseProvider>
  )
}
