import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import {
  GetOrganizationResponse,
  OrganizationCourseResponse,
} from '@koh/common'
import { Button, message, Popconfirm } from 'antd'
import { useRouter } from 'next/navigation'

type DeleteCourseProps = {
  courseData: OrganizationCourseResponse
  organization: GetOrganizationResponse
}

const DeleteCourse: React.FC<DeleteCourseProps> = ({
  courseData,
  organization,
}) => {
  const router = useRouter()

  const handleDelete = async () => {
    await API.organizations
      .deleteCourse(organization.id, Number(courseData.courseId))
      .then(() => {
        message.success('Course deleted')
        router.push('/courses')
      })
      .catch((error) => {
        const errorMessage = getErrorMessage(error)
        message.error(errorMessage)
      })
  }

  return (
    <div className="flex flex-col items-center md:flex-row">
      <div className="mb-2 w-full md:mr-4 md:w-5/6 md:text-left">
        <strong className="text-red-600">Permanently Delete Course</strong>
        <div className="mb-0">
          This will permanently delete the course and all associated data
          (queues, questions, chatbot data, etc). This cannot be undone. Only
          use this if you accidentally created the course.
        </div>
      </div>
      <Popconfirm
        title="Are you sure you want to permanently delete this course?"
        description="This action cannot be undone."
        onConfirm={handleDelete}
        okText="Yes, Delete"
        cancelText="Cancel"
        okButtonProps={{ danger: true }}
      >
        <Button danger type="primary" className="w-full md:w-auto">
          Delete Course
        </Button>
      </Popconfirm>
    </div>
  )
}

export default DeleteCourse
