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
  QuestionStatus,
} from '@koh/common'
import { useTAInQueueInfo } from '../../../hooks/useTAInQueueInfo'
import { useCourse } from '../../../hooks/useCourse'
import {
  QueueInfoColumnButton,
  EditQueueButton,
  VerticalDivider,
} from '../Shared/SharedComponents'
import { QueueInfoColumn } from '../Queue/QueueInfoColumn'
import { Tooltip, message, notification, Spin, Button } from 'antd'
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
import { useLocalStorage } from '../../../hooks/useLocalStorage'
import { AddStudentsModal } from './TAAddStudent'
import { EditQueueModal } from './EditQueueModal'
import PropTypes from 'prop-types'
import { EditOutlined, LoginOutlined, PlusOutlined } from '@ant-design/icons'
import { NextRouter } from 'next/router'
import { ListChecks, ListTodoIcon } from 'lucide-react'
import { useStudentAssignmentProgress } from '../../../hooks/useStudentAssignmentProgress'
import { AssignmentReportModal } from './AssignmentReportModal'

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

const JoinButton = styled(QueueInfoColumnButton)<{
  hasDemos: boolean
  isStudent: boolean
}>`
  background-color: #3684c6;
  color: white;
  align-items: center;
  display: flex;
`

interface QueuePageProps {
  qid: number
  cid: number
}

