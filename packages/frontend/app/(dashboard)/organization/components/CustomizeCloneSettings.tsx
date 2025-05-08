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
import { formatSemesterDate } from '@/app/utils/timeFormatUtils'
interface CustomizeCloneSettingsProps {
  courses: CourseResponse[]
  professors: OrganizationProfessor[]
  selectedCourseIds: number[]
  defaultCloneSettings: CourseCloneAttributes
  customCloneSettings: BatchCourseCloneAttributes
  setCustomCloneSettings: (settings: BatchCourseCloneAttributes) => void
  organizationSemesters: SemesterPartial[]
}

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
          className="h-full w-full"
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
    <div className="relative flex h-full gap-2">
      <div className="flex w-1/3">
        <Table
          dataSource={selectedCourses}
          columns={columns}
          size="small"
          className="w-full"
          showHeader={false}
          pagination={selectedCourses.length > 16 ? { pageSize: 16 } : false}
          rowClassName={(record) =>
            record.courseId === selectedCourseId
              ? 'bg-helpmeblue text-white hover:text-black'
              : 'bg-white hover:cursor-pointer'
          }
        />
      </div>
      <div className="absolute left-1/3 h-full w-0.5 translate-x-1.5 transform bg-gray-300"></div>
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
                      <span className="font-normal">
                        {formatSemesterDate(semester)}
                      </span>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="Course Attributes to Clone">
                <div className="ml-4 flex flex-col">
                  <Form.Item
                    name={['toClone', 'coordinator_email']}
                    valuePropName="checked"
                    noStyle
                  >
                    <Checkbox>Coordinator Email</Checkbox>
                  </Form.Item>
                  <Form.Item
                    name={['toClone', 'zoomLink']}
                    valuePropName="checked"
                    noStyle
                  >
                    <Checkbox>Zoom Link</Checkbox>
                  </Form.Item>
                  <Form.Item
                    name={['toClone', 'courseInviteCode']}
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
                              Include Chatbot Documents (This process will take
                              a long time)
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
                                    disabled={
                                      !chatBotEnabled || !documentsEnabled
                                    }
                                  >
                                    Include Manually Inserted Questions from
                                    Chatbot Interactions
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
