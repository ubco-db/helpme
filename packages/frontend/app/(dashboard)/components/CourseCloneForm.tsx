'use client'

import React, { useEffect, useState } from 'react'
import {
  Button,
  Modal,
  Form,
  Checkbox,
  Input,
  InputNumber,
  Select,
  Tooltip,
  Tag,
  message,
} from 'antd'
import {
  CourseCloneAttributes,
  GetOrganizationResponse,
  OrganizationProfessor,
  OrganizationRole,
  User,
  UserCourse,
} from '@koh/common'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { useUserInfo } from '@/app/contexts/userContext'

const defaultValues: CourseCloneAttributes = {
  professorIds: [],
  includeDocuments: true,
  cloneAttributes: {
    name: true,
    sectionGroupName: true,
    coordinator_email: true,
    zoomLink: false,
    timezone: true,
    courseInviteCode: false,
  },
  cloneCourseSettings: {
    chatBotEnabled: true,
    asyncQueueEnabled: true,
    queueEnabled: true,
    scheduleOnFrontPage: false,
    asyncCentreAIAnswers: true,
  },
  chatbotSettings: {
    modelName: true,
    prompt: true,
    similarityThresholdDocuments: true,
    similarityThresholdQuestions: true,
    temperature: true,
    topK: true,
  },
}

type CourseCloneFormProps = {
  user: User
  organization: GetOrganizationResponse
  courseId: number
}

