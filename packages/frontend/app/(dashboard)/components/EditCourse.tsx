'use client'

import { API } from '@/app/api'
import {
  GetOrganizationResponse,
  OrganizationCourseResponse,
  Role,
  User,
  UserCourse,
} from '@koh/common'
import { Card, message } from 'antd'
import { useEffect, useState } from 'react'
import EditCourseForm from './EditCourseForm'
import ArchiveCourse from './ArchiveCourse'
import { useRouter } from 'next/navigation'
import CourseInviteCode from './CourseInviteCode'
import CourseFeaturesForm from './CourseFeaturesForm'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import CourseCloneForm from './CourseCloneForm'
import { useUserInfo } from '@/app/contexts/userContext'

type EditCourseProps = {
  courseId: number
  organization: GetOrganizationResponse
  user: User
}

const EditCourse: React.FC<EditCourseProps> = ({
  courseId,
  organization,
  user,
}) => {
  const [courseData, setCourseData] = useState<OrganizationCourseResponse>()
  const [featuresEnabled, setFeaturesEnabled] = useState(false)
  const { userInfo, setUserInfo } = useUserInfo()

  const router = useRouter()

  const fetchCourseData = async () => {
    const response: OrganizationCourseResponse | null = await API.organizations
      .getCourse(organization.id, courseId)
      .catch((error) => {
        message.error(error.response.data.message)

        setTimeout(() => {
          router.back()
        }, 1_500)
        return null
      })

    if (!response) return

    setCourseData(response)

    setUserInfo({
      ...userInfo,
      courses: userInfo.courses.map((uc) =>
        uc.course.id === response.course!.id
          ? {
              course: {
                id: response.course!.id,
                name: response.course!.name,
                semesterId: response.course!.semester?.id,
                enabled: true,
              },
              role: 'professor' as Role,
            }
          : uc,
      ),
    })
  }

  const checkFeaturesDisabled = async () => {
    if (user.courses.length === 0) {
      setFeaturesEnabled(false)
      return
    }

    const isUserInCourse = user.courses.find(
      (course) => course.course.id === courseId,
    )

    if (isUserInCourse) {
      setFeaturesEnabled(true)
    }
  }

  useEffect(() => {
    fetchCourseData()
    checkFeaturesDisabled()
  }, [])

  return courseData ? (
    <>
      <title>{`HelpMe | Editing ${courseData.course?.name}`}</title>
      <div className="mb-5 space-y-5">
        <Card bordered={true} title="Edit Course">
          <EditCourseForm
            courseData={courseData}
            organization={organization}
            fetchCourseData={fetchCourseData}
            user={user}
          />
        </Card>

        {featuresEnabled && (
          <>
            <Card bordered={true} title="Course Features">
              <CourseFeaturesForm courseData={courseData} />
            </Card>

            <Card bordered={true} title="Course Invite Link">
              <CourseInviteCode
                fetchCourseData={fetchCourseData}
                courseData={courseData}
              />
            </Card>
          </>
        )}

        <Card bordered={true} title="Clone Course">
          <CourseCloneForm
            organization={organization}
            courseId={courseData.courseId as number}
            user={user}
          />
        </Card>

        <Card
          bordered={true}
          title="Danger Zone"
          className="border-2 border-rose-500/[.35]"
        >
          <ArchiveCourse
            courseData={courseData}
            organization={organization}
            fetchCourseData={fetchCourseData}
          />
        </Card>
      </div>
    </>
  ) : (
    <CenteredSpinner tip="Loading course..." />
  )
}

export default EditCourse
