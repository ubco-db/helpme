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
import { Button, Form, Input, message, Select } from 'antd'
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
    const semesterNameField = formValues.semesterName
    const profIdsField = isAdmin ? formValues.professorsUserId : [user.id]

    if (
      courseNameField === courseData.course?.name &&
      coordinatorEmailField === courseData.course?.coordinator_email &&
      sectionGroupNameField === courseData.course?.sectionGroupName &&
      zoomLinkField === courseData.course?.zoomLink &&
      courseTimezoneField === courseData.course?.timezone &&
      semesterNameField ===
        `${courseData.course?.semester?.season},${courseData.course?.semester?.year}` &&
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

    if (courseData.course?.zoomLink && zoomLinkField.length < 1) {
      message.error('Zoom link cannot be empty')
      return
    }

    if (courseData.course?.timezone && courseTimezoneField.length < 1) {
      message.error('Course timezone cannot be empty')
      return
    }

    if (semesterNameField.split(',').length !== 2) {
      message.error(
        'Semester must be in the format "season,year" with comma included. E.g. Fall,2021',
      )
      return
    }

    if (
      !semesterNameField.split(',')[1] ||
      isNaN(Number(semesterNameField.split(',')[1]))
    ) {
      message.error('Year must be a number')
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
        semesterName: semesterNameField,
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
  }, [isAdmin, organization.id])

  return (
    professors && (
      <Form
        form={formGeneral}
        layout="vertical"
        initialValues={{
          courseName: courseData.course?.name,
          coordinatorEmail: courseData.course?.coordinator_email,
          sectionGroupName: courseData.course?.sectionGroupName,
          zoomLink: courseData.course?.zoomLink,
          courseTimezone: courseData.course?.timezone,
          semesterName: `${courseData.course?.semester?.season},${courseData.course?.semester?.year}`,
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
            tooltip="Link to the zoom meeting for queues. Currently, this is shared between all queues. When a student is helped, they will have the option to click this link."
            className="flex-1"
          >
            <Input allowClear={true} />
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
            name="semesterName"
            tooltip="Semester of the course"
            className="flex-1"
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
                      return Promise.reject(new Error('Year must be a number'))
                    }
                  }
                  return Promise.resolve()
                },
              },
            ]}
          >
            <Input allowClear={true} placeholder="season,year" />
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
              <Select mode="multiple" placeholder="Select professors">
                {professors.map((prof: OrganizationProfessor) => (
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
    )
  )
}

export default EditCourseForm
