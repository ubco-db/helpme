'use client'

import { API } from '@/app/api'
import {
  COURSE_TIMEZONES,
  GetOrganizationResponse,
  OrganizationCourseResponse,
  OrganizationProfessor,
  OrganizationRole,
  User,
} from '@koh/common'
import { Button, Form, Input, message, Select, Tag, Tooltip } from 'antd'
import { useEffect, useState } from 'react'

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

    // PAT TODO: DO VALIDATION HERE FOR SEMESTERS

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

    // PAT TODO: fix this route to support semester changes

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
        const errorMessage = error.response.data.message
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
    <Form
      form={formGeneral}
      layout="vertical"
      initialValues={{
        courseName: courseData.course?.name,
        coordinatorEmail: courseData.course?.coordinator_email,
        sectionGroupName: courseData.course?.sectionGroupName,
        zoomLink: courseData.course?.zoomLink,
        courseTimezone: courseData.course?.timezone,
        semesterId: courseData.course?.semester?.id,
        professorsUserId: courseData.profIds,
      }}
      onFinish={() => updateGeneral()}
    >
      <div className="flex flex-col md:flex-row md:space-x-3">
        <Form.Item
          label="Course Name"
          name="courseName"
          tooltip="Name of the course"
          className="flex-1"
          rules={[{ required: true, message: 'Please input a course name' }]}
        >
          <Input allowClear={true} />
        </Form.Item>

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
          label="Section Group Name"
          name="sectionGroupName"
          tooltip="Name of the section group (E.g. if you're in COSC 111 001, the section group is 001)"
          className="flex-1"
        >
          <Input allowClear={true} />
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
          rules={[{ required: true, message: 'Please select a semester' }]}
        >
          <Select placeholder="Select Semester">
            {/* See if this option is really necessary. without it, people wont be able to change their courses unless they set their course's semester */}
            <Select.Option key={-1} value={-1}>
              None
            </Select.Option>
            {organization.semesters.map((semester) => (
              <Select.Option key={semester.id} value={semester.id}>
                <span>{`${semester.name}`}</span>{' '}
                {`(${new Date(semester.startDate).toLocaleDateString()} - ${new Date(semester.endDate).toLocaleDateString()})`}
              </Select.Option>
            ))}
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
              options={professors.map((prof: OrganizationProfessor) => ({
                label: prof.organizationUser.name,
                value: prof.organizationUser.id,
              }))}
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
      </div>

      <Form.Item>
        <Button type="primary" htmlType="submit" className="h-auto w-full p-3">
          Update
        </Button>
      </Form.Item>
    </Form>
  )
}

export default EditCourseForm
