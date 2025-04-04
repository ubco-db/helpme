import { CourseCloneAttributes, SemesterPartial } from '@koh/common'
import { Checkbox, Form, Select, FormInstance } from 'antd'
import React, { useEffect } from 'react'

type DefaultCourseSettingsSelectionProps = {
  defaultValues: CourseCloneAttributes
  organizationSemesters: SemesterPartial[]
  form: FormInstance
}

const DefaultCourseSettingsSelection: React.FC<
  DefaultCourseSettingsSelectionProps
> = ({ defaultValues, organizationSemesters, form }) => {
  useEffect(() => {
    form.resetFields()
  }, [defaultValues, form])

  return (
    <Form
      form={form}
      layout="vertical"
      className="w-full"
      initialValues={defaultValues}
    >
      <Form.Item
        label="Semester for Cloned Courses"
        name="newSemesterId"
        className="flex-1"
        rules={[{ required: true, message: 'Please select a semester' }]}
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
                    name={['chatbotSettings', 'similarityThresholdDocuments']}
                    noStyle
                    valuePropName="checked"
                  >
                    <Checkbox>Similarity Threshold for Documents</Checkbox>
                  </Form.Item>
                  <Form.Item
                    name={['chatbotSettings', 'similarityThresholdQuestions']}
                    noStyle
                    valuePropName="checked"
                  >
                    <Checkbox>Similarity Threshold for Questions</Checkbox>
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
                      Include Chatbot Documents (This process will take a long
                      time)
                    </Checkbox>
                  </Form.Item>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, curValues) =>
                      prevValues.includeDocuments !== curValues.includeDocuments
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
                            Include Manually Inserted Questions from Chatbot
                            Interactions
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
  )
}

export default DefaultCourseSettingsSelection
