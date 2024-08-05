'use client'

import {
  AsyncQuestion,
  QuestionType,
  Role,
  asyncQuestionStatus,
} from '@koh/common'
import React, { ReactElement, useCallback, useEffect, useState } from 'react'
import { Button, Popover, Segmented, Select } from 'antd'
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
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'

type AsyncCentrePageProps = {
  params: { cid: string }
}

export default function AsyncCentrePage({
  params,
}: AsyncCentrePageProps): ReactElement {
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

  useEffect(() => {
    let displayedQuestions = asyncQuestions || []
    // Apply status filter
    if (statusFilter === 'verified') {
      displayedQuestions = displayedQuestions.filter(
        (question) => question.status === asyncQuestionStatus.HumanAnswered,
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
        (question) => question.visible,
      )
    } else if (visibleFilter === 'hidden') {
      displayedQuestions = displayedQuestions.filter(
        (question) => !question.visible,
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
        className="w-full md:w-1/2"
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
        <AsyncCentreInfoColumn
          buttons={
            isStaff ? (
              <EditQueueButton
                onClick={() => setEditAsyncCentreModalOpen(true)}
              >
                Settings
              </EditQueueButton>
            ) : (
              <JoinQueueButton
                onClick={() => setCreateAsyncQuestionModalOpen(true)}
              >
                Post Question
              </JoinQueueButton>
            )
          }
        />
        <VerticalDivider />
        <div className="md:mt-4 md:max-w-[60vw] xl:max-w-[50vw]">
          {/* Filters on DESKTOP ONLY */}
          <h3 className="hidden flex-shrink-0 text-lg font-bold md:block">
            Filter Questions
          </h3>
          <div className="mb-4 hidden items-center gap-x-4 md:flex">
            <RenderQuestionStatusFilter />
            {isStaff && <RenderVisibleFilter />}
            {!isStaff && <RenderCreatorFilter />}
            <RenderQuestionTypeFilter />
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
              isStaff={isStaff}
              courseId={courseId}
            />
          ))}
        </div>
        {isStaff ? (
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
        ) : (
          <CreateAsyncQuestionModal
            courseId={courseId}
            open={createAsyncQuestionModalOpen}
            onCancel={() => setCreateAsyncQuestionModalOpen(false)}
            onCreateOrUpdateQuestion={() => {
              mutateAsyncQuestions()
              setCreateAsyncQuestionModalOpen(false)
            }}
          />
        )}
      </div>
    )
  }
}