const CourseCloneForm: React.FC<CourseCloneFormProps> = ({
  user,
  organization,
  courseId,
}) => {
  const [visible, setVisible] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false) // new loading state
  const [professors, setProfessors] = useState<OrganizationProfessor[]>()
  const [form] = Form.useForm<CourseCloneAttributes>()
  const { userInfo, setUserInfo } = useUserInfo()

  const openModal = () => {
    form.setFieldsValue(defaultValues)
    setVisible(true)
  }

  //PAT TODO: link courses with new model and write script to auto generate supercourses for all existing courses

  const isAdmin =
    user && user.organization?.organizationRole === OrganizationRole.ADMIN

  const handleOk = async () => {
    setConfirmLoading(true)
    try {
      const userCourse = await API.course.createClone(
        courseId,
        form.getFieldsValue(),
      )
      if (userCourse)
        setUserInfo({
          ...userInfo,
          courses: [...userInfo.courses, userCourse as UserCourse],
        })
      message.success('Course cloned successfully')
      setVisible(false)
    } catch (error: any) {
      message.error(getErrorMessage(error))
    } finally {
      setConfirmLoading(false)
    }
  }

  useEffect(() => {
    const fetchProfessors = async () => {
      if (!isAdmin) return
      await API.organizations
        .getProfessors(organization.id, courseId)
        .then((response) => {
          setProfessors(response ?? [])
        })
        .catch((error) => {
          message.error(error.response.data.message)
          setProfessors([])
        })
    }
    fetchProfessors()
  }, [courseId, isAdmin, organization.id])

  const handleCancel = () => {
    setVisible(false)
  }

  return (
    <div className="flex flex-col items-center md:flex-row">
      <div className="mb-2 w-full md:mr-5 md:w-5/6 md:text-left">
        <p className="font-bold">Clone Course</p>
        <p>
          This feature allows you to clone this course to reuse select
          configuration settings for future courses in new semesters. You will
          automatically be assigned professor of the new course. Only
          organization administrators can assign other professors.
        </p>
      </div>
      <Button type="primary" onClick={openModal}>
        Clone Course
      </Button>
      <Modal
        title="Clone Course Settings"
        open={visible}
        onOk={handleOk}
        onCancel={handleCancel}
        okText="Clone"
        confirmLoading={confirmLoading}
      >
        <Form form={form} layout="vertical">
          {user.organization?.organizationRole === OrganizationRole.ADMIN &&
          professors ? (
            <Form.Item
              label="Professors"
              name="professorIds"
              tooltip="Professors teaching the course"
              className="flex-1"
              required
            >
              <Select
                mode="multiple"
                placeholder="Select professors"
                options={professors.map((prof: OrganizationProfessor) => ({
                  label: prof.organizationUser.name,
                  value: prof.organizationUser.id,
                }))}
                notFoundContent="There seems to be no professors available. This is likely a server error."
                tagRender={(props) => {
                  const { label, value, closable, onClose } = props
                  const onPreventMouseDown = (
                    event: React.MouseEvent<HTMLSpanElement>,
                  ) => {
                    event.preventDefault()
                    event.stopPropagation()
                  }
                  // find the professor with the given id and see if they have lacksProfOrgRole
                  const lacksProfOrgRole = professors.find(
                    (prof) => prof.organizationUser.id === value,
                  )?.organizationUser.lacksProfOrgRole
                  return (
                    <Tooltip
                      title={
                        lacksProfOrgRole
                          ? 'This user lacks the Professor role in this organization, meaning they cannot create their own courses.'
                          : ''
                      }
                    >
                      <Tag
                        color={lacksProfOrgRole ? 'orange' : 'blue'}
                        onMouseDown={onPreventMouseDown}
                        closable={closable}
                        onClose={onClose}
                        style={{ marginInlineEnd: 4 }}
                      >
                        {label}
                      </Tag>
                    </Tooltip>
                  )
                }}
              />
            </Form.Item>
          ) : (
            <></>
          )}
          <Form.Item
            label="Semester for Cloned Course"
            name="newSemesterId"
            className="flex-1"
            rules={[{ required: true, message: 'Please select a semester' }]}
          >
            <Select
              placeholder="Select Semester"
              notFoundContent="There seems to be no other semesters in this organization to clone to."
            >
              {organization.semesters
                .filter(
                  (semester) =>
                    semester.id !==
                    (userInfo.courses.find(
                      (course) => course.course.id === courseId,
                    )?.course.semesterId ?? -1),
                )
                .map((semester) => (
                  <Select.Option key={semester.id} value={semester.id}>
                    <span>{`${semester.name}`}</span>{' '}
                    {`(${new Date(semester.startDate).toLocaleDateString()} - ${new Date(semester.endDate).toLocaleDateString()})`}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item label="Course Attributes to Clone">
            <div className="ml-4 flex flex-col">
              <Form.Item
                name={['cloneAttributes', 'name']}
                valuePropName="checked"
                noStyle
              >
                <Checkbox>Name</Checkbox>
              </Form.Item>
              <Form.Item
                name={['cloneAttributes', 'sectionGroupName']}
                valuePropName="checked"
                noStyle
              >
                <Checkbox>Section Group Name</Checkbox>
              </Form.Item>
              <Form.Item
                name={['cloneAttributes', 'coordinator_email']}
                valuePropName="checked"
                noStyle
              >
                <Checkbox>Coordinator Email</Checkbox>
              </Form.Item>
              <Form.Item
                name={['cloneAttributes', 'zoomLink']}
                valuePropName="checked"
                noStyle
              >
                <Checkbox>Zoom Link</Checkbox>
              </Form.Item>
              <Form.Item
                name={['cloneAttributes', 'timezone']}
                valuePropName="checked"
                noStyle
              >
                <Checkbox>Timezone</Checkbox>
              </Form.Item>
              <Form.Item
                name={['cloneAttributes', 'courseInviteCode']}
                valuePropName="checked"
                noStyle
              >
                <Checkbox>Course Invite Code</Checkbox>
              </Form.Item>
            </div>
          </Form.Item>
          <Form.Item label="Course Settings to Clone">
            <div className="ml-4 flex flex-col">
              <Form.Item
                name={['cloneCourseSettings', 'chatBotEnabled']}
                valuePropName="checked"
                noStyle
              >
                <Checkbox>ChatBot Enabled</Checkbox>
              </Form.Item>
              <Form.Item
                name={['cloneCourseSettings', 'asyncQueueEnabled']}
                valuePropName="checked"
                noStyle
              >
                <Checkbox>Async Queue Enabled</Checkbox>
              </Form.Item>
              <Form.Item
                name={['cloneCourseSettings', 'queueEnabled']}
                valuePropName="checked"
                noStyle
              >
                <Checkbox>Queues Enabled</Checkbox>
              </Form.Item>
              <Form.Item
                name={['cloneCourseSettings', 'scheduleOnFrontPage']}
                valuePropName="checked"
                noStyle
              >
                <Checkbox>Schedule on Front Page</Checkbox>
              </Form.Item>
              <Form.Item
                name={['cloneCourseSettings', 'asyncCentreAIAnswers']}
                valuePropName="checked"
                noStyle
              >
                <Checkbox>Async Centre AI Answers</Checkbox>
              </Form.Item>
            </div>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, curValues) =>
              prevValues.cloneCourseSettings?.chatBotEnabled !==
              curValues.cloneCourseSettings?.chatBotEnabled
            }
          >
            {({ getFieldValue }) =>
              getFieldValue(['cloneCourseSettings', 'chatBotEnabled']) ? (
                <>
                  <Form.Item label="Chatbot Settings">
                    <div className="ml-4 flex flex-col">
                      <Form.Item
                        name={['chatbotSettings', 'modelName']}
                        noStyle
                        valuePropName="checked"
                      >
                        <Checkbox>Model Name</Checkbox>
                      </Form.Item>
                      <Form.Item
                        name={['chatbotSettings', 'prompt']}
                        noStyle
                        valuePropName="checked"
                      >
                        <Checkbox>Model Prompt</Checkbox>
                      </Form.Item>
                      <Form.Item
                        name={[
                          'chatbotSettings',
                          'similarityThresholdDocuments',
                        ]}
                        noStyle
                        valuePropName="checked"
                      >
                        <Checkbox>Similarity Threshold for Documents</Checkbox>
                      </Form.Item>
                      <Form.Item
                        name={[
                          'chatbotSettings',
                          'similarityThresholdQuestions',
                        ]}
                        noStyle
                        valuePropName="checked"
                      >
                        <Checkbox>Similarity Threshold for Questions</Checkbox>
                      </Form.Item>
                      <Form.Item
                        name={['chatbotSettings', 'temperature']}
                        noStyle
                        valuePropName="checked"
                      >
                        <Checkbox>Temperature</Checkbox>
                      </Form.Item>
                      <Form.Item
                        name={['chatbotSettings', 'topK']}
                        noStyle
                        valuePropName="checked"
                      >
                        <Checkbox>Top K</Checkbox>
                      </Form.Item>
                      <Form.Item
                        name="includeDocuments"
                        valuePropName="checked"
                        noStyle
                        tooltip="Include existing linked document chunks for chatbot without timed data (eg. dated announcements, assignments, etc.)"
                      >
                        <Checkbox>
                          Include Linked Documents (This process will take a
                          long time)
                        </Checkbox>
                      </Form.Item>
                    </div>
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CourseCloneForm
