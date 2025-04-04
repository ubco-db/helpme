import {
  BatchCourseCloneAttributes,
  CourseCloneAttributes,
  CourseResponse,
  OrganizationProfessor,
  SemesterPartial,
} from '@koh/common'
import Table, { ColumnsType } from 'antd/es/table'
import React, { useEffect, useMemo, useState } from 'react'
import {
  Form,
  Select,
  Checkbox,
  Button,
  message,
  notification,
  Tooltip,
  Tag,
} from 'antd'
import { fastifyIntegration } from '@sentry/nextjs'
import { FileProtectOutlined } from '@ant-design/icons'

interface CustomizeCloneSettingsProps {
  courses: CourseResponse[]
  professors: OrganizationProfessor[]
  selectedCourseIds: number[]
  defaultCloneSettings: CourseCloneAttributes
  customCloneSettings: BatchCourseCloneAttributes
  setCustomCloneSettings: (settings: BatchCourseCloneAttributes) => void
  organizationSemesters: SemesterPartial[]
}

// PAT TODO: fix the professor id display so that empty means copy originals, otherwise set new ones specified
// I like keeping the tag there for same as original so figure out a way to make it mutually exclusive

const CustomizeCloneSettings: React.FC<CustomizeCloneSettingsProps> = ({
  courses,
  professors,
  selectedCourseIds,
  defaultCloneSettings,
  customCloneSettings,
  setCustomCloneSettings,
  organizationSemesters,
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [isSelectedCourseSaved, setIsSelectedCourseSaved] =
    useState<boolean>(true)
  const [form] = Form.useForm()

  useEffect(() => {
    const updatedSettings: BatchCourseCloneAttributes = {}

    selectedCourseIds.forEach((courseId) => {
      const course = courses.find((course) => course.courseId === courseId)
      if (course) {
        updatedSettings[courseId] = {
          ...updatedSettings,
          ...defaultCloneSettings,
        }
      }
    })
    setCustomCloneSettings(updatedSettings)
  }, [selectedCourseIds, defaultCloneSettings])

  // Update form values when selected course changes
  useEffect(() => {
    if (selectedCourseId && customCloneSettings[selectedCourseId]) {
      form.setFieldsValue(customCloneSettings[selectedCourseId])
    }
  }, [selectedCourseId, form, customCloneSettings])

  const handleSaveClick = () => {
    if (selectedCourseId) {
      form.validateFields().then((values) => {
        const updatedSettings = {
          ...customCloneSettings,
          [selectedCourseId]: {
            ...customCloneSettings[selectedCourseId],
            ...values,
          },
        }
        setCustomCloneSettings(updatedSettings)
        setIsSelectedCourseSaved(true)
        message.success(
          `Saved changes to clone configuration for: ${courses.find((course) => course.courseId === selectedCourseId)?.courseName || 'selected course'}`,
        )
      })
    }
  }

  const columns: ColumnsType<CourseResponse> = [
    {
      title: 'CourseName',
      dataIndex: 'courseName',
      key: 'courseName',
      align: 'left',
      render: (text: string, course: CourseResponse) => (
        <div
          className="h-full w-full hover:cursor-pointer"
          onClick={() => {
            if (!isSelectedCourseSaved) {
              notification.open({
                message: 'One second...',
                duration: 0,
                description:
                  'Please save your current changes before viewing another course.',
                key: 'course_not_saved_notification',
                btn: (
                  <div className="flex gap-2">
                    <Button
                      size="small"
                      onClick={() => {
                        handleSaveClick()
                        notification.destroy('course_not_saved_notification')
                        setSelectedCourseId(course.courseId)
                      }}
                      type="primary"
                    >
                      Save
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        // Without hitting the save button, the previous settings will already be set
                        notification.destroy('course_not_saved_notification')
                        setIsSelectedCourseSaved(true)
                        setSelectedCourseId(course.courseId)
                      }}
                    >
                      Revert to Previous
                    </Button>
                  </div>
                ),
              })
            } else {
              setSelectedCourseId(course.courseId)
            }
          }}
        >
          {text}
        </div>
      ),
    },
  ]

  const selectedCourses = useMemo(
    () =>
      courses.filter((course) => selectedCourseIds.includes(course.courseId)),
    [courses, selectedCourseIds],
  )
  return (
    <div className="flex h-full">
      <div className="flex w-1/3 bg-gray-200">
        <Table
          dataSource={selectedCourses}
          columns={columns}
          size="small"
          className="w-full"
          showHeader={false}
          pagination={selectedCourses.length > 16 ? { pageSize: 16 } : false}
          rowClassName={(record) =>
            record.courseId === selectedCourseId
              ? 'bg-helpmeblue text-white hover:text-black '
              : 'bg-gray-100 '
          }
        />
      </div>
      <div className="h-full w-2/3 overflow-y-auto pl-4">
        {selectedCourseId ? (
          <div>
            <h2 className="mb-4">
              Finalize Specific Clone Settings for:{' '}
              {
                selectedCourses.find((c) => c.courseId === selectedCourseId)
                  ?.courseName
              }
            </h2>
            <Form
              form={form}
              layout="vertical"
              className="w-full"
              onValuesChange={() => {
                if (isSelectedCourseSaved) setIsSelectedCourseSaved(false)
              }}
            >
              <Form.Item>
                <Button
                  type="primary"
                  onClick={handleSaveClick}
                  className="w-full"
                >
                  Save Changes
                </Button>
              </Form.Item>
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
                  value={form.getFieldValue('professorIds')}
                  onChange={(values: number[]) => {
                    console.log(values)
                    let filteredValues =
                      values.includes(-1) && values.length > 1
                        ? values.filter((value: number) => value !== -1)
                        : values

                    if (filteredValues.length === 0) {
                      filteredValues = [-1]
                    }
                    form.setFieldsValue({ ['professorIds']: filteredValues })
                  }}
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
                    return value != -1 ? (
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
                    ) : (
                      <Tag
                        color={'gold'}
                        onMouseDown={onPreventMouseDown}
                        closable={closable}
                        onClose={onClose}
                        style={{ marginInlineEnd: 4 }}
                      >
                        Same as Original
                      </Tag>
                    )
                  }}
                />
              </Form.Item>
              <Form.Item
                label="Semester for Cloned Courses"
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
                  {organizationSemesters.map((semester) => (
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
                            <Checkbox>
                              Similarity Threshold for Documents
                            </Checkbox>
                          </Form.Item>
                          <Form.Item
                            name={[
                              'chatbotSettings',
                              'similarityThresholdQuestions',
                            ]}
                            noStyle
                            valuePropName="checked"
                          >
                            <Checkbox>
                              Similarity Threshold for Questions
                            </Checkbox>
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
                            <Checkbox>
                              Include Chatbot Documents (This process will take
                              a long time)
                            </Checkbox>
                          </Form.Item>
                          <Form.Item
                            noStyle
                            shouldUpdate={(prevValues, curValues) =>
                              prevValues.includeDocuments !==
                              curValues.includeDocuments
                            }
                          >
                            {({ getFieldValue }) =>
                              getFieldValue('includeDocuments') ? (
                                <Form.Item
                                  name="includeInsertedQuestions"
                                  valuePropName="checked"
                                  noStyle
                                >
                                  <Checkbox className="ml-4">
                                    Include Manually Inserted Questions from
                                    Chatbot Interactions
                                  </Checkbox>
                                </Form.Item>
                              ) : null
                            }
                          </Form.Item>
                        </div>
                      </Form.Item>
                    </>
                  ) : null
                }
              </Form.Item>
            </Form>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            Select a course to customize clone settings
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomizeCloneSettings
