'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Modal,
  Form,
  Checkbox,
  Input,
  Select,
  Tooltip,
  Tag,
  message,
  Switch,
  Popconfirm,
} from 'antd'
import {
  CourseCloneAttributes,
  defaultCourseCloneAttributes,
  GetOrganizationResponse,
  OrganizationProfessor,
  OrganizationRole,
  UserCourse,
} from '@koh/common'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { ExclamationCircleFilled } from '@ant-design/icons'
import { useAsyncActions } from '@/app/contexts/AsyncActionsContext'
import { formatSemesterDate } from '@/app/utils/timeFormatUtils'
type CourseCloneFormProps = {
  organization: GetOrganizationResponse
  courseId: number
  courseSemesterId: number
  courseSectionGroupName: string
}

const CourseCloneForm: React.FC<CourseCloneFormProps> = ({
  organization,
  courseId,
  courseSemesterId,
  courseSectionGroupName,
}) => {
  const [visible, setVisible] = useState(false)
  const [professors, setProfessors] = useState<OrganizationProfessor[]>()
  const [form] = Form.useForm<CourseCloneAttributes>()
  const { userInfo, setUserInfo } = useUserInfo()
  const { runAsync } = useAsyncActions()

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

    if (!cloneData.newSemesterId && !cloneData.newSection) {
      message.error('Please select a semester or enter a section')
      return
    }

    runAsync(
      () => API.course.createClone(courseId, cloneData),
      (userCourse) => {
        if (userCourse)
          setUserInfo({
            ...userInfo,
            courses: [...userInfo.courses, userCourse as UserCourse],
          })
      },
      {
        successMsg: 'Course has been cloned successfully',
        errorMsg: 'Failed to clone course',
        appendApiError: true,
      },
    )
    form.resetFields()
    setVisible(false)
  }

  useEffect(() => {
    const fetchProfessors = async () => {
      if (!isAdmin) return
      await API.organizations
        .getProfessors(organization.id)
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

  const handleCancelCloneModal = () => {
    setVisible(false)
  }

  const includeDocumentsValue = Form.useWatch('includeDocuments', form)
  const includeInsertedQuestionsValue = Form.useWatch(
    'includeInsertedQuestions',
    form,
  )

  return (
    <>
      <div className="flex flex-col items-center md:flex-row">
        <div className="mb-2 w-full md:mr-5 md:w-5/6 md:text-left">
          <p className="font-bold">Clone Course</p>
          <p>
            This feature allows you to clone select settings of this course to
            for future courses in new semesters or new sections of the course in
            the same semester. Any further changes from the original
            course&apos;s settings can be set in the settings page of the new
            course once it is successfully cloned. You will automatically be
            assigned professor of the new course. Only organization
            administrators can assign other professors.
          </p>
        </div>
        <Button type="primary" onClick={openModal}>
          Clone Course
        </Button>
      </div>
      <Modal
        title="Clone Course Settings"
        open={visible}
        onOk={handleClone}
        onCancel={handleCancelCloneModal}
        okText="Clone"
        footer={[
          <Button key="back" onClick={handleCancelCloneModal}>
            Cancel
          </Button>,
          includeDocumentsValue ? (
            <Popconfirm
              title="Important Notice"
              description={
                <div className="flex w-96 flex-col gap-1">
                  <p className="text-sm">
                    <b>Include Documents Warning:</b> Cloning chatbot documents
                    will take much longer (about 30 seconds to a minute).
                  </p>
                  {includeInsertedQuestionsValue && (
                    <p className="text-sm">
                      <b>Include Inserted Questions Warning:</b> This process
                      will not filter out answers to inserted questions relating
                      to timed data (eg. dated announcements, assignments,
                      etc.).
                    </p>
                  )}
                  <b className="py-2 text-center">
                    You will be notified on the bottom right of the screen when
                    the cloning process is successful or fails. You do not need
                    to remain on this page, but do not refresh this site until
                    cloning is complete.
                  </b>
                  <p>
                    Are you sure you wish to include chatbot documents in your
                    clone?
                  </p>
                </div>
              }
              okText="Yes"
              cancelText="No"
              icon={<ExclamationCircleFilled className="text-blue-500" />}
              onConfirm={handleClone}
              okButtonProps={{ className: 'px-4' }}
              cancelButtonProps={{ className: 'px-4' }}
            >
              <Button key="submit" type="primary">
                Clone
              </Button>
            </Popconfirm>
          ) : (
            <Button key="submit" type="primary" onClick={handleClone}>
              Clone
            </Button>
          ),
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
        <Form form={form} layout="vertical" className="w-full">
          {isAdmin && professors ? (
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
            label="Clone by"
            name="useSection"
            valuePropName="checked"
            initialValue={false}
            tooltip="Choose whether to clone to a new section of the same semester or a new semester"
          >
            <Switch checkedChildren="Section" unCheckedChildren="Semester" />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, curValues) =>
              prevValues.useSection !== curValues.useSection
            }
          >
            {({ getFieldValue }) => {
              return getFieldValue('useSection') ? (
                <Form.Item
                  label="Section Group Name for Cloned Course"
                  name="newSection"
                  rules={[
                    { required: true, message: 'Please enter a section' },
                    {
                      validator: (_, value) => {
                        if (value && value === courseSectionGroupName) {
                          return Promise.reject(
                            'Section cannot match the original section group name.',
                          )
                        }
                        return Promise.resolve()
                      },
                    },
                  ]}
                >
                  <Input placeholder="Enter new section" />
                </Form.Item>
              ) : (
                <Form.Item
                  label="New Semester for Cloned Course"
                  name="newSemesterId"
                  className="flex-1"
                  rules={[
                    { required: true, message: 'Please select a semester' },
                  ]}
                >
                  <Select
                    placeholder="Select Semester"
                    notFoundContent="There seems to be no other semesters in this organization to clone to."
                  >
                    {organization.semesters
                      .filter((semester) => semester.id !== courseSemesterId)
                      .map((semester) => (
                        <Select.Option key={semester.id} value={semester.id}>
                          <span>{`${semester.name}`}</span>{' '}
                          <span className="font-normal">
                            {formatSemesterDate(semester)}
                          </span>
                        </Select.Option>
                      ))}
                  </Select>
                </Form.Item>
              )
            }}
          </Form.Item>
          <Form.Item label="Course Attributes to Clone">
            <div className="ml-4 flex flex-col">
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
            {({ getFieldValue }) => {
              const chatBotEnabled = getFieldValue([
                'cloneCourseSettings',
                'chatBotEnabled',
              ])
              return (
                <>
                  <Form.Item label="Chatbot Settings">
                    <div className="ml-4 flex flex-col">
                      <Form.Item
                        name={['chatbotSettings', 'modelName']}
                        noStyle
                        valuePropName="checked"
                      >
                        <Checkbox disabled={!chatBotEnabled}>
                          Model Name
                          {!chatBotEnabled && (
                            <span className="ml-2 text-xs italic text-gray-400">
                              (Requires &quot;ChatBot Enabled&quot; to be
                              checked)
                            </span>
                          )}
                        </Checkbox>
                      </Form.Item>
                      <Form.Item
                        name={['chatbotSettings', 'prompt']}
                        noStyle
                        valuePropName="checked"
                      >
                        <Checkbox disabled={!chatBotEnabled}>
                          Model Prompt
                          {!chatBotEnabled && (
                            <span className="ml-2 text-xs italic text-gray-400">
                              (Requires &quot;ChatBot Enabled&quot; to be
                              checked)
                            </span>
                          )}
                        </Checkbox>
                      </Form.Item>
                      <Form.Item
                        name={[
                          'chatbotSettings',
                          'similarityThresholdDocuments',
                        ]}
                        noStyle
                        valuePropName="checked"
                      >
                        <Checkbox disabled={!chatBotEnabled}>
                          Similarity Threshold for Documents
                          {!chatBotEnabled && (
                            <span className="ml-2 text-xs italic text-gray-400">
                              (Requires &quot;ChatBot Enabled&quot; to be
                              checked)
                            </span>
                          )}
                        </Checkbox>
                      </Form.Item>
                      <Form.Item
                        name={['chatbotSettings', 'temperature']}
                        noStyle
                        valuePropName="checked"
                      >
                        <Checkbox disabled={!chatBotEnabled}>
                          Temperature
                          {!chatBotEnabled && (
                            <span className="ml-2 text-xs italic text-gray-400">
                              (Requires &quot;ChatBot Enabled&quot; to be
                              checked)
                            </span>
                          )}
                        </Checkbox>
                      </Form.Item>
                      <Form.Item
                        name={['chatbotSettings', 'topK']}
                        noStyle
                        valuePropName="checked"
                      >
                        <Checkbox disabled={!chatBotEnabled}>
                          Top K
                          {!chatBotEnabled && (
                            <span className="ml-2 text-xs italic text-gray-400">
                              (Requires &quot;ChatBot Enabled&quot; to be
                              checked)
                            </span>
                          )}
                        </Checkbox>
                      </Form.Item>
                    </div>
                  </Form.Item>
                  <Form.Item
                    label="Include Chatbot Documents"
                    tooltip={`Include existing chatbot document chunks for chatbot without timed documents (eg. dated announcements, assignments, etc.)\n\nInclude chatbot questions that were inserted back as documents by the professor (this will include questions answered with timed documents --eg. dated announcements, assignments, etc.--)`}
                  >
                    <div className="ml-4 flex flex-col">
                      <Form.Item
                        name="includeDocuments"
                        valuePropName="checked"
                        noStyle
                      >
                        <Checkbox disabled={!chatBotEnabled}>
                          Include Chatbot Documents (This process will take a
                          long time)
                          {!chatBotEnabled && (
                            <span className="ml-2 text-xs italic text-gray-400">
                              (Requires &quot;ChatBot Enabled&quot; to be
                              checked)
                            </span>
                          )}
                        </Checkbox>
                      </Form.Item>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, curValues) =>
                          prevValues.includeDocuments !==
                          curValues.includeDocuments
                        }
                      >
                        {({ getFieldValue }) => {
                          const documentsEnabled =
                            getFieldValue('includeDocuments')
                          return (
                            <Form.Item
                              name="includeInsertedQuestions"
                              valuePropName="checked"
                              noStyle
                            >
                              <Checkbox
                                className="ml-4"
                                disabled={!chatBotEnabled || !documentsEnabled}
                              >
                                Include Manually Inserted Questions from Chatbot
                                Interactions
                                {(!chatBotEnabled || !documentsEnabled) && (
                                  <span className="ml-2 text-xs italic text-gray-400">
                                    {!chatBotEnabled
                                      ? '(Requires "ChatBot Enabled" to be checked)'
                                      : '(Requires "Include Chatbot Documents" to be checked)'}
                                  </span>
                                )}
                              </Checkbox>
                            </Form.Item>
                          )
                        }}
                      </Form.Item>
                    </div>
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default CourseCloneForm
