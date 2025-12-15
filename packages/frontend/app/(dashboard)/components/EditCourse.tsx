'use client'

import { API } from '@/app/api'
import {
  GetOrganizationResponse,
  OrganizationCourseResponse,
  Role,
  User,
} from '@koh/common'
import { Card, message, Tooltip } from 'antd'
import { useEffect, useState } from 'react'
import EditCourseForm from './EditCourseForm'
import ArchiveCourse from './ArchiveCourse'
import { useRouter } from 'next/navigation'
import CourseInviteCode from './CourseInviteCode'
import CourseFeaturesForm from './CourseFeaturesForm'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useUserInfo } from '@/app/contexts/userContext'
import { QuestionCircleOutlined } from '@ant-design/icons'
import CourseCloneFormModal from './CourseCloneFormModal'
import { useOrganizationSettings } from '@/app/hooks/useOrganizationSettings'
import { checkCourseCreatePermissions } from '@/app/utils/generalUtils'

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
  const organizationSettings = useOrganizationSettings(organization.id)
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

    // Added since this is the endpoint contacted to fetch new course data
    setUserInfo({
      ...userInfo,
      courses: userInfo.courses.map((uc) =>
        uc.course.id === response.course!.id
          ? {
              course: {
                id: response.course!.id,
                name: response.course!.name,
                semesterId: response.course!.semester?.id,
                enabled: response.course!.enabled,
                sectionGroupName: response.course!.sectionGroupName,
              },
              role: Role.PROFESSOR,
              favourited: uc.favourited,
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
        <Card variant="outlined" title="Edit Course">
          <EditCourseForm
            courseData={courseData}
            organization={organization}
            fetchCourseData={fetchCourseData}
            user={user}
          />
        </Card>

        {featuresEnabled && (
          <>
            <Card variant="outlined" title="Course Features">
              <CourseFeaturesForm courseData={courseData} />
            </Card>

            <Card
              variant="outlined"
              title={
                <div className="flex items-center justify-start gap-3">
                  <div>Course Invite Link</div>
                  <div className="text-gray-500">
                    <Tooltip
                      title={
                        <div className="flex flex-col gap-y-2">
                          <p>
                            This is the invite link for the course. Once
                            enabled, you can copy the link and share it with
                            your students (e.g. Syllabus, Announcement, Lab
                            sheet) or print the QR code.
                          </p>
                          <p>
                            Later on, once all your students have joined, you
                            can choose to disable the link.
                          </p>
                          <p>
                            You may also regenerate a new link in case it was
                            leaked.
                          </p>
                        </div>
                      }
                    >
                      Help <QuestionCircleOutlined />
                    </Tooltip>
                  </div>
                </div>
              }
            >
              <CourseInviteCode
                fetchCourseData={fetchCourseData}
                courseData={courseData}
              />
            </Card>
          </>
        )}

        {checkCourseCreatePermissions(userInfo, organizationSettings) && (
          <Card variant="outlined" title="Clone Course">
            <CourseCloneFormModal
              organization={organization}
              courseId={courseData.course?.id ?? -1}
              courseSectionGroupName={courseData.course?.sectionGroupName ?? ''}
              courseSemesterId={courseData.course?.semester?.id ?? -1}
            />
          </Card>
        )}

        <Card
          variant="outlined"
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
