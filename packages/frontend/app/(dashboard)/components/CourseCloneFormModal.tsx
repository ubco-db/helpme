'use client'

import { useMemo, useState } from 'react'
import { Button, Form, message, Modal, Popconfirm } from 'antd'
import {
  CourseCloneAttributes,
  defaultCourseCloneAttributes,
  GetOrganizationResponse,
  OrganizationRole,
  UserCourse,
} from '@koh/common'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { ExclamationCircleFilled } from '@ant-design/icons'
import { useAsyncToaster } from '@/app/contexts/AsyncToasterContext'
import CourseCloneForm from './CourseCloneForm'

type CourseCloneFormModalProps = {
  organization: GetOrganizationResponse
  courseId: number
  courseSemesterId?: number
  courseSectionGroupName: string
}

const CourseCloneFormModal: React.FC<CourseCloneFormModalProps> = ({
  organization,
  courseId,
  courseSemesterId,
  courseSectionGroupName,
}) => {
  const [visible, setVisible] = useState(false)
  const [form] = Form.useForm<CourseCloneAttributes>()
  const { userInfo, setUserInfo } = useUserInfo()
  const { runAsyncToast } = useAsyncToaster()
  const courseName = userInfo?.courses.find((uc) => uc.course.id === courseId)
    ?.course.name

  const openModal = () => {
    form.setFieldsValue(defaultCourseCloneAttributes)
    setVisible(true)
  }

  const isAdmin = useMemo(
    () =>
      userInfo &&
      userInfo.organization?.organizationRole === OrganizationRole.ADMIN,
    [userInfo],
  )

  const handleClone = async () => {
    const cloneData = form.getFieldsValue()

    if (cloneData.professorIds.length === 0) {
      if (isAdmin) {
        message.error('Please select a professor')
        return
      }
      cloneData.professorIds = [userInfo.id]
    }

    // if (!cloneData.newSemesterId && !cloneData.newSection) {
    //   message.error('Please select a semester or enter a section')
    //   return
    // }

    runAsyncToast(
      () => API.course.createClone(courseId, cloneData),
      (userCourse) => {
        if (userCourse)
          setUserInfo({
            ...userInfo,
            courses: [...userInfo.courses, userCourse as UserCourse],
          })
      },
      {
        successMsg: `${courseName} has been cloned successfully`,
        errorMsg: `Failed to clone ${courseName}`,
        appendApiError: true,
      },
    )
    form.resetFields()
    setVisible(false)
  }

  const handleCancelCloneModal = () => {
    setVisible(false)
  }

  return (
    <>
      <div className="flex flex-col items-center md:flex-row">
        <div className="mb-2 w-full md:mr-5 md:w-5/6 md:text-left">
          <p className="font-bold">Clone Course</p>
          <p>
            This feature allows you to clone select settings of this course for
            future courses in new semesters or new sections of the course in the
            same semester. Any further changes from the original course&apos;s
            settings can be set in the settings page of the new course once it
            is successfully cloned. You will automatically be assigned professor
            of the new course. Only organization administrators can assign other
            professors.
          </p>
        </div>
        <Button type="primary" onClick={openModal}>
          Clone Course
        </Button>
      </div>
      <Modal
        title={`Clone ${courseName}`}
        open={visible}
        onOk={handleClone}
        onCancel={handleCancelCloneModal}
        okText="Clone"
        footer={[
          <Button key="back" onClick={handleCancelCloneModal}>
            Cancel
          </Button>,
          <Popconfirm
            key="submit"
            title="Notice"
            description={
              <div className="flex w-80 flex-col gap-1">
                {(form.getFieldValue(['toClone', 'chatbot', 'documents']) ||
                  form.getFieldValue([
                    'toClone',
                    'chatbot',
                    'manuallyCreatedChunks',
                  ]) ||
                  form.getFieldValue([
                    'toClone',
                    'chatbot',
                    'insertedQuestions',
                  ]) ||
                  form.getFieldValue([
                    'toClone',
                    'chatbot',
                    'insertedLMSData',
                  ])) && (
                  <p>
                    Note that you may want to review and remove any out-of-date
                    or irrelevant chatbot documents and chunks after the course
                    is cloned.
                  </p>
                )}
                <p>
                  This process will take a minute to complete. You will be
                  notified on the bottom-right of the screen once the cloning
                  completes.
                </p>
              </div>
            }
            okText="Continue"
            cancelText="Cancel"
            icon={<ExclamationCircleFilled className="text-blue-500" />}
            onConfirm={handleClone}
            okButtonProps={{ className: 'px-4' }}
            cancelButtonProps={{ className: 'px-4' }}
          >
            <Button key="submit" type="primary">
              Clone
            </Button>
          </Popconfirm>,
        ]}
        width={{
          xs: '90%',
          sm: '85%',
          md: '80%',
          lg: '70%',
          xl: '65%',
          xxl: '50%',
        }}
      >
        <CourseCloneForm
          form={form}
          isAdmin={isAdmin}
          organization={organization}
          courseSemesterId={courseSemesterId}
          courseSectionGroupName={courseSectionGroupName}
        />
      </Modal>
    </>
  )
}

export default CourseCloneFormModal
