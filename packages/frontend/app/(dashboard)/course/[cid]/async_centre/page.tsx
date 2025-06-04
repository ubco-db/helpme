'use client'

import {
  AsyncQuestion,
  QuestionType,
  Role,
  asyncQuestionStatus,
} from '@koh/common'
import React, {
  ReactElement,
  useCallback,
  useEffect,
  useState,
  use,
} from 'react'
import { Button, Checkbox, Popover, Segmented, Select, Tooltip } from 'antd'
import { useUserInfo } from '@/app/contexts/userContext'
import { getRoleInCourse } from '@/app/utils/generalUtils'
import { useAsnycQuestions } from '@/app/hooks/useAsyncQuestions'
import AsyncCentreInfoColumn from './components/AsyncCentreInfoColumn'
import {
  EditQueueButton,
  JoinQueueButton,
} from '../components/QueueInfoColumnButton'
import VerticalDivider from '@/app/components/VerticalDivider'
import CreateAsyncQuestionModal from './components/modals/CreateAsyncQuestionModal'
import AsyncQuestionCard from './components/AsyncQuestionCard'
import EditAsyncCentreModal from './components/modals/EditAsyncCentreModal'
import { QuestionTagElement } from '../components/QuestionTagElement'
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  FilterOutlined,
  QuestionCircleOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'
import { useChatbotContext } from '../components/chatbot/ChatbotProvider'
import { API } from '@/app/api'
import ConvertChatbotQToAnytimeQModal from './components/modals/ConvertChatbotQToAnytimeQModal'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type AsyncCentrePageProps = {
  params: Promise<{ cid: string }>
}

