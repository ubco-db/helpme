import {
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  Row,
  Select,
  Spin,
  Tooltip,
  message,
} from 'antd'
import Head from 'next/head'
import { ReactElement, useState, useEffect } from 'react'
import NavBar from '../../../components/Nav/NavBar'
import { StandardPageContainer } from '../../../components/common/PageContainer'
import { useRouter } from 'next/router'
import { useOrganization } from '../../../hooks/useOrganization'
import { useProfile } from '../../../hooks/useProfile'
import { COURSE_TIMEZONES, OrganizationRole } from '@koh/common'
import DefaultErrorPage from 'next/error'
import { API } from '@koh/api-client'
import useSWR from 'swr'
import { QuestionCircleOutlined } from '@ant-design/icons'

export default function Add(): ReactElement {
  const profile = useProfile()
  const { organization } = useOrganization(profile?.organization.orgId)
  const router = useRouter()

  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const isAdmin =
    profile && profile.organization.organizationRole === OrganizationRole.ADMIN

  useEffect(() => {
    if (profile && organization) {
      const isProfessor =
        profile?.organization.organizationRole === OrganizationRole.PROFESSOR

      setIsAuthorized(isAdmin || isProfessor)
      setIsLoading(false)
    }
  }, [profile, organization, isAdmin])

  if (isLoading) {
    return (
      <>
        <Spin
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
          }}
        />
      </>
    )
  }

  if (!isAuthorized) {
    return <DefaultErrorPage statusCode={401} />
  }

  function RenderAddCourse(): ReactElement {
    const [formGeneral] = Form.useForm()

    const { data: professors } = useSWR(
      isAdmin ? `/api/v1/organization/[oid]/get_professors` : null,
      async () => await API.organizations.getProfessors(organization.id),
    )

    const addCourse = async () => {
      const formValues = formGeneral.getFieldsValue()
      const courseNameField = formValues.courseName
      const coordinatorEmailField = formValues.coordinatorEmail
      const sectionGroupNameField = formValues.sectionGroupName
      const zoomLinkField = formValues.zoomLink
      const courseTimezoneField = formValues.courseTimezone
      const semesterNameField = formValues.semesterName
      const profIds = isAdmin ? formValues.professorsUserId : [profile.id]
      const courseFeatures = [
        'chatBotEnabled',
        'queueEnabled',
        'asyncQueueEnabled',
      ].map((feature) => ({
        feature,
        value: formValues['course-features'].includes(feature),
      }))

      if (semesterNameField && semesterNameField.split(',').length !== 2) {
        message.error(
          'Semester must be in the format "season,year". E.g. Fall,2021',
        )
        return
      }

      await API.organizations
        .createCourse(organization.id, {
          name: courseNameField,
          coordinator_email: coordinatorEmailField ?? '',
          sectionGroupName: sectionGroupNameField,
          zoomLink: zoomLinkField ?? '',
          timezone: courseTimezoneField,
          semesterName: semesterNameField,
          profIds: profIds,
          courseSettings: courseFeatures,
        })
        .then(() => {
          message.success('Course was created')
          router.reload()
          router.back()
        })
        .catch((error) => {
          const errorMessage = error.response.data.message
          message.error(errorMessage)
        })
    }

    return (
      <>
        <Row>
          <Col xs={{ span: 24 }} sm={{ span: 24 }}>
            <Card bordered={true} title="Add Course">
              <Form
                form={formGeneral}
                layout="vertical"
                onFinish={addCourse}
                initialValues={{
                  // features placed here will appear as checked by default
                  'course-features': [
                    'chatBotEnabled',
                    'queueEnabled',
                    'asyncQueueEnabled',
                  ],
                }}
              >
                <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    <Form.Item
                      label="Course Name"
                      name="courseName"
                      tooltip="Name of the course"
                      rules={[{ required: true }]}
                    >
                      <Input allowClear={true} />
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
                      rules={[{ required: true }]}
                    >
                      <Input allowClear={true} />
                    </Form.Item>
                  </Col>

                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    <Form.Item
                      label="Zoom Link"
                      name="zoomLink"
                      tooltip="Link to the zoom meeting for office hours"
                    >
                      <Input allowClear={true} />
                    </Form.Item>
                  </Col>

                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    <Form.Item
                      label="Course Timezone"
                      name="courseTimezone"
                      tooltip="Timezone of the course"
                      rules={[{ required: true }]}
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
                      rules={[{ required: true }]}
                    >
                      <Input allowClear={true} placeholder="season,year" />
                    </Form.Item>
                  </Col>

                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    {profile.organization.organizationRole ===
                      OrganizationRole.ADMIN && professors ? (
                      <Form.Item
                        label="Professors"
                        name="professorsUserId"
                        tooltip="Professors teaching the course"
                      >
                        <Select mode="multiple" placeholder="Select professors">
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
                    ) : (
                      <></>
                    )}
                  </Col>
                  <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                    <Form.Item
                      name="course-features"
                      label="Course Features"
                      tooltip="Enable or disable features for this course"
                    >
                      <Checkbox.Group className="w-full">
                        <Row justify="start">
                          <Col xs={{ span: 12 }} sm={{ span: 6 }}>
                            <Checkbox
                              value="chatBotEnabled"
                              style={{ lineHeight: '32px' }}
                            >
                              Chatbot&nbsp;
                              <Tooltip
                                title={
                                  'This feature allows students to ask an AI chatbot questions that will answer their questions based on uploaded course content (located in course admin settings)'
                                }
                              >
                                <QuestionCircleOutlined
                                  style={{ color: 'gray' }}
                                />
                              </Tooltip>
                            </Checkbox>
                          </Col>
                          <Col xs={{ span: 12 }} sm={{ span: 6 }}>
                            <Checkbox
                              value="queueEnabled"
                              style={{ lineHeight: '32px' }}
                            >
                              Queues&nbsp;
                              <Tooltip
                                title={
                                  'This feature allows students to ask questions in a queue that can then be answered by the professor or a TA. Suitable for online, hybrid, and in-person office hours and labs.'
                                }
                              >
                                <QuestionCircleOutlined
                                  style={{ color: 'gray' }}
                                />
                              </Tooltip>
                            </Checkbox>
                          </Col>
                          <Col xs={{ span: 24 }} sm={{ span: 12 }}>
                            <Checkbox
                              value="asyncQueueEnabled"
                              style={{ lineHeight: '32px' }}
                            >
                              Asynchronous Question Centre&nbsp;
                              <Tooltip
                                title={
                                  'This feature allows students to ask questions asynchronously (e.g. outside of office hours or labs) that can then be answered by the professor. It also features automatic AI-generated answers based on uploaded course content.'
                                }
                              >
                                <QuestionCircleOutlined
                                  style={{ color: 'gray' }}
                                />
                              </Tooltip>
                            </Checkbox>
                          </Col>
                        </Row>
                      </Checkbox.Group>
                    </Form.Item>
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
  return profile && isAuthorized && organization ? (
    <>
      <Head>
        <title>{organization?.name} | Edit Course</title>
      </Head>

      <StandardPageContainer>
        <NavBar />
        {isAdmin && (
          <Breadcrumb separator=">" style={{ marginTop: 10, marginBottom: 20 }}>
            <Breadcrumb.Item href="/organization/settings">
              Organization Settings
            </Breadcrumb.Item>
            <Breadcrumb.Item href="">Course</Breadcrumb.Item>
          </Breadcrumb>
        )}
        <RenderAddCourse />
      </StandardPageContainer>
    </>
  ) : (
    <Spin
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    />
  )
}
