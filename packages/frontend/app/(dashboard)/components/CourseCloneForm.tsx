'use client'

import { useEffect, useState } from 'react'
import {
  Checkbox,
  Form,
  FormInstance,
  Input,
  message,
  Select,
  Tag,
  Tooltip,
} from 'antd'
import {
  GetOrganizationResponse,
  OrganizationProfessor,
  OrganizationRole,
} from '@koh/common'
import { API } from '@/app/api'
import { formatSemesterDate } from '@/app/utils/timeFormatUtils'

type CourseCloneFormProps = {
  form: FormInstance
  isAdmin: boolean
  organization: GetOrganizationResponse
  courseSemesterId?: number
  courseSectionGroupName: string
}

const formItemClassNames = 'mb-2 [&>div>div>label]:font-normal'

const CourseCloneForm: React.FC<CourseCloneFormProps> = ({
  form,
  isAdmin,
  organization,
  courseSemesterId,
  courseSectionGroupName,
}) => {
  const [professors, setProfessors] = useState<OrganizationProfessor[]>()

  useEffect(() => {
    form.setFieldsValue({
      newSemesterId: courseSemesterId,
      newSection: courseSectionGroupName,
    })
  }, [])

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
    <Form form={form} layout="vertical" className="w-full">
      {isAdmin && professors && professors.length > 0 && (
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
            showSearch
            optionFilterProp="label"
            options={professors.map((prof: OrganizationProfessor) => ({
              key: prof.organizationUser.id,
              label: prof.organizationUser.name,
              value: prof.organizationUser.id,
            }))}
            filterSort={(optionA, optionB) =>
              (optionA?.label ?? '')
                .toLowerCase()
                .localeCompare((optionB?.label ?? '').toLowerCase())
            }
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
      )}
      <Form.Item
        label="Section Group Name for Cloned Course"
        name="newSection"
        rules={[{ required: false }]}
      >
        <Input placeholder="Enter course section" />
      </Form.Item>
      <Form.Item
        label="Semester for Cloned Course"
        name="newSemesterId"
        className="flex-1"
        rules={[{ required: false }]}
      >
        <Select
          placeholder="Select Semester"
          notFoundContent="There are no available semesters in this organization to clone to."
        >
          {organization.semesters.map((semester) => (
            <Select.Option key={semester.id} value={semester.id}>
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
      <Form.Item
        label="Associate Clone with Original Course"
        name="associateWithOriginalCourse"
        valuePropName="checked"
        layout="horizontal"
        tooltip={
          <div className="flex max-w-80 flex-col gap-2">
            <p>
              Keeping this enabled will create a simple association between the
              cloned course and the original course.
            </p>
            <p>
              These connections are currently unused, but in the future it will
              be used for cross-semester insights.
            </p>
            <p>
              Only consider disabling this if you are cloning this course but
              plan to edit it into a completely different course (e.g. MATH 101
              → MATH 200)
            </p>
          </div>
        }
      >
        <Checkbox />
      </Form.Item>
      <h3 className="text-lg font-bold">Choose What to Clone</h3>
      <div className="ml-4">
        <Form.Item
          name={['toClone', 'coordinator_email']}
          valuePropName="checked"
          label="Coordinator Email"
          layout="horizontal"
          className={`${formItemClassNames}`}
        >
          <Checkbox />
        </Form.Item>
        <Form.Item
          name={['toClone', 'zoomLink']}
          valuePropName="checked"
          label="Zoom Link"
          layout="horizontal"
          className={`${formItemClassNames}`}
        >
          <Checkbox />
        </Form.Item>
        <Form.Item
          name={['toClone', 'courseInviteCode']}
          valuePropName="checked"
          label="Course Invite Code"
          layout="horizontal"
          className={`${formItemClassNames}`}
        >
          <Checkbox />
        </Form.Item>

        <Form.Item
          name={['toClone', 'courseFeatureConfig']}
          valuePropName="checked"
          layout="horizontal"
          label="Course Features Configuration"
          tooltip="Under Course Settings, you are able to disable or toggle certain features for your course. This is asking if you would like to copy-over what is currently configured for this course."
          className={`${formItemClassNames}`}
        >
          <Checkbox />
        </Form.Item>
        <Form.Item
          name={['toClone', 'asyncCentreQuestionTypes']}
          valuePropName="checked"
          layout="horizontal"
          label="Anytime Question Hub Tags"
          tooltip="Clone over all question tags for the anytime question hub."
          className={`${formItemClassNames}`}
        >
          <Checkbox />
        </Form.Item>
        <Form.Item
          name={['toClone', 'queues']}
          valuePropName="checked"
          label="Queues"
          layout="horizontal"
          tooltip="Clone over all queues for the course. Won't do anything if no queues are created."
          className={`${formItemClassNames}`}
        >
          <Checkbox />
        </Form.Item>
        <Form.Item
          name={['toClone', 'queueInvites']}
          valuePropName="checked"
          label="Queue Invites"
          layout="horizontal"
          tooltip="Clone over all queue invites for the course (queue invites are invite links to specific queues). Won't do anything if no queue invites are created."
          className={`${formItemClassNames}`}
        >
          <Checkbox />
        </Form.Item>
      </div>
      <h4 className="ml-4 text-base font-medium">Chatbot</h4>
      <div className="ml-8">
        <Form.Item
          name={['toClone', 'chatbot', 'settings']}
          valuePropName="checked"
          label="Settings"
          layout="horizontal"
          tooltip="Clone over your current prompt, chosen model, top K, temperature, and similarity threshold. Choosing not to clone this will reset these settings to their defaults."
          className={`${formItemClassNames}`}
        >
          <Checkbox />
        </Form.Item>
        <Form.Item
          name={['toClone', 'chatbot', 'documents']}
          valuePropName="checked"
          label="Documents"
          layout="horizontal"
          tooltip="Clone the documents you uploaded to the chatbot. Note that after you clone these, you may want to review them and remove any that contain out-of-date information"
          className={`${formItemClassNames}`}
        >
          <Checkbox />
        </Form.Item>
        <Form.Item
          name={['toClone', 'chatbot', 'insertedDocuments']}
          valuePropName="checked"
          label="Inserted Documents"
          layout="horizontal"
          tooltip="Clone over any manually created chatbot document chunks you had created."
          className={`${formItemClassNames}`}
        >
          <Checkbox />
        </Form.Item>
        <Form.Item
          name={['toClone', 'chatbot', 'insertedQuestions']}
          valuePropName="checked"
          label="Inserted Questions"
          layout="horizontal"
          tooltip="Clone over any chatbot questions that were inserted as a source into the chatbot."
          className={`${formItemClassNames}`}
        >
          <Checkbox />
        </Form.Item>
      </div>
    </Form>
  )
}

export default CourseCloneForm
