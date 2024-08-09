import { API } from '@/app/api'
import {
  GetOrganizationResponse,
  OrganizationCourseResponse,
} from '@koh/common'
import { Button, message } from 'antd'

type ArchiveCourseProps = {
  courseData: OrganizationCourseResponse
  organization: GetOrganizationResponse
  fetchCourseData: () => void
}

const ArchiveCourse: React.FC<ArchiveCourseProps> = ({
  courseData,
  organization,
  fetchCourseData,
}) => {
  const updateCourseAccess = async () => {
    await API.organizations
      .updateCourseAccess(organization.id, Number(courseData.courseId))
      .then(() => {
        message.success('Course access was updated')
        fetchCourseData()
      })
      .catch((error) => {
        const errorMessage = error.response.data.message

        message.error(errorMessage)
      })
  }

  return (
    <div className="flex flex-col items-center md:flex-row">
      <div className="mb-2 w-full md:mr-4 md:w-5/6 md:text-left">
        <strong>
          {courseData.course?.enabled ? 'Archive Course' : 'Re-archive Course'}
        </strong>
        <div className="mb-0">
          {courseData.course?.enabled
            ? 'Once you archive a course, the course will only be visible to course professor and TA, and admin.'
            : 'Once you re-archive a course, the course will be visible to all members of the organization.'}
        </div>
      </div>
      <Button danger className="w-full md:w-auto" onClick={updateCourseAccess}>
        {courseData.course?.enabled ? 'Archive Course' : 'Re-archive Course'}
      </Button>
    </div>
  )
}

export default ArchiveCourse
