import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import {
  GetOrganizationResponse,
  OrganizationCourseResponse,
} from '@koh/common'
import { Button, message, Popconfirm } from 'antd'

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
  const { userInfo, setUserInfo } = useUserInfo()

  const updateCourseAccess = async () => {
    await API.organizations
      .updateCourseAccess(organization.id, Number(courseData.courseId))
      .then(() => {
        message.success('Course access was updated')
        fetchCourseData()
      })
      .catch((error) => {
        const errorMessage = getErrorMessage(error)
        message.error(errorMessage)
      })
  }

  return (
    <div className="flex flex-col items-center md:flex-row">
      <div className="mb-2 w-full md:mr-4 md:w-5/6 md:text-left">
        <strong>
          {courseData.course?.enabled ? 'Archive Course' : 'Unarchive Course'}
        </strong>
        <div className="mb-0">
          {courseData.course?.enabled
            ? 'Once you archive a course, the course will only be visible to the course professor as well as admins.'
            : 'Once you unarchive a course, the course will once again be visible to all members of the organization.'}
        </div>
      </div>
      <Popconfirm
        title={`Are you sure you want to ${
          courseData.course?.enabled ? 'archive' : 'unarchive'
        } this course?`}
        onConfirm={updateCourseAccess}
        okText="Yes"
        cancelText="No"
      >
        <Button
          danger={courseData.course?.enabled}
          className="w-full md:w-auto"
        >
          {courseData.course?.enabled ? 'Archive Course' : 'Unarchive Course'}
        </Button>
      </Popconfirm>
    </div>
  )
}

export default ArchiveCourse
