import {
  AsyncQuestion,
  QuestionTypeParams,
  Role,
  asyncQuestionStatus,
} from '@koh/common'
import React, { ReactElement, useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'
import { useRoleInCourse } from '../../../hooks/useRoleInCourse'
import { SettingsLeftPanel } from './SettingsLeftPanel'
import { Select } from 'antd'
import { useAsnycQuestions } from '../../../hooks/useAsyncQuestions'
import AsyncCard from './AsyncCard'
import { VerticalDivider, EditQueueButton } from '../Shared/SharedComponents'
import PropTypes from 'prop-types'
import { EditAsyncQuestionsModal } from './EditAsyncQuestions'
import { QuestionType } from '../Shared/QuestionType'
import { useProfile } from '../../../hooks/useProfile'
import CreateAsyncQuestionForm from './CreateAsyncQuestionForm'

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  @media (min-width: 650px) {
    flex-direction: row;
  }
`
const QueueListContainer = styled.div`
  flex-grow: 1;
  @media (min-width: 650px) {
    margin-top: 32px;
  }
`
const NoQuestionsText = styled.div`
  font-weight: 500;
  font-size: 24px;
  color: #212934;
`

AsyncQuestionsPage.propTypes = {
  questions: PropTypes.instanceOf(AsyncQuestion),
  onClose: PropTypes.func.isRequired,
  value: PropTypes.any.isRequired,
}

export default function AsyncQuestionsPage({
  courseId,
}: {
  courseId: number
}): ReactElement {
  const role = useRoleInCourse(courseId)
  const isStaff = role === Role.TA || role === Role.PROFESSOR
  const [studentQuestionModal, setStudentQuestionModal] = useState(false)
  const [editAsyncQuestionsModal, setEditAsyncQuestionsModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [visibleFilter, setVisibleFilter] = useState('all')
  const [creatorFilter, setCreatorFilter] = useState('all') // 'all' or 'mine'

  const [questionTypeInput, setQuestionTypeInput] = useState([])

  const [questionsTypeState, setQuestionsTypeState] = useState<
    QuestionTypeParams[]
  >([])

  const [displayedQuestions, setDisplayedQuestions] = useState<AsyncQuestion[]>(
    [],
  )

  const [sortBy, setSortBy] = useState('newest')

  const profile = useProfile()

  const onTypeChange = (selectedTypes) => {
    setQuestionTypeInput(selectedTypes)
  }

  const { questions, mutateQuestions } = useAsnycQuestions(courseId)

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
    let displayedQuestions = questions || []
    // Apply status filter
    if (statusFilter === 'helped') {
      displayedQuestions = displayedQuestions.filter(
        (question) => question.status === asyncQuestionStatus.HumanAnswered,
      )
    } else if (statusFilter === 'unhelped') {
      displayedQuestions = displayedQuestions.filter(
        (question) =>
          question.status === asyncQuestionStatus.AIAnswered ||
          question.status === asyncQuestionStatus.AIAnsweredNeedsAttention,
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
    if (questionTypeInput.length > 0) {
      displayedQuestions = displayedQuestions.filter((question) => {
        const questionTypes = question.questionTypes.map((type) => type.id)
        return questionTypeInput.every((type) => questionTypes.includes(type))
      })
    }

    if (creatorFilter === 'mine') {
      displayedQuestions = displayedQuestions.filter(
        (question) => question.creatorId === profile.id,
      )
    }

    displayedQuestions = applySort(displayedQuestions)
    setDisplayedQuestions(displayedQuestions)

    const shownQuestionTypes = displayedQuestions
      .map((question) => question.questionTypes)
      .flat()
    setQuestionsTypeState(shownQuestionTypes)
  }, [
    visibleFilter,
    statusFilter,
    questions,
    questionTypeInput,
    isStaff,
    creatorFilter,
    profile.id,
    sortBy,
    applySort,
  ])

  function RenderQueueInfoCol(): ReactElement {
    return (
      <>
        {role === Role.STUDENT ? (
          <SettingsLeftPanel
            isStaff={false}
            buttons={
              <>
                <EditQueueButton
                  onClick={() => setStudentQuestionModal(true)}
                  id="post-question-button"
                  className="!w-full"
                >
                  Post your Question
                </EditQueueButton>
                <div style={{ marginBottom: '12px' }}></div>
              </>
            }
          />
        ) : (
          <SettingsLeftPanel
            isStaff={true}
            buttons={
              <>
                <EditQueueButton
                  onClick={() => setEditAsyncQuestionsModal(true)}
                >
                  Settings
                </EditQueueButton>
                <div style={{ marginBottom: '12px' }}></div>
              </>
            }
          />
        )}
      </>
    )
  }

  const RenderQuestionList = ({ renderQuestions }: any) => {
    if (!renderQuestions) {
      return (
        <NoQuestionsText>There are no questions in the queue</NoQuestionsText>
      )
    }
    return (
      <>
        {renderQuestions.map((question) => (
          <AsyncCard
            key={question.id}
            question={question}
            onStatusChange={mutateQuestions}
            isStaff={isStaff}
            userId={profile?.id}
            onQuestionTypeClick={(questionType) => {
              setQuestionTypeInput((prevInput) => {
                const index = prevInput.indexOf(questionType)
                if (index > -1) {
                  // questionType is in the array, remove it
                  return prevInput.filter((qt) => qt !== questionType)
                } else {
                  // questionType is not in the array, add it
                  return [...prevInput, questionType]
                }
              })
            }}
          />
        ))}
      </>
    )
  }

  const RenderQuestionTypeFilter = () => {
    return (
      <Select
        mode="multiple"
        placeholder="Select question tags"
        onChange={onTypeChange}
        style={{ width: '50%' }}
        value={questionTypeInput}
        tagRender={(props) => {
          const type = questionsTypeState.find(
            (type) => type.id === props.value,
          )
          return (
            <QuestionType
              typeName={type ? type.name : ''}
              typeColor={type ? type.color : ''}
              onClick={props.onClose}
            />
          )
        }}
      >
        {questionsTypeState.map((type) => (
          <Select.Option value={type.id} key={type.id}>
            {type.name}
          </Select.Option>
        ))}
      </Select>
    )
  }

  const RenderCreatorFilter = () => {
    return (
      <Select
        id="creator-filter-select"
        value={creatorFilter}
        onChange={(value) => setCreatorFilter(value)}
        className="select-filter"
      >
        <Select.Option value="all">All Questions</Select.Option>
        <Select.Option value="mine">My Questions</Select.Option>
      </Select>
    )
  }

  const RenderQuestionStatusFilter = () => {
    return (
      <>
        <Select
          id="status-filter-select"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value)}
          className="select-filter"
          style={{ width: 200 }}
        >
          <Select.Option value="all">Verification status</Select.Option>
          <Select.Option value="helped">Verified questions</Select.Option>
          <Select.Option value="unhelped">Unverified questions</Select.Option>
        </Select>
      </>
    )
  }

  const RenderVisibleFilter = () => {
    return (
      <>
        <Select
          id="visible-filter-select"
          value={visibleFilter}
          onChange={(value) => setVisibleFilter(value)}
          className="select-filter"
          style={{ width: 200 }}
        >
          <Select.Option value="all">Visibility</Select.Option>
          <Select.Option value="visible">Visible Only</Select.Option>
          <Select.Option value="hidden">Hidden Only</Select.Option>
        </Select>
      </>
    )
  }

  const RenderFilters = () => {
    return (
      <>
        <h2 className="flex-shrink-0">Filter Questions</h2>
        <div className="mb-4 flex items-center gap-x-4">
          <RenderQuestionStatusFilter />
          <RenderVisibleFilter />
          {!isStaff && <RenderCreatorFilter />}
          <RenderQuestionTypeFilter />
        </div>
      </>
    )
  }

  const RenderSortBy = () => {
    return (
      <div className="mb-1 flex items-center gap-x-4">
        <h2 className="flex-shrink-0">Sort By</h2>
        <Select
          id="sort-by-select"
          value={sortBy}
          className="sort-by-select"
          style={{ width: 200 }}
          onChange={(value) => setSortBy(value)}
        >
          <Select.Option value="newest">Newest</Select.Option>
          <Select.Option value="oldest">Oldest</Select.Option>
          <Select.Option value="most-votes">Most Votes</Select.Option>
          <Select.Option value="least-votes">Least Votes</Select.Option>
        </Select>
      </div>
    )
  }

  return (
    <>
      <Container>
        <RenderQueueInfoCol />
        <VerticalDivider />
        <QueueListContainer>
          <RenderFilters />
          <RenderSortBy />

          <RenderQuestionList renderQuestions={displayedQuestions} />
        </QueueListContainer>
      </Container>
      {isStaff ? (
        <EditAsyncQuestionsModal
          visible={editAsyncQuestionsModal}
          onClose={() => setEditAsyncQuestionsModal(false)}
          courseId={courseId}
        />
      ) : (
        <CreateAsyncQuestionForm
          visible={studentQuestionModal}
          onClose={() => setStudentQuestionModal(false)}
          onStatusChange={mutateQuestions}
        />
      )}
    </>
  )
}
