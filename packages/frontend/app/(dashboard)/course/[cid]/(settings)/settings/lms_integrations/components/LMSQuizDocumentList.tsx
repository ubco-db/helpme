import {
  CloseOutlined,
  DeleteOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  StopOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { LMSQuiz, LMSQuizAccessLevel, LMSResourceType } from '@koh/common'
import {
  Badge,
  Button,
  Collapse,
  Input,
  List,
  message,
  Pagination,
  Select,
  Spin,
  Tooltip,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import { API } from '@/app/api'
import QuizContentPreviewModal from './QuizContentPreviewModal'

export interface LMSQuizDocumentListProps {
  courseId: number
  documents: LMSQuiz[]
  loadingLMSData?: boolean
  lmsSynchronize?: boolean
  onUpdateCallback?: () => void
  selectedResourceTypes?: LMSResourceType[]
}

const accessLevelLabels = {
  [LMSQuizAccessLevel.LOGISTICS_ONLY]: 'Logistics Only',
  [LMSQuizAccessLevel.LOGISTICS_AND_QUESTIONS]: 'Logistics + Questions',
  [LMSQuizAccessLevel.LOGISTICS_QUESTIONS_GENERAL_COMMENTS]:
    'Logistics + Questions + Comments',
  [LMSQuizAccessLevel.FULL_ACCESS]: 'Full Access',
}

const accessLevelDescriptions = {
  [LMSQuizAccessLevel.LOGISTICS_ONLY]:
    'Only quiz title, due dates, time limits, and availability dates',
  [LMSQuizAccessLevel.LOGISTICS_AND_QUESTIONS]:
    'Logistics + all question text (no answers)',
  [LMSQuizAccessLevel.LOGISTICS_QUESTIONS_GENERAL_COMMENTS]:
    'Logistics + questions + general quiz comments',
  [LMSQuizAccessLevel.FULL_ACCESS]:
    'Complete quiz content including all answers and detailed feedback',
}

export default function LMSQuizDocumentList({
  courseId,
  documents,
  loadingLMSData = false,
  lmsSynchronize,
  onUpdateCallback = () => undefined,
  selectedResourceTypes = [LMSResourceType.QUIZZES],
}: LMSQuizDocumentListProps) {
  const [search, setSearch] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [loading, setLoading] = useState<string[]>([])
  const [accessLevelLoading, setAccessLevelLoading] = useState<string[]>([])
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewQuiz, setPreviewQuiz] = useState<LMSQuiz | null>(null)
  const [bulkSyncLoading, setBulkSyncLoading] = useState(false)

  const filteredDocuments = useMemo(() => {
    return documents
      .filter(
        (doc) =>
          search === '' ||
          doc.title.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => {
        // Sort by due date if available, otherwise by title
        if (a.due && b.due) {
          return new Date(a.due).getTime() - new Date(b.due).getTime()
        } else if (a.due) {
          return -1
        } else if (b.due) {
          return 1
        } else {
          return a.title.localeCompare(b.title)
        }
      })
  }, [documents, search])

  const paginatedDocuments = useMemo(() => {
    const startIndex = (page - 1) * pageSize
    return filteredDocuments.slice(startIndex, startIndex + pageSize)
  }, [filteredDocuments, page, pageSize])

  const handleToggleSync = async (quiz: LMSQuiz) => {
    if (loading.includes(quiz.id.toString())) return

    setLoading([...loading, quiz.id.toString()])
    try {
      const updatedQuiz = { ...quiz, syncEnabled: !quiz.syncEnabled }
      await API.lmsIntegration.toggleSyncQuiz(courseId, quiz.id, updatedQuiz)
      onUpdateCallback()
      message.success(
        `Quiz sync ${updatedQuiz.syncEnabled ? 'enabled' : 'disabled'}`,
      )
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoading(loading.filter((id) => id !== quiz.id.toString()))
    }
  }

  const handleAccessLevelChange = async (
    quiz: LMSQuiz,
    accessLevel: LMSQuizAccessLevel,
  ) => {
    if (accessLevelLoading.includes(quiz.id.toString())) return

    setAccessLevelLoading([...accessLevelLoading, quiz.id.toString()])
    try {
      await API.lmsIntegration.updateQuizAccessLevel(
        courseId,
        quiz.id,
        accessLevel,
      )
      onUpdateCallback()
      message.success('Quiz access level updated')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setAccessLevelLoading(
        accessLevelLoading.filter((id) => id !== quiz.id.toString()),
      )
    }
  }

  const handlePreviewQuiz = (quiz: LMSQuiz) => {
    setPreviewQuiz(quiz)
    setPreviewModalOpen(true)
  }

  const handleClosePreview = () => {
    setPreviewModalOpen(false)
    setPreviewQuiz(null)
  }

  const handleBulkDisableSync = async () => {
    if (bulkSyncLoading) return

    setBulkSyncLoading(true)
    try {
      await API.lmsIntegration.bulkUpdateQuizSync(courseId, 'disable')
      onUpdateCallback()
      message.success('Successfully disabled sync for all quizzes')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setBulkSyncLoading(false)
    }
  }

  const handleBulkEnableSync = async () => {
    if (bulkSyncLoading) return

    const allQuizIds = documents.map((quiz) => quiz.id)
    if (allQuizIds.length === 0) {
      message.warning('No quizzes available to enable')
      return
    }

    setBulkSyncLoading(true)
    try {
      await API.lmsIntegration.bulkUpdateQuizSync(
        courseId,
        'enable',
        allQuizIds,
      )
      onUpdateCallback()
      message.success('Successfully enabled sync for all quizzes')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setBulkSyncLoading(false)
    }
  }

  const getQuizBadges = (quiz: LMSQuiz) => {
    const badges = []

    if (quiz.due) {
      const dueDate = new Date(quiz.due)
      const isOverdue = dueDate < new Date()
      badges.push(
        <Badge
          key="due"
          color={isOverdue ? 'red' : 'blue'}
          text={`Due: ${dueDate.toLocaleDateString()}`}
        />,
      )
    }

    if (quiz.timeLimit) {
      badges.push(
        <Badge key="time" color="orange" text={`${quiz.timeLimit} min`} />,
      )
    }

    if (quiz.allowedAttempts) {
      badges.push(
        <Badge
          key="attempts"
          color="purple"
          text={`${quiz.allowedAttempts} attempt${quiz.allowedAttempts > 1 ? 's' : ''}`}
        />,
      )
    }

    return badges
  }

  const isQuizSyncEnabled = selectedResourceTypes.includes(
    LMSResourceType.QUIZZES,
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Search and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search quizzes..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          className="sm:w-64"
        />
        <div className="flex items-center gap-2">
          {isQuizSyncEnabled && lmsSynchronize && (
            <>
              <Button
                icon={<SyncOutlined />}
                onClick={handleBulkEnableSync}
                loading={bulkSyncLoading}
                size="small"
                type="primary"
                title="Enable sync for all quizzes"
              >
                Enable All Sync
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                onClick={handleBulkDisableSync}
                loading={bulkSyncLoading}
                size="small"
                title="Disable sync for all quizzes - useful for selective re-enabling"
              >
                Disable All Sync
              </Button>
            </>
          )}
          <span className="text-sm text-gray-600">
            {filteredDocuments.length} quiz
            {filteredDocuments.length !== 1 ? 'zes' : ''}
          </span>
        </div>
      </div>

      {/* Resource Type Warning */}
      {!isQuizSyncEnabled && (
        <div className="rounded-md border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start">
            <InfoCircleOutlined className="mt-1 text-orange-500" />
            <div className="ml-3">
              <p className="text-sm text-orange-800">
                Quiz syncing is currently disabled. Enable "Quizzes" in the
                resource selection to sync quiz content with the chatbot.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loadingLMSData ? (
        <div className="flex items-center justify-center py-8">
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* Quiz List */}
          <List
            dataSource={paginatedDocuments}
            renderItem={(quiz) => {
              const isItemLoading = loading.includes(quiz.id.toString())
              const isAccessLevelLoading = accessLevelLoading.includes(
                quiz.id.toString(),
              )
              const currentAccessLevel =
                quiz.accessLevel || LMSQuizAccessLevel.LOGISTICS_ONLY

              return (
                <List.Item
                  className={cn(
                    'mb-4 rounded-lg border border-gray-200 p-4',
                    quiz.syncEnabled && 'border-green-200 bg-green-50',
                  )}
                >
                  <div className="w-full">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-semibold text-gray-900">
                          {quiz.title}
                        </h3>

                        {quiz.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                            {quiz.description.replace(/<[^>]*>/g, '')}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap gap-2">
                          {getQuizBadges(quiz)}
                        </div>

                        {quiz.syncEnabled && (
                          <div className="mt-3">
                            <div className="mb-2 flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700">
                                Access Level:
                              </span>
                              <Tooltip
                                title={
                                  accessLevelDescriptions[currentAccessLevel]
                                }
                              >
                                <InfoCircleOutlined className="text-gray-400" />
                              </Tooltip>
                            </div>
                            <Select
                              value={currentAccessLevel}
                              onChange={(value) =>
                                handleAccessLevelChange(quiz, value)
                              }
                              loading={isAccessLevelLoading}
                              disabled={!quiz.syncEnabled}
                              className="w-64"
                              options={Object.entries(accessLevelLabels).map(
                                ([value, label]) => ({
                                  value,
                                  label,
                                }),
                              )}
                            />
                          </div>
                        )}
                      </div>

                      <div className="ml-4 flex flex-col gap-2">
                        <Button
                          icon={<EyeOutlined />}
                          onClick={() => handlePreviewQuiz(quiz)}
                          size="small"
                          title="Preview what content the chatbot will see"
                        >
                          Preview Content
                        </Button>
                        {isQuizSyncEnabled && lmsSynchronize && (
                          <Button
                            type={quiz.syncEnabled ? 'default' : 'primary'}
                            icon={
                              quiz.syncEnabled ? (
                                <CloseOutlined />
                              ) : (
                                <SyncOutlined />
                              )
                            }
                            loading={isItemLoading}
                            onClick={() => handleToggleSync(quiz)}
                            size="small"
                          >
                            {quiz.syncEnabled ? 'Disable Sync' : 'Enable Sync'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </List.Item>
              )
            }}
          />

          {/* Pagination */}
          {filteredDocuments.length > pageSize && (
            <div className="mt-4 flex justify-center">
              <Pagination
                current={page}
                pageSize={pageSize}
                total={filteredDocuments.length}
                onChange={(newPage, newPageSize) => {
                  setPage(newPage)
                  if (newPageSize) setPageSize(newPageSize)
                }}
                showSizeChanger
                showQuickJumper
                showTotal={(total, range) =>
                  `${range[0]}-${range[1]} of ${total} quizzes`
                }
              />
            </div>
          )}

          {/* Empty State */}
          {filteredDocuments.length === 0 && !loadingLMSData && (
            <div className="py-8 text-center">
              <p className="text-gray-500">
                {search ? 'No quizzes match your search.' : 'No quizzes found.'}
              </p>
            </div>
          )}
        </>
      )}

      {/* Preview Modal */}
      {previewQuiz && (
        <QuizContentPreviewModal
          quiz={previewQuiz}
          courseId={courseId}
          currentAccessLevel={
            previewQuiz.accessLevel || LMSQuizAccessLevel.LOGISTICS_ONLY
          }
          open={previewModalOpen}
          onClose={handleClosePreview}
        />
      )}
    </div>
  )
}