export default function AsyncCentrePage(
  props0: AsyncCentrePageProps,
): ReactElement {
  const params = use(props0.params)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const courseId = Number(params.cid)
  const { userInfo } = useUserInfo()
  const role = getRoleInCourse(userInfo, courseId)
  const isStaff = role === Role.TA || role === Role.PROFESSOR
  const [asyncQuestions, mutateAsyncQuestions] = useAsnycQuestions(courseId)
  const [createAsyncQuestionModalOpen, setCreateAsyncQuestionModalOpen] =
    useState(false)
  const [editAsyncCentreModalOpen, setEditAsyncCentreModalOpen] =
    useState(false)
  const [questionTypes] = useQuestionTypes(courseId, null)
  const [showStudents, setShowStudents] = useState(false) // for when staff want to de-anonymize students on their end to see who posted what

  // chatbot
  const { setCid, setRenderSmallChatbot, messages } = useChatbotContext()
  useEffect(() => {
    setCid(courseId)
  }, [courseId, setCid])
  useEffect(() => {
    setRenderSmallChatbot(true)
    return () => setRenderSmallChatbot(false) // make the chatbot inactive when the user leaves the page
  }, [setRenderSmallChatbot])

  const [convertChatbotQModalOpen, setConvertChatbotQModalOpen] =
    useState(false)
  const convertChatbotQSearchParam = searchParams.get('convertChatbotQ')
  useEffect(() => {
    if (convertChatbotQSearchParam && messages.length > 1) {
      setConvertChatbotQModalOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convertChatbotQSearchParam])

  const [statusFilter, setStatusFilter] = useState<
    'all' | 'verified' | 'unverified'
  >('all')
  const [visibleFilter, setVisibleFilter] = useState<
    'all' | 'visible' | 'hidden'
  >('all')
  const [creatorFilter, setCreatorFilter] = useState<'all' | 'mine'>('all')

  const [selectedQuestionTags, setSelectedQuestionTags] = useState<
    QuestionType[]
  >([])
  const [displayedQuestions, setDisplayedQuestions] = useState<AsyncQuestion[]>(
    [],
  )
  const [sortBy, setSortBy] = useState<
    'newest' | 'oldest' | 'most-votes' | 'least-votes'
  >('newest')

  const applySort = useCallback(
    (displayedQuestions: AsyncQuestion[]) => {
      return displayedQuestions.sort((a, b) => {
        switch (sortBy) {
          case 'newest':
            return (
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
          case 'oldest':
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            )
          case 'most-votes':
            return b.votesSum - a.votesSum
          case 'least-votes':
            return a.votesSum - b.votesSum
          default:
            return 0
        }
      })
    },
    [sortBy],
  )

  // This endpoint will be called to update unread count back to 0 when this page is entered
  // May seem more inefficient but this is the only way to ensure that the unread count is accurate given that userInfo no longer tracks it
  useEffect(() => {
    API.asyncQuestions.updateUnreadAsyncCount(courseId)
  }, [])

  useEffect(() => {
    let displayedQuestions = asyncQuestions || []
    // Apply status filter
    if (statusFilter === 'verified') {
      displayedQuestions = displayedQuestions.filter(
        (question) =>
          question.status === asyncQuestionStatus.HumanAnswered ||
          question.verified,
      )
    } else if (statusFilter === 'unverified') {
      displayedQuestions = displayedQuestions.filter(
        (question) =>
          question.status === asyncQuestionStatus.AIAnswered ||
          question.status === asyncQuestionStatus.AIAnsweredNeedsAttention ||
          !question.answerText,
      )
    }
    // Apply visibility filter
    if (visibleFilter === 'visible') {
      displayedQuestions = displayedQuestions.filter(
        (question) => question.authorSetVisible && question.staffSetVisible,
      )
    } else if (visibleFilter === 'hidden') {
      displayedQuestions = displayedQuestions.filter(
        (question) => !question.authorSetVisible || !question.staffSetVisible,
      )
    }

    // Apply question type filter
    if (selectedQuestionTags.length > 0) {
      displayedQuestions = displayedQuestions.filter((question) => {
        const questionTypeIds = question.questionTypes.map((type) => type.id)
        return selectedQuestionTags.every((type) =>
          questionTypeIds.includes(type.id),
        )
      })
    }

    if (creatorFilter === 'mine') {
      displayedQuestions = displayedQuestions.filter(
        (question) => question.creatorId === userInfo.id,
      )
    }

    displayedQuestions = applySort(displayedQuestions)
    setDisplayedQuestions(displayedQuestions)
  }, [
    visibleFilter,
    statusFilter,
    asyncQuestions,
    selectedQuestionTags,
    isStaff,
    creatorFilter,
    userInfo.id,
    sortBy,
    applySort,
  ])

  const RenderQuestionTypeFilter = useCallback(() => {
    if (!questionTypes) {
      return null
    }
    return (
      <Select
        mode="multiple"
        placeholder="Select question tags"
        onChange={(value: number[]) => {
          setSelectedQuestionTags(
            questionTypes.filter((tag) => value.includes(tag.id)),
          )
        }}
        className="min-w-40 flex-grow"
        allowClear
        tagRender={(props) => {
          const tag = questionTypes.find((tag) => tag.id === props.value)
          return (
            <QuestionTagElement
              tagName={tag ? tag.name : ''}
              tagColor={tag ? tag.color : ''}
              onClick={props.onClose}
            />
          )
        }}
        optionRender={(props) => {
          const tag = questionTypes.find((tag) => tag.id === props.value)
          if (tag) {
            return (
              <QuestionTagElement tagName={tag.name} tagColor={tag.color} />
            )
          } else {
            return null
          }
        }}
        optionFilterProp="label"
        options={questionTypes.map((tag) => ({
          label: tag.name,
          value: tag.id,
        }))}
      />
    )
  }, [questionTypes])

  const RenderCreatorFilter = useCallback(() => {
    return (
      <Segmented
        className="w-fit"
        onChange={(value: 'all' | 'mine') => setCreatorFilter(value)}
        options={[
          {
            label: 'All',
            value: 'all',
            icon: <TeamOutlined />,
          },
          {
            label: 'Mine',
            value: 'mine',
            icon: <UserOutlined />,
          },
        ]}
      />
    )
  }, [])

  const RenderQuestionStatusFilter = useCallback(() => {
    return (
      <Segmented
        className="w-fit"
        onChange={(value: 'all' | 'verified' | 'unverified') =>
          setStatusFilter(value)
        }
        options={[
          {
            label: 'All',
            value: 'all',
          },
          {
            label: 'Verified',
            value: 'verified',
          },
          {
            label: 'Unverified',
            value: 'unverified',
          },
        ]}
      />
    )
  }, [])

  const RenderVisibleFilter = useCallback(() => {
    return (
      <Segmented
        className="w-fit"
        onChange={(value: 'all' | 'visible' | 'hidden') =>
          setVisibleFilter(value)
        }
        options={[
          {
            label: 'All',
            value: 'all',
          },
          {
            label: 'Visible',
            value: 'visible',
            icon: <EyeOutlined />,
          },
          {
            label: 'Hidden',
            value: 'hidden',
            icon: <EyeInvisibleOutlined />,
          },
        ]}
      />
    )
  }, [])

  if (!userInfo) {
    return <CenteredSpinner tip="Loading User Info..." />
  } else if (asyncQuestions === undefined || asyncQuestions === null) {
    return <CenteredSpinner tip="Loading Questions..." />
  } else {
    return (
      <div className="flex h-full flex-1 flex-col md:flex-row">
        <title>{`HelpMe | ${userInfo.courses.find((e) => e.course.id === courseId)?.course.name ?? ''} - Anytime Questions`}</title>
        <AsyncCentreInfoColumn
          buttons={
            <>
              {isStaff && (
                <>
                  <EditQueueButton
                    onClick={() => setEditAsyncCentreModalOpen(true)}
                  >
                    Settings
                  </EditQueueButton>
                  <Checkbox
                    className="text-lg md:mb-4 md:mt-2"
                    checked={showStudents}
                    onChange={(e) => setShowStudents(e.target.checked)}
                  >
                    Show Students (Staff Only)
                    <Tooltip
                      title={
                        "All students posts and comments are anonymized to other students (They get a different anonymous animal on each question). Staff can click this checkbox to see who posted what, just be careful not to mention the students' names in the answer or comments!"
                      }
                    >
                      <QuestionCircleOutlined className="ml-2 text-gray-500" />
                    </Tooltip>
                  </Checkbox>
                </>
              )}
              <Tooltip
                title={
                  isStaff
                    ? 'You can post a question as a staff member for demonstration or testing purposes'
                    : ''
                }
              >
                <JoinQueueButton
                  onClick={() => setCreateAsyncQuestionModalOpen(true)}
                >
                  Post Question
                </JoinQueueButton>
              </Tooltip>
            </>
          }
        />
        <VerticalDivider />
        <div className="flex-grow md:mt-4">
          {/* Filters on DESKTOP ONLY */}
          <div className="mb-4 hidden items-center gap-x-4 md:flex">
            <h3 className="hidden flex-shrink-0 text-lg font-bold md:block">
              Filter Questions
            </h3>
            <div className="hidden flex-grow items-center gap-x-4 md:flex">
              <RenderQuestionStatusFilter />
              {isStaff && <RenderVisibleFilter />}
              {!isStaff && <RenderCreatorFilter />}
              <RenderQuestionTypeFilter />
            </div>
          </div>
          <div className="mb-1 flex items-center gap-x-2">
            <h3 className="flex-shrink-0 text-lg font-bold">Sort By</h3>
            <Select
              value={sortBy}
              className="w-28"
              onChange={(value) => setSortBy(value)}
              options={[
                { label: 'Newest', value: 'newest' },
                { label: 'Oldest', value: 'oldest' },
                { label: 'Most Votes', value: 'most-votes' },
                { label: 'Least Votes', value: 'least-votes' },
              ]}
            />
            {/* Filters on MOBILE ONLY */}
            <Popover
              title="Filter Questions"
              className="md:hidden"
              content={
                <div className="flex flex-col gap-y-3">
                  <RenderQuestionStatusFilter />
                  {isStaff && <RenderVisibleFilter />}
                  {!isStaff && <RenderCreatorFilter />}
                  <RenderQuestionTypeFilter />
                </div>
              }
              trigger="click"
            >
              <Button icon={<FilterOutlined />} />
            </Popover>
          </div>

          {displayedQuestions.map((question) => (
            <AsyncQuestionCard
              key={question.id}
              question={question}
              userId={userInfo.id}
              mutateAsyncQuestions={mutateAsyncQuestions}
              userCourseRole={role}
              courseId={courseId}
              showStudents={showStudents}
            />
          ))}
        </div>
        <ConvertChatbotQToAnytimeQModal
          courseId={courseId}
          open={convertChatbotQModalOpen}
          onCancel={() => {
            router.replace(pathname)
            setConvertChatbotQModalOpen(false)
          }}
          onCreateOrUpdateQuestion={() => {
            mutateAsyncQuestions()
            router.replace(pathname)
            setConvertChatbotQModalOpen(false)
          }}
          chatbotQ={{ messages: messages }}
        />
        {isStaff && (
          <>
            {/* Note: these are not all of the modals. TAAsyncQuestionCardButtons contains PostResponseModal and StudentAsyncQuestionButtons contains a second CreateAsyncQuestionModal */}
            <EditAsyncCentreModal
              courseId={courseId}
              open={editAsyncCentreModalOpen}
              onCancel={() => setEditAsyncCentreModalOpen(false)}
              onEditSuccess={() => {
                mutateAsyncQuestions()
                setEditAsyncCentreModalOpen(false)
              }}
            />
          </>
        )}
        <CreateAsyncQuestionModal
          courseId={courseId}
          open={createAsyncQuestionModalOpen}
          onCancel={() => setCreateAsyncQuestionModalOpen(false)}
          onCreateOrUpdateQuestion={() => {
            mutateAsyncQuestions()
            setCreateAsyncQuestionModalOpen(false)
          }}
        />
      </div>
    )
  }
}
