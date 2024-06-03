import { ReactElement, useCallback, useState, useEffect } from 'react'
import { useQueue } from '../../../hooks/useQueue'
import { useQuestions } from '../../../hooks/useQuestions'
import { useProfile } from '../../../hooks/useProfile'
import {
  QuestionTypeParams,
  ClosedQuestionStatus,
  ERROR_MESSAGES,
  LimboQuestionStatus,
  OpenQuestionStatus,
  Question,
  Role,
  StudentAssignmentProgress,
} from '@koh/common'
import { useTAInQueueInfo } from '../../../hooks/useTAInQueueInfo'
import { useCourse } from '../../../hooks/useCourse'
import {
  QueueInfoColumnButton,
  EditQueueButton,
  VerticalDivider,
} from '../Shared/SharedComponents'
import { QueueInfoColumn } from '../Queue/QueueInfoColumn'
import { Popconfirm, Tooltip, message, notification, Spin, Button } from 'antd'
import TACheckinButton from '../../Today/TACheckinButton'
import styled from 'styled-components'
import { useStudentQuestion } from '../../../hooks/useStudentQuestion'
import { API } from '@koh/api-client'
import { useRoleInCourse } from '../../../hooks/useRoleInCourse'
import CantFindModal from './StudentCantFindModal'
import StudentRemovedFromQueueModal from './StudentRemovedFromQueueModal'
import StudentQueueCard from './StudentQueueCard'
import StudentBanner from './StudentBanner'
import { mutate } from 'swr'
import QuestionForm from './QuestionForm'
import DemoForm from './DemoForm'
import { useDraftQuestion } from '../../../hooks/useDraftQuestion'
import { useLocalStorage } from '../../../hooks/useLocalStorage'
import { AddStudentsModal } from './TAAddStudent'
import { EditQueueModal } from './EditQueueModal'
import PropTypes from 'prop-types'
import { EditOutlined, LoginOutlined, PlusOutlined } from '@ant-design/icons'
import { NextRouter } from 'next/router'

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-top: 10px;
  @media (min-width: 650px) {
    margin-top: 0;
    flex-direction: row;
    height: 100%;
  }
`

const QueueListContainer = styled.div`
  flex-grow: 1;
  @media (min-width: 650px) {
    margin-top: 32px;
  }
`

const JoinButton = styled(QueueInfoColumnButton)`
  background-color: #3684c6;
  color: white;
  align-items: center;
  display: flex;
`

const PopConfirmTitle = styled.div`
  max-width: 400px;
`

interface QueuePageProps {
  qid: number
  cid: number
}

export default function QueuePage({ qid, cid }: QueuePageProps): ReactElement {
  const { queue } = useQueue(qid)
  const { questions, mutateQuestions } = useQuestions(qid)
  const { isCheckedIn, isHelping } = useTAInQueueInfo(qid)
  const [queueSettingsModal, setQueueSettingsModal] = useState(false)
  const [addStudentsModal, setAddStudentsModal] = useState(false)
  const { studentQuestion, studentQuestionIndex } = useStudentQuestion(qid)
  const [showJoinPopconfirm, setShowJoinPopconfirm] = useState(false)
  const profile = useProfile()
  const { course } = useCourse(cid)
  const [popupEditQuestion, setPopupEditQuestion] = useState(false)
  const [popupEditDemo, setPopupEditDemo] = useState(false)
  const role = useRoleInCourse(cid)
  const { deleteDraftQuestion } = useDraftQuestion()
  const [isJoiningQuestion, setIsJoiningQuestion] = useState(
    questions &&
      studentQuestion &&
      studentQuestion?.status !== OpenQuestionStatus.Queued,
  )
  const [isJoiningDemo, setIsJoiningDemo] = useState(
    questions &&
      studentQuestion &&
      studentQuestion?.status !== OpenQuestionStatus.Queued,
  )
  const [isFirstQuestion, setIsFirstQuestion] = useLocalStorage(
    'isFirstQuestion',
    true,
  )

  const tempQueueConfig = {
    queue_display_name: 'Lab 1 Queue',
    fifo_queue_view_enabled: true,
    tag_groups_queue_view_enabled: true,
    default_view: 'fifo',
    minimum_tags: 1,
    tags: {
      tag1: {
        display_name: 'General',
        color_hex: '#66FF66',
      },
      tag2: {
        display_name: 'Bugs',
        color_hex: '#66AA66',
      },
      tag3: {
        display_name: 'Blocking',
        color_hex: '#FF0000',
      },
    },
    assignment_id: 'lab1',
    tasks: {
      task1: {
        display_name: 'Task 1',
        short_display_name: '1',
        blocking: false,
        color_hex: '#ffedb8',
        precondition: null,
      },
      task2: {
        display_name: 'Task 2',
        short_display_name: '2',
        blocking: false,
        color_hex: '#fadf8e',
        precondition: 'task1',
      },
      task3: {
        display_name: 'Task 3',
        short_display_name: '3',
        blocking: false,
        color_hex: '#f7ce52',
        precondition: 'task2',
      },
      task4: {
        display_name: 'Task 4',
        short_display_name: '4',
        blocking: true,
        color_hex: '#EABA2B',
        precondition: 'task3',
      },
      task5: {
        display_name: 'Task 5',
        short_display_name: '5',
        blocking: false,
        color_hex: '#DCAD20',
        precondition: 'task4',
      },
      'task2.5': {
        display_name: 'Task 2.5',
        short_display_name: '2.5',
        blocking: false,
        color_hex: '#91EA2B',
        precondition: 'task2',
      },
      attendance: {
        display_name: 'Attendance',
        short_display_name: 'here',
        blocking: false,
        color_hex: '#069F83',
        precondition: null,
      },
    },
  }
  const configTasks = tempQueueConfig?.tasks

  // get completed tasks
  // TODO: replace this with a get request to the backend
  const studentAssignmentProgress: StudentAssignmentProgress | null =
    role === Role.STUDENT
      ? {
          task1: { isDone: true },
          task2: { isDone: false },
          'task2.5': { isDone: false },
          task3: { isDone: false },
          task4: { isDone: false },
          attendance: { isDone: false },
        }
      : null

  const helpingQuestions = questions?.questionsGettingHelp?.filter(
    (q) => q.taHelped.id === profile.id,
  )

  const staffCheckedIntoAnotherQueue = course?.queues.some(
    (q) =>
      q.id !== qid &&
      q.staffList.some((staffMember) => staffMember.id === profile?.id),
  )

  const studentQuestionId = studentQuestion?.id
  const studentQuestionStatus = studentQuestion?.status

  const leaveQueue = useCallback(async () => {
    await API.questions.update(studentQuestionId, {
      status: ClosedQuestionStatus.ConfirmedDeleted,
    })

    setIsJoiningQuestion(false)
    setIsJoiningDemo(false)
    await mutateQuestions()
  }, [mutateQuestions, studentQuestionId])

  const rejoinQueue = useCallback(async () => {
    await API.questions.update(studentQuestionId, {
      status: OpenQuestionStatus.Queued,
    })
    await mutateQuestions()
  }, [mutateQuestions, studentQuestionId])

  const joinQueueAfterDeletion = useCallback(async () => {
    await API.questions.update(studentQuestion?.id, {
      status: ClosedQuestionStatus.ConfirmedDeleted,
    })
    await mutateQuestions()
    const newQuestion = await API.questions.create({
      text: studentQuestion.text,
      questionTypes: studentQuestion?.questionTypes ?? [],
      queueId: qid,
      location: studentQuestion?.location,
      force: true,
      groupable: false,
      isTaskQuestion: false,
    })
    await API.questions.update(newQuestion.id, {
      status: OpenQuestionStatus.Queued,
    })
    await mutateQuestions()
  }, [mutateQuestions, qid, studentQuestion])

  const joinQueueOpenModal = useCallback(
    async (force: boolean) => {
      try {
        const createdQuestion = await API.questions.create({
          queueId: Number(qid),
          text: '',
          force: force,
          questionTypes: null,
          groupable: false,
          isTaskQuestion: false,
        })
        const newQuestionsInQueue = [...questions?.queue, createdQuestion]
        await mutateQuestions({ ...questions, queue: newQuestionsInQueue })
        setPopupEditQuestion(true)
        return true
      } catch (e) {
        if (
          e.response?.data?.message?.includes(
            ERROR_MESSAGES.questionController.createQuestion.oneQuestionAtATime,
          )
        ) {
          message.error(
            'You already have a question in a queue for this course. Please delete your previous question before joining this queue.',
          )
          return false
        }
        message.error(e.response?.data?.message)
        return true
      }
    },
    [mutateQuestions, qid, questions],
  )

  const createDemoOpenModal = useCallback(
    async (force: boolean) => {
      try {
        const createdQuestion = await API.questions.create({
          queueId: Number(qid),
          text: '',
          force: force,
          questionTypes: null,
          groupable: false,
          isTaskQuestion: true, // this is a demo question
        })
        const newQuestionsInQueue = [...questions?.queue, createdQuestion]
        await mutateQuestions({ ...questions, queue: newQuestionsInQueue })
        setPopupEditDemo(true) //show right modal
        return true
      } catch (e) {
        if (
          e.response?.data?.message?.includes(
            ERROR_MESSAGES.questionController.createQuestion.oneQuestionAtATime,
          )
        ) {
          message.error(
            'You already have a question in a queue for this course. Please delete your previous question before joining this queue.',
          )
          return false
        }
        message.error(e.response?.data?.message)
        return true
      }
    },
    [mutateQuestions, qid, questions],
  )

  const openEditModal = useCallback(async () => {
    mutate(`/api/v1/queues/${qid}/questions`)
    setPopupEditQuestion(true)
  }, [qid])

  const closeEditModal = useCallback(() => {
    setPopupEditQuestion(false)
    setIsJoiningQuestion(false)
  }, [])

  const openEditDemoModal = useCallback(async () => {
    mutate(`/api/v1/queues/${qid}/questions`)
    setPopupEditDemo(true)
  }, [qid])

  const closeEditDemoModal = useCallback(() => {
    setPopupEditDemo(false)
    setIsJoiningDemo(false)
  }, [])

  const leaveQueueAndClose = useCallback(() => {
    //delete draft when they leave the queue
    deleteDraftQuestion()
    leaveQueue()
    closeEditModal()
  }, [deleteDraftQuestion, leaveQueue, closeEditModal])

  const finishQuestion = useCallback(
    async (
      text: string,
      questionTypes: QuestionTypeParams[],
      groupable: boolean,
      isTaskQuestion: boolean,
      location: string,
    ) => {
      const updateStudent = {
        text,
        questionTypes,
        groupable: groupable,
        isTaskQuestion: isTaskQuestion,
        status:
          studentQuestionStatus === OpenQuestionStatus.Drafting
            ? OpenQuestionStatus.Queued
            : studentQuestionStatus,
        location,
      }

      const updatedQuestionFromStudent = await API.questions.update(
        studentQuestionId,
        updateStudent,
      )

      const newQuestionsInQueue = questions?.queue?.map((question: Question) =>
        question.id === studentQuestionId
          ? updatedQuestionFromStudent
          : question,
      )

      // questions are the old questions and newQuestionsInQueue are questions that've been added since.
      mutateQuestions({
        ...questions,
        yourQuestion: updatedQuestionFromStudent,
        queue: newQuestionsInQueue,
      })
    },
    [studentQuestionStatus, studentQuestionId, questions, mutateQuestions],
  )
  const [isStaff, setIsStaff] = useState(false)

  useEffect(() => {
    if (profile && profile.courses) {
      profile.courses.forEach((course) => {
        if (
          course.course.id === cid &&
          (course.role === Role.PROFESSOR || course.role === Role.TA)
        ) {
          setIsStaff(true)
        }
      })
    }
  }, [profile, cid])

  const finishQuestionAndClose = useCallback(
    (
      text: string,
      qt: QuestionTypeParams[],
      router: NextRouter,
      cid: number,
      location: string,
      isTaskQuestion: boolean,
      groupable?: boolean,
    ) => {
      deleteDraftQuestion()
      finishQuestion(text, qt, groupable, isTaskQuestion, location)
      closeEditModal()
      closeEditDemoModal()
      if (isFirstQuestion) {
        notification.warn({
          message: 'Enable Notifications',
          className: 'hide-in-percy',
          description: (
            <div>
              <span id="enable-notifications-text">
                Turn on notifications for when it&apos;s almost your turn to get
                help.
              </span>
              <Button
                onClick={() => {
                  notification.destroy()
                  setIsFirstQuestion(false)
                  router.push(`/settings?cid=${cid}`)
                }}
                className="ml-2"
                aria-describedby="enable-notifications-text"
                aria-label="Enable Notifications"
              >
                Enable Now
              </Button>
            </div>
          ),
          placement: 'bottomRight',
          duration: 0,
        })
      }
    },
    [
      deleteDraftQuestion,
      finishQuestion,
      closeEditModal,
      isFirstQuestion,
      setIsFirstQuestion,
    ],
  )

  function RenderQueueInfoCol(): ReactElement {
    const [isJoinQueueModalLoading, setIsJoinQueueModalLoading] =
      useState(false)

    const joinQueue = useCallback(async () => {
      setIsJoinQueueModalLoading(true)
      await joinQueueOpenModal(false)
      setIsJoinQueueModalLoading(false)
    }, [joinQueueOpenModal])

    const createDemo = useCallback(async () => {
      setIsJoinQueueModalLoading(true)
      await createDemoOpenModal(true)
      setIsJoinQueueModalLoading(false)
    }, [createDemoOpenModal])

    return isStaff ? (
      <QueueInfoColumn
        queueId={qid}
        isStaff={true}
        buttons={
          <>
            <Tooltip
              title={queue.isDisabled && 'Cannot check into a disabled queue!'}
            >
              <TACheckinButton
                courseId={cid}
                room={queue?.room}
                disabled={
                  staffCheckedIntoAnotherQueue ||
                  isHelping ||
                  (queue.isProfessorQueue && role !== Role.PROFESSOR) ||
                  queue.isDisabled
                }
                state={isCheckedIn ? 'CheckedIn' : 'CheckedOut'}
                className="w-1/3 sm:w-full"
              />
            </Tooltip>
            <EditQueueButton
              onClick={() => setQueueSettingsModal(true)}
              icon={<EditOutlined />}
            >
              {/* only show the "Details" part on desktop to keep button small on mobile */}
              <span>
                Edit Queue <span className="hidden sm:inline">Details</span>
              </span>
            </EditQueueButton>
            <EditQueueButton
              disabled={!isCheckedIn}
              onClick={() => setAddStudentsModal(true)}
              icon={<PlusOutlined />}
            >
              {/* "+ Add Students to Queue" on desktop, "+ Students" on mobile */}
              <span>
                <span className="hidden sm:inline">Add</span> Students{' '}
                <span className="hidden sm:inline">to Queue</span>
              </span>
            </EditQueueButton>
          </>
        }
      />
    ) : (
      <QueueInfoColumn
        queueId={qid}
        isStaff={false}
        buttons={
          !studentQuestion && (
            <Popconfirm
              title={
                <PopConfirmTitle>
                  You already have a question in a queue for this course, so
                  your previous question will be deleted in order to join this
                  queue. Do you want to continue?
                </PopConfirmTitle>
              }
              onConfirm={() => joinQueueOpenModal(true)}
              okText="Yes"
              cancelText="No"
              disabled
              visible={showJoinPopconfirm}
              onVisibleChange={setShowJoinPopconfirm}
            >
              <JoinButton
                id="join-queue-button"
                type="primary"
                disabled={
                  !queue?.allowQuestions ||
                  queue?.isDisabled ||
                  isJoinQueueModalLoading ||
                  queue.staffList.length < 1 // the endpoint will throw a 500 error if you try to join with no staff in the queue
                }
                onClick={joinQueue}
                icon={<LoginOutlined aria-hidden="true" />}
                title={
                  queue.staffList.length < 1
                    ? 'No staff are checked into this queue'
                    : ''
                }
              >
                Join Queue
              </JoinButton>
              <JoinButton
                id="join-queue-button"
                type="primary"
                disabled={
                  !queue?.allowQuestions ||
                  queue?.isDisabled ||
                  isJoinQueueModalLoading ||
                  queue.staffList.length < 1 // the endpoint will throw a 500 error if you try to join with no staff in the queue
                }
                onClick={createDemo}
                icon={<LoginOutlined aria-hidden="true" />}
                title={
                  queue.staffList.length < 1
                    ? 'No staff are checked into this queue'
                    : ''
                }
              >
                Create Demo
              </JoinButton>
            </Popconfirm>
          )
        }
      />
    )
  }
  const QueueHeader = styled.h2`
    font-weight: 500;
    font-size: 24px;
    color: #212934;
    margin-bottom: 0.25em;
  `

  const NoQuestionsText = styled.div`
    font-weight: 500;
    font-size: 24px;
    color: #212934;
  `
  interface QueueProps {
    questions: Question[]
  }

  function RenderQueueQuestions({ questions }: QueueProps) {
    return (
      <div aria-label="Queue questions">
        {questions?.length === 0 ? (
          <NoQuestionsText>There are no questions in the queue</NoQuestionsText>
        ) : (
          <>
            {/* only show this queue header on desktop */}
            <QueueHeader className="hidden sm:block">Queue</QueueHeader>
            {/* <StudentHeaderCard bordered={false}>
              <CenterRow>
                <Col flex="1 1">
                  <HeaderText>question</HeaderText>
                </Col>
                <Col flex="0 0 80px">
                  <HeaderText>wait</HeaderText>
                </Col>
              </CenterRow>
            </StudentHeaderCard> */}
          </>
        )}
        {questions?.map((question: Question, index: number) => {
          const background_color =
            question.id === studentQuestionId ? 'bg-teal-200/25' : 'bg-white'
          return (
            <StudentQueueCard
              key={question.id}
              rank={index + 1}
              question={question}
              cid={cid}
              qid={qid}
              isStaff={isStaff}
              configTasks={configTasks}
              studentAssignmentProgress={studentAssignmentProgress}
              className={background_color}
            />
          )
        })}
      </div>
    )
  }
  if (!role || !queue || !profile) {
    return <Spin />
  } else {
    return (
      <>
        <Container>
          <RenderQueueInfoCol />
          <VerticalDivider />
          <QueueListContainer>
            {isStaff && helpingQuestions && helpingQuestions.length > 0 ? (
              <>
                <QueueHeader>You are Currently Helping</QueueHeader>

                {helpingQuestions?.map((question: Question, index: number) => {
                  return (
                    <StudentQueueCard
                      key={question.id}
                      rank={index + 1}
                      question={question}
                      cid={cid}
                      qid={qid}
                      configTasks={configTasks}
                      studentAssignmentProgress={studentAssignmentProgress}
                      isStaff={isStaff}
                    />
                  )
                })}
              </>
            ) : (
              <>
                <StudentBanner
                  queueId={qid}
                  editQuestion={openEditModal}
                  leaveQueue={leaveQueue}
                />
              </>
            )}
            <RenderQueueQuestions questions={questions?.queue} />
          </QueueListContainer>
        </Container>
        {isStaff ? (
          <>
            <EditQueueModal
              queueId={qid}
              visible={queueSettingsModal}
              onClose={() => setQueueSettingsModal(false)}
            />
            <AddStudentsModal
              queueId={qid}
              visible={addStudentsModal}
              onClose={() => setAddStudentsModal(false)}
            />
          </>
        ) : (
          <>
            <QuestionForm
              visible={
                (questions && !studentQuestion && isJoiningQuestion) ||
                // && studentQuestion.status !== QuestionStatusKeys.Drafting)
                popupEditQuestion
              }
              question={studentQuestion}
              leaveQueue={leaveQueueAndClose}
              finishQuestion={finishQuestionAndClose}
              position={studentQuestionIndex + 1}
              cancel={closeEditModal}
              queueId={qid}
            />
            <DemoForm
              configTasks={configTasks}
              studentAssignmentProgress={studentAssignmentProgress}
              visible={
                (questions && !studentQuestion && isJoiningDemo) ||
                // && studentQuestion.status !== QuestionStatusKeys.Drafting)
                popupEditDemo
              }
              question={studentQuestion}
              leaveQueue={leaveQueueAndClose}
              finishDemo={finishQuestionAndClose}
              position={studentQuestionIndex + 1}
              value={[]}
              cancel={closeEditDemoModal}
              queueId={qid}
            />
            <CantFindModal
              visible={studentQuestion?.status === LimboQuestionStatus.CantFind}
              leaveQueue={leaveQueue}
              rejoinQueue={rejoinQueue}
            />
            <StudentRemovedFromQueueModal
              question={studentQuestion}
              leaveQueue={leaveQueue}
              joinQueue={joinQueueAfterDeletion}
            />
          </>
        )}
      </>
    )
  }
}

QueuePage.propTypes = {
  questions: PropTypes.shape({
    queue: PropTypes.arrayOf(PropTypes.instanceOf(Question)),
  }),
}
