import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import {
  GetOrganizationResponse,
  OrganizationCourseResponse,
} from '@koh/common'
import { Button, message, Popconfirm, Checkbox } from 'antd'
import { useState } from 'react'

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
  const [deleteChatbotDocs, setDeleteChatbotDocs] = useState(true)
  const [deleteLMSIntegration, setDeleteLMSIntegration] = useState(true)
  const [permanentlyDelete, setPermanentlyDelete] = useState(false)

  const updateCourseAccess = async () => {
    const archiveOptions = courseData.course?.enabled
      ? {
          deleteChatbotDocs,
          deleteLMSIntegration,
          permanentlyDelete,
        }
      : undefined

    await API.organizations
      .updateCourseAccess(
        organization.id,
        Number(courseData.courseId),
        archiveOptions,
      )
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
    <div className="flex flex-col">
      <div className="mb-4">
        <strong>
          {courseData.course?.enabled ? 'Archive Course' : 'Unarchive Course'}
        </strong>
        <div className="mb-0">
          {courseData.course?.enabled
            ? 'Once you archive a course, the course will only be visible to the course professor as well as admins.'
            : 'Once you unarchive a course, the course will once again be visible to all members of the organization.'}
        </div>
      </div>

      {courseData.course?.enabled && (
        <div className="mb-4 rounded border border-gray-300 bg-gray-50 p-4">
          <div className="mb-2 text-sm font-medium text-gray-700">
            Archive Options:
          </div>
          <div className="space-y-2">
            <div>
              <Checkbox
                checked={deleteChatbotDocs}
                onChange={(e) => setDeleteChatbotDocs(e.target.checked)}
              >
                <span className="text-sm">
                  Delete chatbot documents (saves server space)
                </span>
              </Checkbox>
            </div>
            <div>
              <Checkbox
                checked={deleteLMSIntegration}
                onChange={(e) => setDeleteLMSIntegration(e.target.checked)}
              >
                <span className="text-sm">Delete LMS integration</span>
              </Checkbox>
            </div>
            <div>
              <Checkbox
                checked={permanentlyDelete}
                onChange={(e) => setPermanentlyDelete(e.target.checked)}
              >
                <span className="text-sm text-red-600">
                  Permanently delete course (cannot be undone)
                </span>
              </Checkbox>
            </div>
          </div>
        </div>
      )}

      <Popconfirm
        title={`Are you sure you want to ${
          courseData.course?.enabled ? 'archive' : 'unarchive'
        } this course?`}
        description={
          courseData.course?.enabled && permanentlyDelete
            ? 'WARNING: This will permanently delete the course and cannot be undone!'
            : undefined
        }
        onConfirm={updateCourseAccess}
        okText="Yes"
        cancelText="No"
        okButtonProps={
          courseData.course?.enabled && permanentlyDelete
            ? { danger: true }
            : undefined
        }
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
