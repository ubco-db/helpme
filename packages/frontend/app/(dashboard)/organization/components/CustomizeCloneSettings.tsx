import {
  BatchCourseCloneAttributes,
  CourseCloneAttributes,
  CourseResponse,
  GetOrganizationResponse,
} from '@koh/common'
import Table, { ColumnsType } from 'antd/es/table'
import React, { useEffect, useMemo, useState } from 'react'
import { Form, Button, message, notification } from 'antd'
import CourseCloneForm from '../../components/CourseCloneForm'
interface CustomizeCloneSettingsProps {
  courses: CourseResponse[]
  selectedCourseIds: number[]
  defaultCloneSettings: CourseCloneAttributes
  customCloneSettings: BatchCourseCloneAttributes
  setCustomCloneSettings: (settings: BatchCourseCloneAttributes) => void
  organization: GetOrganizationResponse
}

const CustomizeCloneSettings: React.FC<CustomizeCloneSettingsProps> = ({
  courses,
  selectedCourseIds,
  defaultCloneSettings,
  customCloneSettings,
  setCustomCloneSettings,
  organization,
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [isSelectedCourseSaved, setIsSelectedCourseSaved] =
    useState<boolean>(true)
  const [form] = Form.useForm()

  useEffect(() => {
    const updatedSettings: BatchCourseCloneAttributes = {}

    selectedCourseIds.forEach((courseId) => {
      const course = courses.find((course) => course.courseId === courseId)
      if (course) {
        updatedSettings[courseId] = {
          ...updatedSettings,
          ...defaultCloneSettings,
        }
      }
    })
    setCustomCloneSettings(updatedSettings)
  }, [selectedCourseIds, defaultCloneSettings])

  // Update form values when selected course changes
  useEffect(() => {
    if (selectedCourseId && customCloneSettings[selectedCourseId]) {
      form.setFieldsValue(customCloneSettings[selectedCourseId])
    }
  }, [selectedCourseId, form, customCloneSettings])

  const handleSaveClick = () => {
    if (selectedCourseId) {
      form.validateFields().then((values) => {
        const updatedSettings = {
          ...customCloneSettings,
          [selectedCourseId]: {
            ...customCloneSettings[selectedCourseId],
            ...values,
          },
        }
        setCustomCloneSettings(updatedSettings)
        setIsSelectedCourseSaved(true)
        message.success(
          `Saved changes to clone configuration for: ${courses.find((course) => course.courseId === selectedCourseId)?.courseName || 'selected course'}`,
        )
      })
    }
  }

  const columns: ColumnsType<CourseResponse> = [
    {
      title: 'CourseName',
      dataIndex: 'courseName',
      key: 'courseName',
      align: 'left',
      render: (text: string, course: CourseResponse) => (
        <div
          className="h-full w-full"
          onClick={() => {
            if (!isSelectedCourseSaved) {
              notification.open({
                message: 'One second...',
                duration: 0,
                description:
                  'Please save your current changes before viewing another course.',
                key: 'course_not_saved_notification',
                btn: (
                  <div className="flex gap-2">
                    <Button
                      size="small"
                      onClick={() => {
                        handleSaveClick()
                        notification.destroy('course_not_saved_notification')
                        setSelectedCourseId(course.courseId)
                      }}
                      type="primary"
                    >
                      Save
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        // Without hitting the save button, the previous settings will already be set
                        notification.destroy('course_not_saved_notification')
                        setIsSelectedCourseSaved(true)
                        setSelectedCourseId(course.courseId)
                      }}
                    >
                      Revert to Previous
                    </Button>
                  </div>
                ),
              })
            } else {
              setSelectedCourseId(course.courseId)
            }
          }}
        >
          {text}
        </div>
      ),
    },
  ]

  const selectedCourses = useMemo(
    () =>
      courses.filter((course) => selectedCourseIds.includes(course.courseId)),
    [courses, selectedCourseIds],
  )
  return (
    <div className="relative flex h-full gap-2">
      <div className="flex w-1/3">
        <Table
          dataSource={selectedCourses}
          columns={columns}
          size="small"
          className="w-full"
          showHeader={false}
          pagination={selectedCourses.length > 16 ? { pageSize: 16 } : false}
          rowClassName={(record) =>
            record.courseId === selectedCourseId
              ? 'bg-helpmeblue text-white hover:text-black'
              : 'bg-white hover:cursor-pointer'
          }
        />
      </div>
      <div className="absolute left-1/3 h-full w-0.5 translate-x-1.5 transform bg-gray-300"></div>
      <div className="h-full w-2/3 overflow-y-auto pl-4">
        {selectedCourseId ? (
          <div>
            <h2 className="mb-4">
              Finalize Specific Clone Settings for:{' '}
              {
                selectedCourses.find((c) => c.courseId === selectedCourseId)
                  ?.courseName
              }
            </h2>
            <CourseCloneForm
              form={form}
              isAdmin={true}
              organization={organization}
              courseSemesterId={-1}
              courseSectionGroupName={' '}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            Select a course to customize clone settings
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomizeCloneSettings
