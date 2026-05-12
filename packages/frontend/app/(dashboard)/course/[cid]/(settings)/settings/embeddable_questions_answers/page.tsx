'use client'

import { ReactElement, use, useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Divider, message, Popconfirm, Progress, Table, Tooltip } from 'antd'
import { DeleteOutlined, DownOutlined } from '@ant-design/icons'
import {
  EmbeddableQuestion,
  EmbeddableQuestionFeedback,
  parseThinkBlock,
  Role,
  UpdateEmbeddableFeedbackParams,
  UserPartial,
} from '@koh/common'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import ExpandableText from '@/app/components/ExpandableText'
import { formatDateAndTimeForExcel } from '@/app/utils/timeFormatUtils'
import SelectStudentsModal from '@/app/(dashboard)/course/[cid]/components/SelectStudentsModal'
import SelectEmbeddableQuestionModal
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/embeddable_questions_answers/components/SelectEmbeddableQuestionModal'
import SelectEmbeddableQuestion
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/embeddable_questions_answers/components/SelectEmbeddableQuestion'
import GradeEmbeddableFeedback
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/embeddable_questions_answers/components/GradeEmbeddableFeedback'

interface EmbeddableQuestionsAnswersPageProps {
  params: Promise<{ cid: string }>
}

type Feedback = {
  isChild: boolean,
} & EmbeddableQuestionFeedback

type EmbeddableQuestionFeedbackGroup = {
  answers?: Feedback[],
} & Feedback

export default function EmbeddableQuestionsAnswersPage(
  props: EmbeddableQuestionsAnswersPageProps,
): ReactElement {
  const params = use(props.params)
  const { userInfo } = useUserInfo()
  const courseId = useMemo(() => Number(params.cid), [params.cid])

  const [students, setStudents] = useState<UserPartial[]>([])
  const [totalStudents, setTotalStudents] = useState<number>(0)
  const [studentPage, setStudentPage] = useState<number>(1)
  const [studentSearch, setStudentSearch] = useState<string>()

  const [selectStudentsOpen,setSelectStudentsOpen] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])

  const [selectEmbeddableOpen, setSelectEmbeddableOpen] = useState(false)

  useEffect(() => {
    ;(async () => {
      const data = await API.course.getUserInfo(
        courseId,
        studentPage,
        Role.STUDENT,
        studentSearch,
      )
      setStudents(data.users)
      setTotalStudents(data.total)
    })()
  }, [courseId, studentPage, studentSearch])
  
  const [allQuestions, setAllQuestions] = useState<EmbeddableQuestion[]>([])
  const [answers, setAnswers] = useState<EmbeddableQuestionFeedbackGroup[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  const [focusQuestion, setFocusQuestion] = useState<number | undefined>()
  const focusQuestionIndex = useMemo(() => allQuestions.findIndex(v => v.id === focusQuestion), [focusQuestion, allQuestions])
  const focusQuestionObject = useMemo(() => allQuestions[focusQuestionIndex], [focusQuestionIndex, allQuestions])

  const getAllQuestions = useCallback(async () => {
    return await API.lti.embeddableQuestion.getAll(courseId)
      .then((qs) => {
        setAllQuestions(qs)
        if (!focusQuestion) {
          setFocusQuestion(qs[0]?.id)
        }
      })
      .catch(err => message.error(`Failed to retrieve questions: ${getErrorMessage(err)}`))
  }, [courseId, focusQuestion])

  const getAnswers = useCallback(async () => {
    if (!focusQuestion) return
    setDataLoading(true)
    return await API.lti.embeddableQuestion.getAnswers(courseId,focusQuestion,selectedStudents)
      .then((ans) => setAnswers(processQuestionAnswers(ans)))
      .catch(err => message.error(`Failed to retrieve answers: ${getErrorMessage(err)}`))
      .finally(() => setDataLoading(false))
  }, [courseId, focusQuestion, selectedStudents])

  useEffect(() => {
    (async () => {
      await getAnswers();
    })().then();
  }, [getAnswers])

  useEffect(() => {
    (async () => {
      await getAllQuestions();
    })().then();
  }, [getAllQuestions])

  function updateFocusQuestion(val: number) {
    if (val !== focusQuestion) {
      setFocusQuestion(val)
      setStudentPage(0)
      setSelectedStudents([])
      setStudentSearch(undefined)
    }
  }

  async function handleDelete(feedback: EmbeddableQuestionFeedback) {
    try {
      await API.lti.embeddableQuestion.deleteAnswer(courseId,feedback.questionId,feedback.id)
      await getAnswers()
    } catch(err) {
      message.error(`Failed to delete submission: ${getErrorMessage(err)}`)
    }
  }

  async function handleUpdate(feedback: EmbeddableQuestionFeedback, params: UpdateEmbeddableFeedbackParams) {
    try {
      await API.lti.embeddableQuestion.updateAnswer(courseId,feedback.questionId,feedback.id,params)
      await getAnswers()
    } catch(err) {
      message.error(`Failed to update submission: ${getErrorMessage(err)}`)
      return false
    }
    return true
  }

  const columns: any[] = [
    {
      title: 'User',
      dataIndex: ['user','name'],
      key: 'name',
      render: (text: string, record: EmbeddableQuestionFeedbackGroup) => (
        !record.isChild ? text : ''
      )
    },
    {
      title: 'Submission',
      dataIndex: 'submission',
      key: 'submission',
      width: 300,
      render: (text: string) => {
        return (
          <ExpandableText maxRows={3}>
            {text ? text.toString() : ''}
          </ExpandableText>
        )
      },
    },
    {
      title: 'AI Feedback',
      dataIndex: 'aiFeedback',
      key: 'aiFeedback',
      width: 300,
      render: (text: string) => {
        const { thinkText, cleanAnswer } = parseThinkBlock(text ?? '')
        return (
          <ExpandableText maxRows={3}>
            {thinkText && (
              <Tooltip
                title={`AI Thoughts: ${thinkText}`}
                classNames={{
                  body: 'w-96 max-h-[80vh] overflow-y-auto',
                }}
              >
                <span
                  className="mr-1 rounded-lg bg-blue-100 p-0.5 pl-1 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <i>Thoughts</i> 🧠
                </span>
              </Tooltip>
            )}
            {thinkText ? cleanAnswer : text ? text.toString() : ''}
          </ExpandableText>
        )
      },
    },
    {
      title: 'AI Grade',
      dataIndex: 'aiGrade',
      key: 'aiGrade',
      width: 90,
      render: (grade?: number) => (
        grade ?
          (<Progress size={'small'} type="circle" percent={grade ? grade : 0}/>)
          : ('N/A')
      )
    },
    {
      title: 'Human Grade',
      dataIndex: 'humanGrade',
      key: 'humanGrade',
      width: 90,
      render: (grade: number, record: EmbeddableQuestionFeedback) => (
        <GradeEmbeddableFeedback grade={grade} record={record} handleUpdate={handleUpdate}/>
      )
    },
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 90,
      render: (createdAt: Date) => formatDateAndTimeForExcel(createdAt),
    },
    {
      key: 'actions',
      width: 50,
      render: (_: any, record: Feedback) => (
        <div className="flex flex-col items-center justify-center gap-2">
          <Popconfirm
            title="Delete this submission?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <div className="md:mr-2">
      <title>{`HelpMe | Viewing ${userInfo.courses.find((e) => e.course.id === courseId)?.course.name ?? ''} Embeddable Question Answers`}</title>
      {/* Tailwind color classes used (this will ensure the tailwind parser sees these classes being used and doesn't remove them):
          bg-green-100 bg-green-200 bg-green-300 bg-green-400 bg-green-500 bg-green-600 bg-green-700 bg-green-800
          bg-red-100 bg-red-200 bg-red-300 bg-red-400 bg-red-500 bg-red-600 bg-red-700 bg-red-800
      */}
      <div className="flex w-full items-center justify-between">
        <div className="flex-1">
          <h3 className="m-0 p-0 text-4xl font-bold text-gray-900">
            View Embeddable Question Answers
          </h3>
          <h4 className="text-[16px] font-medium text-gray-600">
            View and manage the answers to your course&#39;s embeddable questions, including feedback and preliminary
            grades.
          </h4>
        </div>
      </div>
      <div className={'mt-4 flex w-full items-center justify-between'}>
        {focusQuestion != undefined ? (
          <>
            <h4>Viewing results from {focusQuestionObject?.name ?? `Question ${focusQuestionIndex + 1}`}.</h4>
            <div className={'flex justify-end gap-2'}>
              <Button onClick={() => setSelectEmbeddableOpen(true)}>
                Select Embeddable Question
                <DownOutlined color={'@White 65%'} />
              </Button>
            </div>
            <div className={'flex justify-end gap-2'}>
              <Button onClick={() => setSelectStudentsOpen(true)}>
                Selected Students ({selectedStudents.length == 0 ? 'All' : selectedStudents.length})
                <DownOutlined color={'@White 65%'} />
              </Button>
            </div>
          </>
        ) : (
          <>
            <h4>No question selected. {allQuestions.length > 0 ? 'Choose one to view results for from the list below.' : 'There are no available questions to select in the course.'}</h4>
          </>
        )}
      </div>
      <Divider className="my-3" />
      {focusQuestion && (
        <>
          <Table<EmbeddableQuestionFeedbackGroup>
            columns={columns}
            bordered
            size="small"
            dataSource={answers}
            loading={answers.length === 0 && dataLoading}
            expandable={{
              childrenColumnName: 'answers',
            }}
          />
        </>
      )}
      {!focusQuestion && (
        <SelectEmbeddableQuestion
          questions={allQuestions}
          selectedQuestion={focusQuestion}
          setSelectedQuestion={updateFocusQuestion}
        />
      )}
      <SelectEmbeddableQuestionModal
        open={selectEmbeddableOpen}
        onClose={() => setSelectEmbeddableOpen(false)}
        questions={allQuestions}
        selectedQuestion={focusQuestion}
        setSelectedQuestion={updateFocusQuestion}
      />
      <SelectStudentsModal
        open={selectStudentsOpen}
        onClose={() => setSelectStudentsOpen(false)}
        page={studentPage}
        setPage={setStudentPage}
        students={students}
        totalStudents={totalStudents}
        selectedStudents={selectedStudents}
        setSelectedStudents={setSelectedStudents}
        setFullSearch={(val) => {
          setStudentSearch(val)
          setStudentPage(0)
        }}
        updateSelectedStudents={(id: number) => setSelectedStudents((prev) => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])}
      />
    </div>
  )
}

function processQuestionAnswers(
  answers: EmbeddableQuestionFeedback[],
): EmbeddableQuestionFeedbackGroup[] {
  const feedbackGroups: EmbeddableQuestionFeedbackGroup[] = []

  const uniqueUsers: number[] = [...new Set(answers.map(a => a.userId))]

  uniqueUsers.forEach(uid => {
    const ans = answers
      .filter(a => a.userId == uid)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    feedbackGroups.push({
      ...ans[0],
      isChild: false,
      answers: ans.slice(1).map(a => ({ ...a, isChild: true }))
    })
  })

  return feedbackGroups;
}
