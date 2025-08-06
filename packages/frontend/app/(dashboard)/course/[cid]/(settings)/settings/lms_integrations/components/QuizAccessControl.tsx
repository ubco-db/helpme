'use client'

import React, { useState } from 'react'
import {
  Card,
  Select,
  Checkbox,
  Button,
  Alert,
  Switch,
  Tooltip,
  Space,
  Typography,
  Tag,
  Divider,
} from 'antd'
import { EyeOutlined, WarningOutlined } from '@ant-design/icons'
import { LMSQuiz, LMSResourceType } from '@koh/common'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { message } from 'antd'

const { Option } = Select
const { Text } = Typography

interface QuizAccessControlProps {
  courseId: number
  quizzes: LMSQuiz[]
  lmsSynchronize: boolean
  onUpdateCallback: () => void
  selectedResourceTypes: LMSResourceType[]
}

interface QuizPreviewProps {
  quiz: LMSQuiz
}

const QuizPreview: React.FC<QuizPreviewProps> = ({ quiz }) => {
  const getPreviewContent = () => {
    let content = `Quiz: ${quiz.name}\n`
    content += `Instructions: ${quiz.instructions || 'No instructions provided'}\n`

    if (quiz.dueDate) {
      content += `Due Date: ${new Date(quiz.dueDate).toLocaleDateString()}\n`
    }

    if (quiz.timeLimit) {
      content += `Time Limit: ${quiz.timeLimit} minutes\n`
    }

    content += `Allowed Attempts: ${quiz.allowedAttempts}\n`

    if (quiz.accessLevel === 'LOGISTICS_ONLY') {
      content += `\n⚠️ Only basic quiz information will be available to students.`
      return content
    }

    if (quiz.accessLevel === 'LOGISTICS_AND_QUESTIONS') {
      content += `\n📝 Questions will be visible but no answers or comments.`
      return content
    }

    if (quiz.accessLevel === 'LOGISTICS_QUESTIONS_GENERAL_COMMENTS') {
      content += `\n📝 Questions and general comments will be visible.`
      if (quiz.includeGeneralComments) {
        content += `\n💬 General comments: Enabled`
      }
      return content
    }

    if (quiz.accessLevel === 'FULL_ACCESS') {
      content += `\n🔓 Full access enabled with the following comment settings:`
      content += `\n💬 General comments: ${quiz.includeGeneralComments ? 'Enabled' : 'Disabled'}`
      content += `\n✅ Correct answer comments: ${quiz.includeCorrectAnswerComments ? 'Enabled' : 'Disabled'}`
      content += `\n❌ Incorrect answer comments: ${quiz.includeIncorrectAnswerComments ? 'Enabled' : 'Disabled'}`

      if (
        quiz.includeCorrectAnswerComments ||
        quiz.includeIncorrectAnswerComments
      ) {
        content += `\n\n⚠️ WARNING: Answer information will be visible to students!`
      }
    }

    return content
  }

  return (
    <div className="quiz-preview mt-2 rounded border bg-gray-50 p-4">
      <Text strong className="mb-2 block">
        What students will see:
      </Text>
      <pre className="mb-0 whitespace-pre-wrap text-sm text-gray-700">
        {getPreviewContent()}
      </pre>
    </div>
  )
}

