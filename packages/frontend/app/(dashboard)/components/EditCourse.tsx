'use client'

import { API } from '@/app/api'
import {
  CourseSettingsResponse,
  GetOrganizationResponse,
  OrganizationCourseResponse,
  OrganizationRole,
  Role,
  User,
} from '@koh/common'
import { Card, Divider, message, Spin, Switch, Tooltip } from 'antd'
import { useEffect, useState } from 'react'
import EditCourseForm from './EditCourseForm'
import ArchiveCourse from './ArchiveCourse'
import DeleteCourse from './DeleteCourse'
import { useRouter } from 'next/navigation'
import CourseInviteCode from './CourseInviteCode'
import CourseFeaturesForm from './CourseFeaturesForm'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useUserInfo } from '@/app/contexts/userContext'
import { QuestionCircleOutlined } from '@ant-design/icons'
import CourseCloneFormModal from './CourseCloneFormModal'
import { useOrganizationSettings } from '@/app/hooks/useOrganizationSettings'
import { checkCourseCreatePermissions } from '@/app/utils/generalUtils'
import ProfInvites from './ProfInvites'
import CourseFeatureSwitch from './CourseFeatureSwitch'

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
  const { userInfo, setUserInfo } = useUserInfo()
  const [courseFeatures, setCourseFeatures] = useState<CourseSettingsResponse>()
  useEffect(() => {
    const fetchFeatures = async () => {
      await API.course
        .getCourseFeatures(courseId)
        .then((features) => {
          setCourseFeatures(features)
        })
        .catch(() => undefined)
    }
    fetchFeatures()
  }, [courseId])

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

  const isUserInCourse = userInfo.courses.find(
    (course) => course.course.id === courseId,
  )

  useEffect(() => {
    fetchCourseData()
  }, [])

  return courseData ? (
    <>
      <title>{`HelpMe | Editing ${courseData.course?.name}`}</title>
      <div className="mb-5 space-y-5">
        <EditCourseForm
          courseData={courseData}
          organization={organization}
          fetchCourseData={fetchCourseData}
          user={user}
        />

        {isUserInCourse && (
          <Card
            variant="outlined"
            classNames={{
              body: 'p-2 md:p-4 lg:p-6',
            }}
            title={
              <div className="flex items-center justify-start gap-3">
                <h3>Course Invite Link</h3>
                <div className="text-gray-500">
                  <Tooltip
                    title={
                      <div className="flex flex-col gap-y-2">
                        <p>
                          This is the invite link for the course. Once enabled,
                          you can copy the link and share it with your students
                          (e.g. Syllabus, Announcement, Lab sheet) or print the
                          QR code.
                        </p>
                        <p>
                          Later on, once all your students have joined, you can
                          choose to disable the link.
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
        )}

        {isUserInCourse && (
          <Card
            variant="outlined"
            title="Course Features"
            classNames={{
              body: 'flex justify-center p-2 md:p-4 lg:p-6',
            }}
          >
            <CourseFeaturesForm courseData={courseData} />
          </Card>
        )}

        <Divider>Advanced</Divider>

        {(user.organization?.organizationRole === OrganizationRole.ADMIN ||
          user.organization?.organizationRole ===
            OrganizationRole.PROFESSOR) && (
          <ProfInvites courseData={courseData} />
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
          classNames={{
            body: 'p-0',
          }}
          title={
            <div className="flex w-full flex-wrap items-center justify-between p-2">
              <div className="flex items-center justify-start gap-3">
                <h3 className="text-wrap">
                  (LLED Courses Only) AI Assignment Evaluation
                </h3>
                <div className="text-gray-500">
                  <Tooltip
                    title={
                      <div className="flex flex-col gap-2">
                        <p>
                          When enabled, this will add a &quot;AI Assignment
                          Evaluation&quot; tool that can be access from the
                          Course Home page. This will allow students to upload
                          their assignments/essays to get some AI feedback.
                        </p>
                        <p>Does NOT utilize uploaded Chatbot materials yet.</p>
                        <p>
                          Only hardcoded for LLED Courses for now since it was
                          easier to implement - but if enough professors show
                          interest, it can be adapted to be more generalizable.
                          You can find a video of the feature{' '}
                          <a
                            href="https://github.com/ubco-db/helpme/pull/546#issuecomment-4416714212"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            here
                          </a>
                          . Contact <a href="mailto:adam.fipke@ubc.ca">Adam</a>{' '}
                          for more details.
                        </p>
                      </div>
                    }
                  >
                    Help <QuestionCircleOutlined />
                  </Tooltip>
                </div>
              </div>
              <div className="xl:mr-8">
                {courseFeatures ? (
                  <CourseFeatureSwitch
                    featureName="assignmentEvaluationEnabled"
                    defaultChecked={courseFeatures.assignmentEvaluationEnabled}
                    title="Enable Feature"
                    className="font-normal"
                    courseId={courseId}
                  />
                ) : (
                  <Spin size="small" />
                )}
              </div>
            </div>
          }
        />

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
          {userInfo.organization?.organizationRole ===
            OrganizationRole.ADMIN && (
            <>
              <hr className="my-4" />
              <DeleteCourse
                courseData={courseData}
                organization={organization}
              />
            </>
          )}
        </Card>
      </div>
    </>
  ) : (
    <CenteredSpinner tip="Loading course..." />
  )
}

export default EditCourse
