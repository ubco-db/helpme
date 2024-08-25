'use client'

import { message } from 'antd'
import { ReactElement, Suspense, useEffect, useState } from 'react'
import { GetLimitedCourseResponse, UBCOuserParam, User } from '@koh/common'
import { API } from '@/app/api'
import { userApi } from '../api/userApi'
import { useRouter, useSearchParams } from 'next/navigation'
import { getErrorMessage } from '../utils/generalUtils'
import CenteredSpinner from '../components/CenteredSpinner'
import InviteCard from './components/InviteCard'
import Image from 'next/image'

export default function CourseInvitePage(): ReactElement {
  const searchParams = useSearchParams()
  const router = useRouter()
  const cid = Number(searchParams.get('cid'))
  const code = decodeURIComponent(searchParams.get('code') ?? '')
  const [errorGettingCourse, setErrorGettingCourse] = useState(false)
  const [errorGettingUser, setErrorGettingUser] = useState(false)

  const [profile, setProfile] = useState<User>()
  useEffect(() => {
    const fetchUserDetails = async () => {
      const userDetails = await userApi.getUser()
      const response = await userDetails.json()
      if (response.statusCode === 401) {
        setErrorGettingUser(true)
        return
      }
      setProfile(response)
    }
    fetchUserDetails()
  }, [])

  const [course, setCourse] = useState<GetLimitedCourseResponse>()
  useEffect(() => {
    const fetchData = async () => {
      await API.course
        .getLimitedCourseResponse(cid, code)
        .then((res) => {
          setCourse(res)
          // if the user is not found, redirect to login
          // These needs to be done after getLimitedCourseResponse does its thing since that is the endpoint that sets the cookies for redirect
          if (errorGettingUser) {
            router.push('/login')
          }
        })
        .catch(() => {
          setErrorGettingCourse(true)
        })
    }
    if (cid) {
      fetchData()
    }
  }, [cid, code, errorGettingUser])

  const cardMetaTitle = `You have been invited to join '${course?.name}'`
  const cardMetaDescription = `This course is managed by ${course?.organizationCourse?.name}`

  const addStudent = async (userData: UBCOuserParam) => {
    await API.course
      .enrollByInviteCode(userData, code)
      .then(() => {
        router.push(`/course/${cid}`)
      })
      .catch((error) => {
        const errorMessage = getErrorMessage(error)
        message.error(errorMessage)
      })
  }

  if (!cid) {
    return (
      <div className="mt-20 flex items-center justify-center">
        <InviteCard
          title="Invalid Course ID in invite link. Please ensure the link is correct and try again."
          buttonLabel="Back to my courses"
          buttonAction={() => router.push('/courses')}
        />
      </div>
    )
  } else if (errorGettingCourse) {
    return (
      <div className="mt-20 flex items-center justify-center">
        <InviteCard
          title="Error: Invalid invite link code. Please ensure the link is correct and try again. Otherwise, please contact your professor."
          buttonLabel="Back to my courses"
          buttonAction={() => router.push('/courses')}
        />
      </div>
    )
  } else if (!profile) {
    return <CenteredSpinner tip="Loading User..." />
  } else if (
    profile.courses &&
    profile.courses.some((userCourse) => userCourse.course.id === cid)
  ) {
    router.push(`/course/${cid}`)
    return <CenteredSpinner tip="Redirecting..." />
  } else if (!course) {
    return <CenteredSpinner tip="Loading Course..." />
  } else {
    return (
      <Suspense>
        <title>{`HelpMe - Invitation to join '${course.name}'`}</title>
        <div className="mt-20 flex items-center justify-center">
          {profile.organization &&
          profile.organization.orgId !== course.organizationCourse?.id ? (
            <InviteCard
              // this is an edge case
              title="You cannot join a course that is not in your organization"
              buttonLabel="Back to my courses"
              buttonAction={() => {
                router.push('/courses')
              }}
            />
          ) : code !== course.courseInviteCode ? (
            <InviteCard
              title="Invalid Course Code"
              buttonLabel="Back to my courses"
              buttonAction={() => {
                router.push('/courses')
              }}
            />
          ) : (
            <InviteCard
              title={`Invitation to join '${course.name}'`}
              description={{ title: cardMetaTitle, text: cardMetaDescription }}
              buttonLabel="Accept Invitation"
              buttonAction={async () => {
                if (!profile) {
                  message.error('User not found')
                  return
                }
                const userData: UBCOuserParam = {
                  email: profile.email,
                  first_name: profile.firstName ?? '',
                  password: '',
                  last_name: profile.lastName ?? '',
                  selected_course: course.id,
                  sid: profile.sid,
                  photo_url: profile.photoURL,
                }
                await addStudent(userData)
              }}
              cover={
                <Image
                  alt="generic course image"
                  height="200"
                  width="400"
                  src="https://open-2021.sites.olt.ubc.ca/files/2020/10/OSIP-2020-Slider.jpg"
                />
              }
            />
          )}
        </div>
      </Suspense>
    )
  }
}
