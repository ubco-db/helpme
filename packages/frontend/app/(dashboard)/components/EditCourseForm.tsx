'use client'

import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { formatSemesterDate } from '@/app/utils/timeFormatUtils'
import {
  COURSE_TIMEZONES,
  GetOrganizationResponse,
  OrganizationCourseResponse,
  OrganizationProfessor,
  OrganizationRole,
  User,
} from '@koh/common'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  message,
  Select,
  Tag,
  Tooltip,
} from 'antd'
import { useEffect, useState } from 'react'
import { CrownFilled, QuestionCircleOutlined } from '@ant-design/icons'
import ProfInvites from './ProfInvites'

type EditCourseFormProps = {
  courseData: OrganizationCourseResponse
  organization: GetOrganizationResponse
  fetchCourseData: () => void
  user: User
}

const EditCourseForm: React.FC<EditCourseFormProps> = ({
  courseData,
  organization,
  fetchCourseData,
  user,
}) => {
  const [formGeneral] = Form.useForm()
  const [professors, setProfessors] = useState<OrganizationProfessor[]>()
  const [isCourseNameTooLong, setIsCourseNameTooLong] = useState(
    courseData?.course?.name?.length && courseData.course.name.length > 14,
  )

  const isAdmin =
    user && user.organization?.organizationRole === OrganizationRole.ADMIN

  const updateGeneral = async () => {
    const formValues = await formGeneral.getFieldsValue()

    const courseNameField = formValues.courseName
    const coordinatorEmailField = formValues.coordinatorEmail
    const sectionGroupNameField = formValues.sectionGroupName
    const zoomLinkField = formValues.zoomLink
    const courseTimezoneField = formValues.courseTimezone
    const semesterIdField = formValues.semesterId
    const profIdsField = isAdmin ? formValues.professorsUserId : [user.id]

    if (
      courseNameField === courseData.course?.name &&
      coordinatorEmailField === courseData.course?.coordinator_email &&
      sectionGroupNameField === courseData.course?.sectionGroupName &&
      zoomLinkField === courseData.course?.zoomLink &&
      courseTimezoneField === courseData.course?.timezone &&
      semesterIdField === courseData.course?.semester?.id &&
      profIdsField === courseData.profIds
    ) {
      message.info('Course was not updated as information has not been changed')
      return
    }

    if (courseNameField.length < 1) {
      message.error('Course name cannot be empty')
      return
    }

    if (
      courseData.course?.coordinator_email &&
      coordinatorEmailField.length < 1
    ) {
      message.error('Coordinator email cannot be empty')
      return
    }

    if (courseData.course?.timezone && courseTimezoneField.length < 1) {
      message.error('Course timezone cannot be empty')
      return
    }

    if (
      !Array.isArray(profIdsField) ||
      (professors &&
        !profIdsField.every(
          (profId) =>
            typeof profId === 'number' &&
            professors.find((prof) => prof.userId === profId),
        ))
    ) {
      message.error('One or more selected professors are invalid')
      return
    }

    await API.organizations
      .updateCourse(organization.id, Number(courseData.courseId), {
        name: courseNameField,
        coordinator_email: coordinatorEmailField ?? '',
        sectionGroupName: sectionGroupNameField,
        zoomLink: zoomLinkField ?? '',
        timezone: courseTimezoneField,
        semesterId: semesterIdField,
        profIds: profIdsField,
      })
      .then(() => {
        message.success('Course was updated')
        fetchCourseData()
      })
      .catch((error) => {
        const errorMessage = getErrorMessage(error)
        message.error(errorMessage)
      })
  }

  useEffect(() => {
    const fetchProfessors = async () => {
      if (!isAdmin) return
      await API.organizations
        .getProfessors(organization.id, courseData.courseId)
        .then((response) => {
          setProfessors(response ?? [])
        })
        .catch((error) => {
          message.error(error.response.data.message)
          setProfessors([])
        })
    }
    fetchProfessors()
  }, [courseData.courseId, isAdmin, organization.id])

  return (
    <>
      <Card variant="outlined" title="Edit Course">
        <Form
          form={formGeneral}
          layout="vertical"
          initialValues={{
            courseName: courseData.course?.name,
            coordinatorEmail: courseData.course?.coordinator_email,
            sectionGroupName: courseData.course?.sectionGroupName,
            zoomLink: courseData.course?.zoomLink,
            courseTimezone: courseData.course?.timezone,
            semesterId: courseData.course?.semester?.id ?? -1,
            professorsUserId: courseData.profIds,
          }}
          onValuesChange={(changedValues, allValues) => {
            if (changedValues.courseName) {
              if (changedValues.courseName.length > 14) {
                setIsCourseNameTooLong(true)
              } else {
                setIsCourseNameTooLong(false)
              }
            }
          }}
          onFinish={() => updateGeneral()}
        >
          <div className="flex flex-col md:flex-row md:space-x-3">
            <div className="flex w-1/2 flex-col">
              <Form.Item
                label="Course Name"
                name="courseName"
                tooltip="Name of the course (e.g. COSC 111). Please try to keep this short as long course names look bad on various UI elements."
                className="mb-1 flex-1"
                rules={[
                  { required: true, message: 'Please input a course name' },
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

            <Form.Item
              label="Coordinator Email"
              name="coordinatorEmail"
              tooltip="Email of the coordinator of the course"
              className="flex-1"
            >
              <Input allowClear={true} />
            </Form.Item>
          </div>

          <div className="flex flex-col md:flex-row md:space-x-3">
            <Form.Item
              label="Section"
              name="sectionGroupName"
              tooltip="Name of the section group (E.g. if you're in COSC 111 001, the section group is 001)"
              className="flex-1"
            >
              <Input allowClear={true} placeholder="001" />
            </Form.Item>

            <Form.Item
              label="Zoom Link"
              name="zoomLink"
              tooltip="Default link to the zoom meeting for queues. Each queue can also have a unique zoom link which will automatically overwrite this one. When a student is helped, they will have the option to click this link."
              className="flex-1"
            >
              <Input
                allowClear={true}
                placeholder={
                  !courseData.course?.zoomLink
                    ? '[No Zoom/Teams link set]'
                    : undefined
                }
              />
            </Form.Item>
          </div>

          <div className="flex flex-col md:flex-row md:space-x-3">
            <Form.Item
              label="Course Timezone"
              name="courseTimezone"
              tooltip="Timezone of the course"
              className="flex-1"
              rules={[{ required: true, message: 'Please select a timezone' }]}
            >
              <Select>
                {COURSE_TIMEZONES.map((timezone) => (
                  <Select.Option value={timezone} key={timezone}>
                    {timezone}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="Semester"
              name="semesterId"
              className="flex-1"
              rules={[{ required: false }]}
            >
              <Select
                placeholder="Select Semester"
                notFoundContent="Your organization does not seem to have any semesters yet."
              >
                {organization.semesters.map((semester) => (
                  <Select.Option key={semester.id} value={semester.id}>
                    <span>{`${semester.name}`}</span>{' '}
                    <span className="font-normal">
                      {formatSemesterDate(semester)}
                    </span>
                    {semester.endDate &&
                      new Date(semester.endDate) < new Date() && (
                        <span style={{ color: 'red', marginLeft: 6 }}>
                          (ended)
                        </span>
                      )}
                  </Select.Option>
                ))}
                <Select.Option key={'none'} value={-1}>
                  <span>No semester</span>
                </Select.Option>
              </Select>
            </Form.Item>
          </div>

          <div className="flex flex-col md:flex-row md:space-x-3">
            {user.organization?.organizationRole === OrganizationRole.ADMIN &&
            professors ? (
              <Form.Item
                label="Professors"
                name="professorsUserId"
                tooltip="Professors teaching the course"
                className="flex-1"
              >
                <Select
                  mode="multiple"
                  placeholder="Select professors"
                  showSearch
                  optionFilterProp="label"
                  options={professors.map((prof: OrganizationProfessor) => ({
                    key: `${prof.organizationUser.name}-${prof.organizationUser.id}`,
                    label: (
                      <span>
                        {prof.organizationUser.name}
                        {prof.trueRole == OrganizationRole.ADMIN && (
                          <Tooltip
                            title={
                              'This user is an organization administrator.'
                            }
                          >
                            <CrownFilled
                              className={
                                'ml-1 text-yellow-500 transition-all hover:text-yellow-300'
                              }
                            />
                          </Tooltip>
                        )}
                      </span>
                    ),
                    value: prof.organizationUser.id,
                  }))}
                  filterSort={(optionA, optionB) =>
                    (optionA?.key ?? '')
                      .toLowerCase()
                      .localeCompare((optionB?.key ?? '').toLowerCase())
                  }
                  tagRender={(props) => {
                    const { label, value, closable, onClose } = props
                    const onPreventMouseDown = (
                      event: React.MouseEvent<HTMLSpanElement>,
                    ) => {
                      event.preventDefault()
                      event.stopPropagation()
                    }
                    // find the professor with the given id and see if they have lacksProfOrgRole
                    const match = professors.find(
                      (prof) => prof.organizationUser.id === value,
                    )
                    const lacksProfOrgRole = ![
                      OrganizationRole.ADMIN,
                      OrganizationRole.PROFESSOR,
                    ].includes(match?.trueRole ?? OrganizationRole.MEMBER)

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
          </div>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className="h-auto w-full p-3"
            >
              Update
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </>
  )
}

export default EditCourseForm