export default function QueuePage({ qid, cid }: QueuePageProps): ReactElement {
  const { queue } = useQueue(qid)
  const isQueueOnline = queue?.room.startsWith('Online')
  const { questions, mutateQuestions } = useQuestions(qid)
  const { isCheckedIn, isHelping } = useTAInQueueInfo(qid)
  const [queueSettingsModal, setQueueSettingsModal] = useState(false)
  const [addStudentsModal, setAddStudentsModal] = useState(false)
  const [assignmentReportModal, setAssignmentReportModal] = useState(false)
  const {
    studentQuestion,
    studentDemo,
    studentQuestions,
    studentQuestionIndex,
    studentDemoIndex,
  } = useStudentQuestion(qid)
  const profile = useProfile()
  const profileId = profile?.id
  const [isStaff, setIsStaff] = useState(false)
  const { course } = useCourse(cid)
  const [popupEditQuestion, setPopupEditQuestion] = useState(false)
  const [popupEditDemo, setPopupEditDemo] = useState(false)
  const role = useRoleInCourse(cid)
  const queueConfig = queue?.config
  const configTasks = queueConfig?.tasks
  const isDemoQueue: boolean = !!configTasks && !!queueConfig.assignment_id
  const studentAssignmentProgress = useStudentAssignmentProgress(
    cid,
    profileId,
    queueConfig?.assignment_id,
    isDemoQueue,
    isStaff,
  )
  const [, , deleteDraftQuestion] = useLocalStorage('draftQuestion', null)
  const [isJoiningQuestion, setIsJoiningQuestion] = useState(
    questions &&
      studentQuestions &&
      studentQuestions.some(
        (question) =>
          question.status !== OpenQuestionStatus.Queued &&
          !question.isTaskQuestion,
      ),
  )
  const [isJoiningDemo, setIsJoiningDemo] = useState(
    questions &&
      studentQuestions &&
      studentQuestions.some(
        (question) =>
          question.status !== OpenQuestionStatus.Queued &&
          question.isTaskQuestion,
      ),
  )
  const [isFirstQuestion, setIsFirstQuestion] = useLocalStorage(
    'isFirstQuestion',
    true,
  )

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

  const helpingQuestions = questions?.questionsGettingHelp?.filter(
    (q) => q.taHelped.id === profileId,
  )

  const staffCheckedIntoAnotherQueue = course?.queues.some(
    (q) =>
      q.id !== qid &&
      q.staffList.some((staffMember) => staffMember.id === profileId),
  )

  const studentQuestionId = studentQuestion?.id
  const studentQuestionStatus = studentQuestion?.status
  const studentDemoId = studentDemo?.id
  const studentDemoStatus = studentDemo?.status

  // delete draft question if the studentQuestionStatus changes to a ClosedQuestionStatus
  useEffect(() => {
    if (studentQuestionStatus in ClosedQuestionStatus) {
      deleteDraftQuestion()
    }
  }, [studentQuestionStatus, deleteDraftQuestion])

  const updateQuestionStatus = useCallback(
    async (id: number, status: QuestionStatus) => {
      await API.questions.update(id, { status })
      await mutateQuestions()
    },
    [mutateQuestions],
  )

  const createQuestion = useCallback(
    async (question: Question, force: boolean, isTaskQuestion: boolean) => {
      const newQuestion = await API.questions.create({
        text: question.text,
        questionTypes: question?.questionTypes ?? [],
        queueId: qid,
        location: question?.location,
        force: force,
        groupable: false,
        isTaskQuestion,
      })
      await updateQuestionStatus(newQuestion.id, OpenQuestionStatus.Queued)
    },
    [qid, updateQuestionStatus],
  )

  const rejoinQueue = useCallback(
    (isTaskQuestion: boolean) => {
      const id = isTaskQuestion ? studentDemoId : studentQuestionId
      updateQuestionStatus(id, OpenQuestionStatus.Queued)
    },
    [studentDemoId, studentQuestionId, updateQuestionStatus],
  )

  const joinQueueAfterDeletion = useCallback(
    (isTaskQuestion: boolean) => {
      const question = isTaskQuestion ? studentDemo : studentQuestion
      const id = isTaskQuestion ? studentDemoId : studentQuestionId
      updateQuestionStatus(id, ClosedQuestionStatus.ConfirmedDeleted)
      createQuestion(question, true, isTaskQuestion)
    },
    [
      studentDemo,
      studentQuestion,
      studentDemoId,
      studentQuestionId,
      updateQuestionStatus,
      createQuestion,
    ],
  )

  const openEditQuestionDemoModal = useCallback(
    (isTaskQuestion: boolean) => {
      if (isTaskQuestion) {
        setPopupEditDemo(true)
      } else {
        setPopupEditQuestion(true)
      }
      mutate(`/api/v1/queues/${qid}/questions`)
    },
    [qid],
  )

  const closeEditQuestionDemoModal = useCallback((isTaskQuestion: boolean) => {
    if (isTaskQuestion) {
      setPopupEditDemo(false)
      setIsJoiningDemo(false)
    } else {
      setPopupEditQuestion(false)
      setIsJoiningQuestion(false)
    }
  }, [])

  const joinQueueOpenModal = useCallback(
    async (force: boolean, isTaskQuestion: boolean) => {
      const errorMessage = isTaskQuestion
        ? ERROR_MESSAGES.questionController.createQuestion.oneDemoAtATime
        : ERROR_MESSAGES.questionController.createQuestion.oneQuestionAtATime
      try {
        const createdQuestion = await API.questions.create({
          queueId: Number(qid),
          text: '',
          force: force,
          questionTypes: null,
          groupable: false,
          isTaskQuestion,
        })
        const newQuestionsInQueue = [...questions?.queue, createdQuestion]
        await mutateQuestions({ ...questions, queue: newQuestionsInQueue })
        isTaskQuestion ? setPopupEditDemo(true) : setPopupEditQuestion(true)
        return true
      } catch (e) {
        if (e.response?.data?.message?.includes(errorMessage)) {
          message.error(
            `You already have a ${
              isTaskQuestion ? 'demo' : 'question'
            } in a queue for this course. Please delete your previous ${
              isTaskQuestion ? 'demo' : 'question'
            } before joining this queue.`,
          )
          return false
        }
        message.error(e.response?.data?.message)
        return true
      }
    },
    [mutateQuestions, qid, questions],
  )

  const leaveQueue = useCallback(
    (isTaskQuestion) => {
      if (isTaskQuestion) {
        updateQuestionStatus(
          studentDemoId,
          ClosedQuestionStatus.ConfirmedDeleted,
        )
      } else {
        //delete draft when they leave the queue
        deleteDraftQuestion()
        updateQuestionStatus(
          studentQuestionId,
          ClosedQuestionStatus.ConfirmedDeleted,
        )
      }
      closeEditQuestionDemoModal(isTaskQuestion)
    },
    [
      closeEditQuestionDemoModal,
      updateQuestionStatus,
      studentDemoId,
      deleteDraftQuestion,
      studentQuestionId,
    ],
  )

  const finishQuestionOrDemo = useCallback(
    async (
      text: string,
      questionTypes: QuestionTypeParams[],
      groupable: boolean,
      isTaskQuestion: boolean,
      location: string,
    ) => {
      const status = isTaskQuestion ? studentDemoStatus : studentQuestionStatus
      const id = isTaskQuestion ? studentDemoId : studentQuestionId
      const updateStudent = {
        text,
        questionTypes,
        groupable: groupable,
        isTaskQuestion: isTaskQuestion,
        status:
          status === OpenQuestionStatus.Drafting
            ? OpenQuestionStatus.Queued
            : status,
        location,
      }

      const updatedQuestionFromStudent = await API.questions.update(
        id,
        updateStudent,
      )

      const yourUpdatedQuestions = studentQuestions?.map(
        (question: Question) =>
          question.id === id ? updatedQuestionFromStudent : question,
      )

      const newQuestionsInQueue = questions?.queue?.map((question: Question) =>
        question.id === id ? updatedQuestionFromStudent : question,
      )

      mutateQuestions({
        ...questions,
        yourQuestions: yourUpdatedQuestions,
        queue: newQuestionsInQueue,
      })
    },
    [
      studentDemoStatus,
      studentQuestionStatus,
      studentDemoId,
      studentQuestionId,
      studentQuestions,
      questions,
      mutateQuestions,
    ],
  )

  const handleFirstQuestionNotification = useCallback(
    (router: NextRouter, cid: number) => {
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
    [isFirstQuestion, setIsFirstQuestion],
  )

  const finishQuestionOrDemoAndClose = useCallback(
    (
      text: string,
      qt: QuestionTypeParams[],
      router: NextRouter,
      cid: number,
      location: string,
      isTaskQuestion: boolean,
      groupable?: boolean,
    ) => {
      if (!isTaskQuestion) {
        deleteDraftQuestion()
      }
      finishQuestionOrDemo(text, qt, groupable, isTaskQuestion, location)
      handleFirstQuestionNotification(router, cid)
      closeEditQuestionDemoModal(isTaskQuestion)
    },
    [
      deleteDraftQuestion,
      finishQuestionOrDemo,
      closeEditQuestionDemoModal,
      handleFirstQuestionNotification,
    ],
  )

  function RenderQueueInfoCol(): ReactElement {
    const [isJoinQueueModalLoading, setIsJoinQueueModalLoading] =
      useState(false)

    const joinQueue = useCallback(async (isTaskQuestion: boolean) => {
      setIsJoinQueueModalLoading(true)
      joinQueueOpenModal(false, isTaskQuestion)
      setIsJoinQueueModalLoading(false)
    }, [])

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
            {isDemoQueue && (
              <EditQueueButton
                onClick={() => setAssignmentReportModal(true)}
                icon={<ListChecks className="mr-1" />}
              >
                {/* "View Students {lab} Progress" on desktop, "{lab} Progress" on mobile */}
                <span>
                  <span className="hidden sm:inline">View Students </span>
                  {queueConfig.assignment_id} Progress
                </span>
              </EditQueueButton>
            )}
          </>
        }
      />
    ) : (
      <QueueInfoColumn
        queueId={qid}
        isStaff={false}
        hasDemos={isDemoQueue}
        buttons={
          <>
            <Tooltip
              title={
                studentQuestion
                  ? 'You can have only one question in the queue at a time'
                  : queue.staffList.length < 1
                    ? 'No staff are checked into this queue'
                    : ''
              }
            >
              <div>
                <JoinButton
                  id="join-queue-button"
                  type="primary"
                  hasdemos={`${isDemoQueue}`} // for styles
                  isstudent="true" // for styles
                  disabled={
                    !queue?.allowQuestions ||
                    queue?.isDisabled ||
                    isJoinQueueModalLoading ||
                    queue.staffList.length < 1 ||
                    studentQuestion
                  }
                  onClick={() => joinQueue(false)}
                  icon={<LoginOutlined aria-hidden="true" />}
                >
                  {isDemoQueue ? 'Create Question' : 'Join Queue'}
                </JoinButton>
              </div>
            </Tooltip>
            {isDemoQueue && (
              <Tooltip
                title={
                  studentDemo
                    ? 'You can have only one demo in the queue at a time'
                    : queue.staffList.length < 1
                      ? 'No staff are checked into this queue'
                      : ''
                }
              >
                <div>
                  <JoinButton
                    id="join-queue-button-demo"
                    type="primary"
                    hasdemos={`${isDemoQueue}`} // for styles
                    isstudent="true" // for styles
                    disabled={
                      !queue?.allowQuestions ||
                      queue?.isDisabled ||
                      isJoinQueueModalLoading ||
                      queue.staffList.length < 1 ||
                      studentDemo
                    }
                    onClick={() => joinQueue(true)}
                    icon={<ListTodoIcon aria-hidden="true" className="mr-1" />}
                  >
                    Create Demo
                  </JoinButton>
                </div>
              </Tooltip>
            )}
          </>
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
          const isMyQuestion =
            question.id === studentQuestionId || question.id === studentDemoId
          const background_color = isMyQuestion ? 'bg-teal-200/25' : 'bg-white'
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
              isMyQuestion={isMyQuestion}
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
            ) : !isStaff ? (
              <>
                <StudentBanner
                  queueId={qid}
                  editQuestion={() => openEditQuestionDemoModal(false)}
                  editDemo={() => openEditQuestionDemoModal(true)}
                  leaveQueueQuestion={() => leaveQueue(false)}
                  leaveQueueDemo={() => leaveQueue(true)}
                  configTasks={configTasks}
                  zoomLink={course?.zoomLink}
                  isQueueOnline={isQueueOnline}
                />
              </>
            ) : null}
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
            {isDemoQueue && (
              <AssignmentReportModal
                queueId={qid}
                courseId={cid}
                assignmentName={queueConfig.assignment_id}
                configTasks={configTasks}
                visible={assignmentReportModal}
                onClose={() => setAssignmentReportModal(false)}
              />
            )}
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
              leaveQueue={() => leaveQueue(false)}
              finishQuestion={finishQuestionOrDemoAndClose}
              position={studentQuestionIndex + 1}
              cancel={() => closeEditQuestionDemoModal(false)}
              queueId={qid}
            />
            {isDemoQueue && (
              <DemoForm
                configTasks={configTasks}
                studentAssignmentProgress={studentAssignmentProgress}
                visible={
                  (questions && !studentDemo && isJoiningDemo) ||
                  // && studentQuestion.status !== QuestionStatusKeys.Drafting)
                  popupEditDemo
                }
                question={studentDemo}
                leaveQueue={() => leaveQueue(true)}
                finishDemo={finishQuestionOrDemoAndClose}
                position={studentDemoIndex + 1}
                cancel={() => closeEditQuestionDemoModal(true)}
              />
            )}
            <CantFindModal
              visible={studentQuestion?.status === LimboQuestionStatus.CantFind}
              leaveQueue={() => leaveQueue(false)}
              rejoinQueue={() => rejoinQueue(false)}
            />
            <CantFindModal
              visible={studentDemo?.status === LimboQuestionStatus.CantFind}
              leaveQueue={() => leaveQueue(true)}
              rejoinQueue={() => rejoinQueue(true)}
            />
            <StudentRemovedFromQueueModal
              question={studentQuestion}
              leaveQueue={() => leaveQueue(false)}
              joinQueue={() => joinQueueAfterDeletion(false)}
            />
            <StudentRemovedFromQueueModal
              question={studentDemo}
              leaveQueue={() => leaveQueue(true)}
              joinQueue={() => joinQueueAfterDeletion(true)}
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
