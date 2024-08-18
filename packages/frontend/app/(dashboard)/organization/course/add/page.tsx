'use client'

import {
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  Row,
  Select,
  message,
} from 'antd'
import { ReactElement, useState, useEffect } from 'react'
import {
  COURSE_TIMEZONES,
  GetOrganizationResponse,
  OrganizationProfessor,
  OrganizationRole,
} from '@koh/common'
import DefaultErrorPage from 'next/error'
import { useUserInfo } from '@/app/contexts/userContext'
import { API } from '@/app/api'
import { useRouter } from 'next/navigation'
import { organizationApi } from '@/app/api/organizationApi'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { userApi } from '@/app/api/userApi'

interface FormValues {
  courseName: string
  coordinatorEmail?: string
  sectionGroupName?: string
  zoomLink?: string
  courseTimezone: string
  semesterName: string
  professorsUserId: number[]
  chatBotEnabled: boolean
  queueEnabled: boolean
  asyncQueueEnabled: boolean
}

export default function AddCoursePage(): ReactElement {
  const router = useRouter()
  const { userInfo, setUserInfo } = useUserInfo()
  const [organization, setOrganization] = useState<GetOrganizationResponse>()
  const [professors, setProfessors] = useState<OrganizationProfessor[]>()
  const [isAuthorized, setIsAuthorized] = useState<boolean | undefined>(
    undefined,
  )
  const isAdmin =
    userInfo &&
    userInfo.organization?.organizationRole === OrganizationRole.ADMIN
  const [form] = Form.useForm()

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
    if (userInfo && organization) {
      const isProfessor =
        userInfo.organization?.organizationRole === OrganizationRole.PROFESSOR
      setIsAuthorized(isAdmin || isProfessor)
    }
  }, [userInfo, organization, isAdmin])

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
    const semesterNameField = values.semesterName
    const profIds = isAdmin ? values.professorsUserId : [userInfo.id]
    const courseFeatures = [
      { feature: 'chatBotEnabled', value: values.chatBotEnabled },
      { feature: 'queueEnabled', value: values.queueEnabled },
      { feature: 'asyncQueueEnabled', value: values.asyncQueueEnabled },
    ]

    await API.organizations
      .createCourse(organization.id, {
        name: courseNameField,
        coordinator_email: coordinatorEmailField ?? '',
        sectionGroupName: sectionGroupNameField ?? '',
        zoomLink: zoomLinkField ?? '',
        timezone: courseTimezoneField,
        semesterName: semesterNameField,
        profIds: profIds,
        courseSettings: courseFeatures,
      })
      .then(async () => {
        message.success('Course was created')
        // need to update userInfo so the course shows up in /courses
        await (await userApi.getUser()).json().then((userDetails) => {
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
            <Card bordered={true} title="Add Course">
              <Form
                form={form}
                layout="vertical"
                onFinish={(values) => onFinish(values)}
                initialValues={{
                  courseTimezone: 'America/Los_Angeles',
                  chatBotEnabled: true,
                  queueEnabled: true,
                  asyncQueueEnabled: true,
                }}
              >
                <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    <Form.Item
                      label="Course Name"
                      name="courseName"
                      rules={[
                        {
                          required: true,
                          message: 'Please input a course name',
                        },
                      ]}
                    >
                      <Input allowClear={true} placeholder="COSC 111" />
                    </Form.Item>
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
                      tooltip="Link to the zoom meeting for queues. Currently, this is shared between all queues. When a student is helped, they will have the option to click this link."
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
                      name="semesterName"
                      tooltip="Semester of the course"
                      rules={[
                        { required: true, message: 'Semester is required' },
                        {
                          validator: (_, value) => {
                            if (value) {
                              const parts = value.split(',')
                              if (parts.length !== 2) {
                                return Promise.reject(
                                  new Error(
                                    'Semester must be in the format "season,year". E.g. Fall,2021',
                                  ),
                                )
                              }
                              if (!parts[1] || isNaN(Number(parts[1]))) {
                                return Promise.reject(
                                  new Error('Year must be a number'),
                                )
                              }
                            }
                            return Promise.resolve()
                          },
                        },
                      ]}
                    >
                      <Input allowClear={true} placeholder="season,year" />
                    </Form.Item>
                  </Col>

                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    {userInfo.organization?.organizationRole ===
                      OrganizationRole.ADMIN &&
                      professors && (
                        <Form.Item
                          label="Professors"
                          name="professorsUserId"
                          tooltip="Professors teaching the course"
                        >
                          <Select
                            mode="multiple"
                            placeholder="Select professors"
                          >
                            {professors.map((prof) => (
                              <Select.Option
                                value={prof.organizationUser.id}
                                key={prof.organizationUser.id}
                              >
                                {prof.organizationUser.name}
                              </Select.Option>
                            ))}
                          </Select>
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