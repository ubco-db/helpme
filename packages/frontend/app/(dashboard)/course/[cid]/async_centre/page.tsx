'use client'

import {
  AsyncQuestion,
  QuestionTypeParams,
  Role,
  asyncQuestionStatus,
} from '@koh/common'
import React, { ReactElement, useCallback, useEffect, useState } from 'react'
import { Select } from 'antd'
import PropTypes from 'prop-types'
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
  const [createAsyncQuestionModalOpen, setCreateAsyncQuestionModalOpen] =
    useState(false)
  const [editAsyncCentreModalOpen, setEditAsyncCentreModalOpen] =
    useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [visibleFilter, setVisibleFilter] = useState('all')
  const [creatorFilter, setCreatorFilter] = useState<'all' | 'mine'>('all')

  const [questionTypeInput, setQuestionTypeInput] = useState([])

  const [questionsTypeState, setQuestionsTypeState] = useState<
    QuestionTypeParams[]
  >([])

  const [displayedQuestions, setDisplayedQuestions] = useState<AsyncQuestion[]>(
    [],
  )

  const [sortBy, setSortBy] = useState('newest')

  const onTypeChange = (selectedTypes) => {
    setQuestionTypeInput(selectedTypes)
  }

  const [asyncQuestions, mutateAsyncQuestions] = useAsnycQuestions(courseId)

  // const applySort = useCallback(
  //     (displayedQuestions: AsyncQuestion[]) => {
  //         return displayedQuestions.sort((a, b) => {
  //             switch (sortBy) {
  //                 case 'newest':
  //                     return (
  //                         new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  //                     )
  //                 case 'oldest':
  //                     return (
  //                         new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  //                     )
  //                 case 'most-votes':
  //                     return b.votesSum - a.votesSum
  //                 case 'least-votes':
  //                     return a.votesSum - b.votesSum
  //                 default:
  //                     return 0
  //             }
  //         })
  //     },
  //     [sortBy],
  // )

  // useEffect(() => {
  //     let displayedQuestions = questions || []
  //     // Apply status filter
  //     if (statusFilter === 'helped') {
  //         displayedQuestions = displayedQuestions.filter(
  //             (question) => question.status === asyncQuestionStatus.HumanAnswered,
  //         )
  //     } else if (statusFilter === 'unhelped') {
  //         displayedQuestions = displayedQuestions.filter(
  //             (question) =>
  //                 question.status === asyncQuestionStatus.AIAnswered ||
  //                 question.status === asyncQuestionStatus.AIAnsweredNeedsAttention,
  //         )
  //     }
  //     // Apply visibility filter
  //     if (visibleFilter === 'visible') {
  //         displayedQuestions = displayedQuestions.filter(
  //             (question) => question.visible,
  //         )
  //     } else if (visibleFilter === 'hidden') {
  //         displayedQuestions = displayedQuestions.filter(
  //             (question) => !question.visible,
  //         )
  //     }

  //     // Apply question type filter
  //     if (questionTypeInput.length > 0) {
  //         displayedQuestions = displayedQuestions.filter((question) => {
  //             const questionTypes = question.questionTypes.map((type) => type.id)
  //             return questionTypeInput.every((type) => questionTypes.includes(type))
  //         })
  //     }

  //     if (creatorFilter === 'mine') {
  //         displayedQuestions = displayedQuestions.filter(
  //             (question) => question.creatorId === profile.id,
  //         )
  //     }

  //     displayedQuestions = applySort(displayedQuestions)
  //     setDisplayedQuestions(displayedQuestions)

  //     const shownQuestionTypes = displayedQuestions
  //         .map((question) => question.questionTypes)
  //         .flat()
  //     setQuestionsTypeState(shownQuestionTypes)
  // }, [
  //     visibleFilter,
  //     statusFilter,
  //     questions,
  //     questionTypeInput,
  //     isStaff,
  //     creatorFilter,
  //     profile?.id,
  //     sortBy,
  //     applySort,
  // ])

  // const RenderQuestionTypeFilter = () => {
  //     return (
  //         <Select
  //             mode="multiple"
  //             placeholder="Select question tags"
  //             onChange={onTypeChange}
  //             style={{ width: '50%' }}
  //             value={questionTypeInput}
  //             tagRender={(props) => {
  //                 const type = questionsTypeState.find(
  //                     (type) => type.id === props.value,
  //                 )
  //                 return (
  //                     <QuestionType
  //                         typeName={type ? type.name : ''}
  //                         typeColor={type ? type.color : ''}
  //                         onClick={props.onClose}
  //                     />
  //                 )
  //             }}
  //         >
  //             {questionsTypeState.map((type) => (
  //                 <Select.Option value={type.id} key={type.id}>
  //                     {type.name}
  //                 </Select.Option>
  //             ))}
  //         </Select>
  //     )
  // }

  // const RenderCreatorFilter = () => {
  //     return (
  //         <Select
  //             id="creator-filter-select"
  //             value={creatorFilter}
  //             onChange={(value) => setCreatorFilter(value)}
  //             className="select-filter"
  //         >
  //             <Select.Option value="all">All Questions</Select.Option>
  //             <Select.Option value="mine">My Questions</Select.Option>
  //         </Select>
  //     )
  // }

  // const RenderQuestionStatusFilter = () => {
  //     return (
  //         <>
  //             <Select
  //                 id="status-filter-select"
  //                 value={statusFilter}
  //                 onChange={(value) => setStatusFilter(value)}
  //                 className="select-filter"
  //                 style={{ width: 200 }}
  //             >
  //                 <Select.Option value="all">Verification status</Select.Option>
  //                 <Select.Option value="helped">Verified questions</Select.Option>
  //                 <Select.Option value="unhelped">Unverified questions</Select.Option>
  //             </Select>
  //         </>
  //     )
  // }

  // const RenderVisibleFilter = () => {
  //     return (
  //         <>
  //             <Select
  //                 id="visible-filter-select"
  //                 value={visibleFilter}
  //                 onChange={(value) => setVisibleFilter(value)}
  //                 className="select-filter"
  //                 style={{ width: 200 }}
  //             >
  //                 <Select.Option value="all">Visibility</Select.Option>
  //                 <Select.Option value="visible">Visible Only</Select.Option>
  //                 <Select.Option value="hidden">Hidden Only</Select.Option>
  //             </Select>
  //         </>
  //     )
  // }

  // const RenderFilters = () => {
  //     return (
  //         <>
  //             <h2 className="flex-shrink-0">Filter Questions</h2>
  //             <div className="mb-4 flex items-center gap-x-4">
  //                 <RenderQuestionStatusFilter />
  //                 <RenderVisibleFilter />
  //                 {!isStaff && <RenderCreatorFilter />}
  //                 <RenderQuestionTypeFilter />
  //             </div>
  //         </>
  //     )
  // }

  // const RenderSortBy = () => {
  //     return (
  //         <div className="mb-1 flex items-center gap-x-4">
  //             <h2 className="flex-shrink-0">Sort By</h2>
  //             <Select
  //                 id="sort-by-select"
  //                 value={sortBy}
  //                 className="sort-by-select"
  //                 style={{ width: 200 }}
  //                 onChange={(value) => setSortBy(value)}
  //             >
  //                 <Select.Option value="newest">Newest</Select.Option>
  //                 <Select.Option value="oldest">Oldest</Select.Option>
  //                 <Select.Option value="most-votes">Most Votes</Select.Option>
  //                 <Select.Option value="least-votes">Least Votes</Select.Option>
  //             </Select>
  //         </div>
  //     )
  // }

  return (
    <div className="flex h-full flex-1 flex-col md:flex-row">
      <AsyncCentreInfoColumn
        buttons={
          isStaff ? (
            <EditQueueButton onClick={() => setEditAsyncCentreModalOpen(true)}>
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
      <div className="flex-grow md:mt-4">
        {/* <RenderFilters /> */}
        {/* <RenderSortBy /> */}

        {asyncQuestions?.map((question) => (
          <AsyncQuestionCard
            key={question.id}
            question={question}
            userId={userInfo.id}
            mutateAsyncQuestions={mutateAsyncQuestions}
            isStaff={isStaff}
            courseId={courseId}
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
