'use client'

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  message,
  Row,
  Select,
} from 'antd'
import { ReactElement, useEffect, useState } from 'react'
import {
  COURSE_TIMEZONES,
  GetOrganizationResponse,
  OrganizationProfessor,
  OrganizationRole,
  SemesterPartial,
} from '@koh/common'
import { useUserInfo } from '@/app/contexts/userContext'
import { API } from '@/app/api'
import { useRouter } from 'next/navigation'
import { organizationApi } from '@/app/api/organizationApi'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import {
  checkCourseCreatePermissions,
  getErrorMessage,
} from '@/app/utils/generalUtils'
import { userApi } from '@/app/api/userApi'
import { formatSemesterDate } from '@/app/utils/timeFormatUtils'
import { useOrganizationSettings } from '@/app/hooks/useOrganizationSettings'

interface FormValues {
  courseName: string
  coordinatorEmail?: string
  sectionGroupName?: string
  zoomLink?: string
  courseTimezone: string
  semesterId?: number
  professorsUserId: number[]
  chatBotEnabled: boolean
  queueEnabled: boolean
  asyncQueueEnabled: boolean
  asyncCentreAIAnswers: boolean
  scheduleOnFrontPage: boolean
}

export default function AddCoursePage(): ReactElement {
  const router = useRouter()
  const { userInfo, setUserInfo } = useUserInfo()
  const [organization, setOrganization] = useState<GetOrganizationResponse>()
  const [professors, setProfessors] = useState<OrganizationProfessor[]>()
  const [organizationSemesters, setOrganizationSemesters] =
    useState<SemesterPartial[]>()
  const [isAuthorized, setIsAuthorized] = useState<boolean | undefined>(
    undefined,
  )
  const organizationSettings = useOrganizationSettings(
    userInfo.organization?.orgId ?? -1,
  )
  const [isCourseNameTooLong, setIsCourseNameTooLong] = useState(false)

  const isAdmin =
    userInfo &&
    userInfo.organization?.organizationRole === OrganizationRole.ADMIN
  const [form] = Form.useForm()

  useEffect(() => {
    form.setFieldsValue({ semesterId: -1 })
  }, [])

  useEffect(() => {
    const getOrganization = async () => {
      const response = await organizationApi.getOrganization(
        userInfo.organization?.orgId ?? -1,
      )
      setOrganization(response)
    }
    getOrganization()
  }, [userInfo])

  useEffect(() => {
    API.semesters
      .get(userInfo.organization?.orgId || -1)
      .then((semesters) => {
        setOrganizationSemesters(semesters)
      })
      .catch((_) => {
        message.error('Failed to fetch semesters for organization')
      })
  }, [])

  useEffect(() => {
    if (userInfo && organizationSettings) {
      setIsAuthorized(
        checkCourseCreatePermissions(userInfo, organizationSettings),
      )
    }
  }, [userInfo, organizationSettings])

  useEffect(() => {
    const fetchProfessors = async () => {
      if (!isAdmin || !organization) return
      const response = await API.organizations.getProfessors(organization.id)
      setProfessors(response)
    }
    fetchProfessors()
  }, [isAdmin, organization])

  const onFinish = async (values: FormValues) => {
    if (!organization) return
    const courseNameField = values.courseName
    const coordinatorEmailField = values.coordinatorEmail
    const sectionGroupNameField = values.sectionGroupName
    const zoomLinkField = values.zoomLink
    const courseTimezoneField = values.courseTimezone
    const semesterIdField = values.semesterId
    const profIds = isAdmin ? values.professorsUserId : [userInfo.id]
    const courseFeatures = [
      { feature: 'chatBotEnabled', value: values.chatBotEnabled },
      { feature: 'queueEnabled', value: values.queueEnabled },
      { feature: 'asyncQueueEnabled', value: values.asyncQueueEnabled },
      { feature: 'asyncCentreAIAnswers', value: values.asyncCentreAIAnswers },
      { feature: 'scheduleOnFrontPage', value: values.scheduleOnFrontPage },
    ]

    await API.organizations
      .createCourse(organization.id, {
        name: courseNameField,
        coordinator_email: coordinatorEmailField ?? '',
        sectionGroupName: sectionGroupNameField ?? '',
        zoomLink: zoomLinkField ?? '',
        timezone: courseTimezoneField,
        semesterId: semesterIdField,
        profIds: profIds,
        courseSettings: courseFeatures,
      })
      .then(async () => {
        message.success('Course was created')
        // need to update userInfo so the course shows up in /courses
        await userApi.getUser().then((userDetails) => {
          setUserInfo(userDetails)
          router.push('/courses')
        })
      })
      .catch((error) => {
        const errorMessage = getErrorMessage(error)
        message.error(errorMessage)
      })
  }

  if (!userInfo) {
    return <CenteredSpinner tip="Loading user..." />
  } else if (!organization) {
    return <CenteredSpinner tip="Loading organization..." />
  } else if (isAuthorized === false) {
    router.push('/courses')
    return <CenteredSpinner tip="Nuh uh..." />
  } else {
    return (
      <>
        <title>{`${organization?.name} | Add Course`}</title>
        <Row>
          <Col span={24}>
            <Card variant="outlined" title="Add Course">
              <Form
                form={form}
                layout="vertical"
                onFinish={(values) => onFinish(values)}
                initialValues={{
                  courseTimezone: 'America/Los_Angeles',
                  chatBotEnabled: true,
                  queueEnabled: true,
                  asyncQueueEnabled: true,
                  asyncCentreAIAnswers: true,
                  scheduleOnFrontPage: false,
                }}
                onValuesChange={(changedValues, allValues) => {
                  if (changedValues.asyncQueueEnabled === false) {
                    form.setFieldsValue({ asyncCentreAIAnswers: false })
                  }
                  if (changedValues.courseName) {
                    if (changedValues.courseName.length > 14) {
                      setIsCourseNameTooLong(true)
                    } else {
                      setIsCourseNameTooLong(false)
                    }
                  }
                }}
              >
                <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    <div className="flex flex-col">
                      <Form.Item
                        label="Course Name"
                        name="courseName"
                        tooltip="Name of the course (e.g. COSC 111). Please try to keep this short as long course names look bad on various UI elements."
                        className="mb-1"
                        rules={[
                          {
                            required: true,
                            message: 'Please input a course name',
                          },
                        ]}
                      >
                        <Input allowClear={true} placeholder="COSC 111" />
                      </Form.Item>
                      {isCourseNameTooLong && (
                        <Alert
                          type="warning"
                          showIcon
                          message="Long course names are not recommended as they look bad on various UI elements. Please consider shortening this (can you shorten it to just the course code? E.g. COSC 111 001 Computer Programming 1 -&gt; COSC 111)"
                        />
                      )}
                    </div>
                  </Col>
                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    <Form.Item
                      label="Coordinator Email"
                      name="coordinatorEmail"
                      tooltip="Email of the coordinator of the course"
                    >
                      <Input allowClear={true} />
                    </Form.Item>
                  </Col>

                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    <Form.Item
                      label="Section Group"
                      name="sectionGroupName"
                      tooltip="Name of the section group (E.g. if you're in COSC 111 001, the section group is 001)"
                    >
                      <Input allowClear={true} placeholder="001" />
                    </Form.Item>
                  </Col>

                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    <Form.Item
                      label="Zoom Link"
                      name="zoomLink"
                      tooltip="Default link to the zoom meeting for queues. Each queue can also have a unique zoom link which will automatically overwrite this one. When a student is helped, they will have the option to click this link."
                      className="flex-1"
                    >
                      <Input allowClear={true} />
                    </Form.Item>
                  </Col>

                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    <Form.Item
                      label="Course Timezone"
                      name="courseTimezone"
                      tooltip="Timezone of the course"
                      rules={[
                        { required: true, message: 'Please select a timezone' },
                      ]}
                    >
                      <Select>
                        {COURSE_TIMEZONES.map((timezone) => (
                          <Select.Option value={timezone} key={timezone}>
                            {timezone}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>

                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    <Form.Item
                      label="Semester"
                      name="semesterId"
                      className="flex-1"
                      rules={[{ required: false }]}
                    >
                      <Select
                        placeholder="Select Semester"
                        notFoundContent="There seems to be no other semesters in this organization to clone to."
                      >
                        {organizationSemesters &&
                          organizationSemesters.map((semester) => (
                            <Select.Option
                              key={semester.id}
                              value={semester.id}
                            >
                              <span>{`${semester.name}`}</span>{' '}
                              <span className="font-normal">
                                {formatSemesterDate(semester)}
                              </span>
                            </Select.Option>
                          ))}
                        <Select.Option key={'none'} value={-1}>
                          <span>No semester</span>
                        </Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>

                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    {isAdmin && professors && (
                      <Form.Item
                        label="Professors"
                        name="professorsUserId"
                        tooltip="Professors teaching the course"
                      >
                        <Select
                          mode="multiple"
                          placeholder="Select professors"
                          filterSort={(optionA, optionB) =>
                            (optionA?.label ?? '')
                              .toLowerCase()
                              .localeCompare(
                                (optionB?.label ?? '').toLowerCase(),
                              )
                          }
                          showSearch
                          optionFilterProp="label"
                          options={professors.map((prof) => ({
                            key: prof.organizationUser.id,
                            label: prof.organizationUser.name,
                            value: prof.organizationUser.id,
                          }))}
                        />
                      </Form.Item>
                    )}
                  </Col>
                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    <div className="flex flex-wrap gap-x-4 md:gap-x-8">
                      <Form.Item
                        label="Chatbot"
                        layout="horizontal"
                        valuePropName="checked"
                        name="chatBotEnabled"
                        tooltip="This feature allows students to ask an AI chatbot questions that will answer their questions based on uploaded course content (located in course admin settings)"
                      >
                        <Checkbox />
                      </Form.Item>
                      <Form.Item
                        label="Queues"
                        valuePropName="checked"
                        layout="horizontal"
                        name="queueEnabled"
                        tooltip="This feature allows students to ask questions in a queue that can then be answered by the professor or a TA. Suitable for online, hybrid, and in-person office hours and labs."
                      >
                        <Checkbox />
                      </Form.Item>
                      <Form.Item
                        label="Anytime Question Hub"
                        valuePropName="checked"
                        layout="horizontal"
                        name="asyncQueueEnabled"
                        tooltip="This feature allows students to ask questions asynchronously (e.g. outside of office hours or labs) that can then be answered by the professor. It also features automatic AI-generated answers based on uploaded course content."
                      >
                        <Checkbox />
                      </Form.Item>
                      <Form.Item
                        label="Anytime Question AI Answers"
                        valuePropName="checked"
                        layout="horizontal"
                        name="asyncCentreAIAnswers"
                        tooltip="This feature will enable students question's to immediately get an AI answer when they ask it (on the Anytime Question Hub). From there, students can ask if they are satisfied or still need help with it, in which staff can then edit the answer or verify it."
                      >
                        <Checkbox />
                      </Form.Item>
                      <Form.Item
                        label="Schedule on Home Course Page"
                        valuePropName="checked"
                        layout="horizontal"
                        name="scheduleOnFrontPage"
                        tooltip="By default, a chatbot is displayed on the home course page. Enabling this will replace that chatbot with a preview of today's schedule and show a little 'chat now!' widget for the chatbot like other pages. Choose this option if you think it is more valuable for students to see today's event schedule over a large chatbot component."
                      >
                        <Checkbox />
                      </Form.Item>
                    </div>
                  </Col>
                </Row>
                <Row>
                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    <Form.Item>
                      <Button type="primary" htmlType="submit">
                        Add Course
                      </Button>
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Card>
          </Col>
        </Row>
      </>
    )
  }
}