const QuizAccessControl: React.FC<QuizAccessControlProps> = ({
  courseId,
  quizzes,
  lmsSynchronize,
  onUpdateCallback,
  selectedResourceTypes,
}) => {
  const [loading, setLoading] = useState<Record<number, boolean>>({})
  const [previewVisible, setPreviewVisible] = useState<Record<number, boolean>>(
    {},
  )

  const isQuizzesEnabled = selectedResourceTypes.includes(
    LMSResourceType.QUIZZES,
  )

  const updateQuizAccess = async (quizId: number, config: any) => {
    setLoading((prev) => ({ ...prev, [quizId]: true }))
    try {
      await API.lmsIntegration.updateQuizAccess(courseId, quizId, config)
      message.success('Quiz access updated successfully')
      onUpdateCallback()
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoading((prev) => ({ ...prev, [quizId]: false }))
    }
  }

  const toggleQuizSync = async (quizId: number, enabled: boolean) => {
    setLoading((prev) => ({ ...prev, [quizId]: true }))
    try {
      await API.lmsIntegration.toggleSyncQuiz(courseId, quizId, enabled)
      message.success(
        `Quiz sync ${enabled ? 'enabled' : 'disabled'} successfully`,
      )
      onUpdateCallback()
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoading((prev) => ({ ...prev, [quizId]: false }))
    }
  }

  const getAccessLevelColor = (level: string) => {
    switch (level) {
      case 'LOGISTICS_ONLY':
        return 'green'
      case 'LOGISTICS_AND_QUESTIONS':
        return 'blue'
      case 'LOGISTICS_QUESTIONS_GENERAL_COMMENTS':
        return 'orange'
      case 'FULL_ACCESS':
        return 'red'
      default:
        return 'default'
    }
  }

  const getAccessLevelDisplay = (level: string) => {
    switch (level) {
      case 'LOGISTICS_ONLY':
        return 'Logistics Only'
      case 'LOGISTICS_AND_QUESTIONS':
        return 'Questions Only'
      case 'LOGISTICS_QUESTIONS_GENERAL_COMMENTS':
        return 'Questions + Comments'
      case 'FULL_ACCESS':
        return 'Full Access'
      default:
        return level
    }
  }

  if (!isQuizzesEnabled) {
    return (
      <Alert
        type="info"
        message="Quiz synchronization is disabled"
        description="Enable quiz synchronization in the Resource Selector to configure quiz access."
        showIcon
      />
    )
  }

  if (!lmsSynchronize) {
    return (
      <Alert
        type="warning"
        message="LMS synchronization is disabled"
        description="Enable LMS synchronization to configure quiz access."
        showIcon
      />
    )
  }

  if (quizzes.length === 0) {
    return (
      <Alert
        type="info"
        message="No quizzes found"
        description="No quizzes were found in your LMS course. Quizzes will appear here once they are created in your LMS."
        showIcon
      />
    )
  }

  return (
    <div className="space-y-4">
      <Alert
        type="warning"
        message="Quiz Access Configuration"
        description="Configure what quiz information students can access through the chatbot. Be careful with answer and comment settings as they may reveal sensitive information."
        showIcon
        icon={<WarningOutlined />}
      />

      {quizzes.map((quiz) => (
        <Card key={quiz.id} size="small" className="quiz-config-card">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <Text strong className="text-lg">
                  {quiz.name}
                </Text>
                <Tag color={getAccessLevelColor(quiz.accessLevel)}>
                  {getAccessLevelDisplay(quiz.accessLevel)}
                </Tag>
                {quiz.syncEnabled && <Tag color="green">Synced</Tag>}
              </div>
              {quiz.description && (
                <Text type="secondary" className="mb-2 block text-sm">
                  {quiz.description}
                </Text>
              )}
              <div className="flex gap-4 text-sm text-gray-600">
                {quiz.dueDate && (
                  <span>
                    Due: {new Date(quiz.dueDate).toLocaleDateString()}
                  </span>
                )}
                {quiz.timeLimit && <span>Time: {quiz.timeLimit}min</span>}
                <span>Attempts: {quiz.allowedAttempts}</span>
              </div>
            </div>
            <Switch
              checked={quiz.syncEnabled}
              onChange={(enabled) => toggleQuizSync(quiz.id, enabled)}
              loading={loading[quiz.id]}
              checkedChildren="Synced"
              unCheckedChildren="Disabled"
            />
          </div>

          <Divider className="my-3" />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Access Level:
              </label>
              <Select
                value={quiz.accessLevel}
                onChange={(value) =>
                  updateQuizAccess(quiz.id, {
                    accessLevel: value,
                    includeGeneralComments: quiz.includeGeneralComments,
                    includeCorrectAnswerComments:
                      quiz.includeCorrectAnswerComments,
                    includeIncorrectAnswerComments:
                      quiz.includeIncorrectAnswerComments,
                  })
                }
                className="w-full"
                loading={loading[quiz.id]}
              >
                <Option value="LOGISTICS_ONLY">
                  <Space>
                    <Text>Logistics Only</Text>
                    <Text type="secondary" className="text-xs">
                      (Name, due date, instructions)
                    </Text>
                  </Space>
                </Option>
                <Option value="LOGISTICS_AND_QUESTIONS">
                  <Space>
                    <Text>+ Questions</Text>
                    <Text type="secondary" className="text-xs">
                      (No answers or comments)
                    </Text>
                  </Space>
                </Option>
                <Option value="LOGISTICS_QUESTIONS_GENERAL_COMMENTS">
                  <Space>
                    <Text>+ General Comments</Text>
                    <Text type="secondary" className="text-xs">
                      (Always displayed comments)
                    </Text>
                  </Space>
                </Option>
                <Option value="FULL_ACCESS">
                  <Space>
                    <Text>Full Access</Text>
                    <Text type="secondary" className="text-xs">
                      (Includes answers - be careful!)
                    </Text>
                  </Space>
                </Option>
              </Select>
            </div>

            {(quiz.accessLevel === 'LOGISTICS_QUESTIONS_GENERAL_COMMENTS' ||
              quiz.accessLevel === 'FULL_ACCESS') && (
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Comment Types:
                </label>
                <div className="space-y-2">
                  <div>
                    <Checkbox
                      checked={quiz.includeGeneralComments}
                      onChange={(e) =>
                        updateQuizAccess(quiz.id, {
                          accessLevel: quiz.accessLevel,
                          includeGeneralComments: e.target.checked,
                          includeCorrectAnswerComments:
                            quiz.includeCorrectAnswerComments,
                          includeIncorrectAnswerComments:
                            quiz.includeIncorrectAnswerComments,
                        })
                      }
                      disabled={loading[quiz.id]}
                    >
                      <Text className="text-sm">General Comments</Text>
                      <Text type="secondary" className="ml-6 block text-xs">
                        Always displayed feedback
                      </Text>
                    </Checkbox>
                  </div>
                  {quiz.accessLevel === 'FULL_ACCESS' && (
                    <>
                      <div>
                        <Checkbox
                          checked={quiz.includeCorrectAnswerComments}
                          onChange={(e) =>
                            updateQuizAccess(quiz.id, {
                              accessLevel: quiz.accessLevel,
                              includeGeneralComments:
                                quiz.includeGeneralComments,
                              includeCorrectAnswerComments: e.target.checked,
                              includeIncorrectAnswerComments:
                                quiz.includeIncorrectAnswerComments,
                            })
                          }
                          disabled={loading[quiz.id]}
                        >
                          <Text className="text-sm">
                            Correct Answer Comments
                          </Text>
                          <Text type="secondary" className="ml-6 block text-xs">
                            Feedback for correct responses
                          </Text>
                        </Checkbox>
                      </div>
                      <div>
                        <Checkbox
                          checked={quiz.includeIncorrectAnswerComments}
                          onChange={(e) =>
                            updateQuizAccess(quiz.id, {
                              accessLevel: quiz.accessLevel,
                              includeGeneralComments:
                                quiz.includeGeneralComments,
                              includeCorrectAnswerComments:
                                quiz.includeCorrectAnswerComments,
                              includeIncorrectAnswerComments: e.target.checked,
                            })
                          }
                          disabled={loading[quiz.id]}
                        >
                          <Text className="text-sm">
                            Incorrect Answer Comments
                          </Text>
                          <Text type="secondary" className="ml-6 block text-xs">
                            Feedback for wrong responses
                          </Text>
                        </Checkbox>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button
              type="link"
              onClick={() =>
                setPreviewVisible((prev) => ({
                  ...prev,
                  [quiz.id]: !prev[quiz.id],
                }))
              }
              icon={<EyeOutlined />}
              size="small"
            >
              {previewVisible[quiz.id]
                ? 'Hide Preview'
                : 'Preview Student View'}
            </Button>

            {quiz.accessLevel === 'FULL_ACCESS' &&
              (quiz.includeCorrectAnswerComments ||
                quiz.includeIncorrectAnswerComments) && (
                <Alert
                  message="⚠️ Answer information visible to students!"
                  type="error"
                  showIcon={false}
                  className="mb-0"
                />
              )}
          </div>

          {previewVisible[quiz.id] && <QuizPreview quiz={quiz} />}
        </Card>
      ))}
    </div>
  )
}

export default QuizAccessControl
