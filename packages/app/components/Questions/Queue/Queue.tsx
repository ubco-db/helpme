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
import { useDraftQuestion } from '../../../hooks/useDraftQuestion'
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

  // TODO: test to see if this works without the hook, if so delete it
  // const { deleteDraftQuestion } = useDraftQuestion()
  const [, , deleteDraftQuestion] = useLocalStorage('draftQuestion', null)
  const [, , deleteDraftDemo] = useLocalStorage('draftDemo', null)

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

  // delete draft demo if the studentDemoStatus changes to a ClosedQuestionStatus
  useEffect(() => {
    if (studentDemoStatus in ClosedQuestionStatus) {
      deleteDraftDemo()
    }
  }, [studentDemo])
  // delete draft question if the studentQuestionStatus changes to a ClosedQuestionStatus
  useEffect(() => {
    if (studentQuestionStatus in ClosedQuestionStatus) {
      deleteDraftQuestion()
    }
  }, [studentQuestion])

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

  const leaveQueue = useCallback(
    (id: number) => {
      updateQuestionStatus(id, ClosedQuestionStatus.ConfirmedDeleted)
    },
    [updateQuestionStatus],
  )
  const leaveQueueQuestion = () => leaveQueue(studentQuestionId)
  const leaveQueueDemo = () => leaveQueue(studentDemoId)

  const rejoinQueue = useCallback(
    (id: number) => {
      updateQuestionStatus(id, OpenQuestionStatus.Queued)
    },
    [updateQuestionStatus],
  )
  const rejoinQueueQuestion = () => rejoinQueue(studentQuestionId)
  const rejoinQueueDemo = () => rejoinQueue(studentDemoId)

  const joinQueueAfterDeletion = useCallback(
    (id: number, question: Question, isTaskQuestion: boolean) => {
      updateQuestionStatus(id, ClosedQuestionStatus.ConfirmedDeleted)
      createQuestion(question, true, isTaskQuestion)
    },
    [updateQuestionStatus, createQuestion],
  )
  const joinQueueAfterDeletionQuestion = () =>
    joinQueueAfterDeletion(studentQuestionId, studentQuestion, false)
  const joinQueueAfterDeletionDemo = () =>
    joinQueueAfterDeletion(studentDemoId, studentDemo, true)

  const openEditQuestionModal = useCallback(async () => {
    mutate(`/api/v1/queues/${qid}/questions`)
    setPopupEditQuestion(true)
  }, [qid])

  const closeEditQuestionModal = useCallback(() => {
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

  const createQuestionOpenModal = useCallback(
    async (force: boolean, isTaskQuestion: boolean, errorMessage: string) => {
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
  const joinQueueOpenModal = (force: boolean) =>
    createQuestionOpenModal(
      force,
      false,
      ERROR_MESSAGES.questionController.createQuestion.oneQuestionAtATime,
    )
  const createDemoOpenModal = (force: boolean) =>
    createQuestionOpenModal(
      force,
      true,
      ERROR_MESSAGES.questionController.createQuestion.oneDemoAtATime,
    )

  const leaveQueueAndCloseQuestion = useCallback(async () => {
    //delete draft when they leave the queue
    deleteDraftQuestion()
    await leaveQueueQuestion()
    closeEditQuestionModal()
  }, [deleteDraftQuestion, leaveQueueQuestion, closeEditQuestionModal])

  const leaveQueueAndCloseDemo = useCallback(async () => {
    //delete draft when they leave the queue
    deleteDraftDemo()
    await leaveQueueDemo()
    closeEditDemoModal()
  }, [deleteDraftDemo, leaveQueueDemo, closeEditDemoModal])

  const finishQuestionOrDemo = useCallback(
    async (
      text: string,
      questionTypes: QuestionTypeParams[],
      groupable: boolean,
      isTaskQuestion: boolean,
      location: string,
      status: QuestionStatus,
      id: number,
    ) => {
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
    [questions, mutateQuestions],
  )

  const finishQuestion = useCallback(
    (
      text: string,
      questionTypes: QuestionTypeParams[],
      groupable: boolean,
      location: string,
    ) => {
      finishQuestionOrDemo(
        text,
        questionTypes,
        groupable,
        false,
        location,
        studentQuestionStatus,
        studentQuestionId,
      )
    },
    [studentQuestionStatus, studentQuestionId],
  )

  const finishDemo = useCallback(
    (
      text: string,
      questionTypes: QuestionTypeParams[],
      groupable: boolean,
      location: string,
    ) => {
      finishQuestionOrDemo(
        text,
        questionTypes,
        groupable,
        true,
        location,
        studentDemoStatus,
        studentDemoId,
      )
    },
    [studentDemoStatus, studentDemoId],
  )

  // const finishQuestionAndClose = useCallback(
  //   (
  //     text: string,
  //     qt: QuestionTypeParams[],
  //     router: NextRouter,
  //     cid: number,
  //     location: string,
  //     isTaskQuestion: boolean,
  //     groupable?: boolean,
  //   ) => {
  //     deleteDraftQuestion()
  //     if (!isTaskQuestion) {
  //       finishQuestion(text, qt, groupable, location)
  //       closeEditQuestionModal()
  //     } else {
  //       finishDemo(text, qt, groupable, location)
  //       closeEditDemoModal()
  //     }
  //     if (isFirstQuestion) {
  //       notification.warn({
  //         message: 'Enable Notifications',
  //         className: 'hide-in-percy',
  //         description: (
  //           <div>
  //             <span id="enable-notifications-text">
  //               Turn on notifications for when it&apos;s almost your turn to get
  //               help.
  //             </span>
  //             <Button
  //               onClick={() => {
  //                 notification.destroy()
  //                 setIsFirstQuestion(false)
  //                 router.push(`/settings?cid=${cid}`)
  //               }}
  //               className="ml-2"
  //               aria-describedby="enable-notifications-text"
  //               aria-label="Enable Notifications"
  //             >
  //               Enable Now
  //             </Button>
  //           </div>
  //         ),
  //         placement: 'bottomRight',
  //         duration: 0,
  //       })
  //     }
  //   },
  //   [
  //     deleteDraftQuestion,
  //     deleteDraftDemo,
  //     finishQuestion,
  //     finishDemo,
  //     closeEditQuestionModal,
  //     closeEditDemoModal,
  //     isFirstQuestion,
  //     setIsFirstQuestion,
  //   ],
  // )

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

  const finishQuestionAndClose = useCallback(
    (
      text: string,
      qt: QuestionTypeParams[],
      router: NextRouter,
      cid: number,
      location: string,
      groupable?: boolean,
    ) => {
      deleteDraftQuestion()
      finishQuestion(text, qt, groupable, location)
      closeEditQuestionModal()
      handleFirstQuestionNotification(router, cid)
    },
    [
      deleteDraftQuestion,
      finishQuestion,
      closeEditQuestionModal,
      handleFirstQuestionNotification,
    ],
  )

  const finishDemoAndClose = useCallback(
    (
      text: string,
      qt: QuestionTypeParams[],
      router: NextRouter,
      cid: number,
      location: string,
      groupable?: boolean,
    ) => {
      deleteDraftDemo()
      finishDemo(text, qt, groupable, location)
      closeEditDemoModal()
      handleFirstQuestionNotification(router, cid)
    },
    [
      deleteDraftDemo,
      finishDemo,
      closeEditDemoModal,
      handleFirstQuestionNotification,
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
                  hasDemos={isDemoQueue} // for styles
                  isStudent={true} // for styles
                  disabled={
                    !queue?.allowQuestions ||
                    queue?.isDisabled ||
                    isJoinQueueModalLoading ||
                    queue.staffList.length < 1 ||
                    studentQuestion
                  }
                  onClick={joinQueue}
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
                    hasDemos={isDemoQueue} // for styles
                    isStudent={true} // for styles
                    disabled={
                      !queue?.allowQuestions ||
                      queue?.isDisabled ||
                      isJoinQueueModalLoading ||
                      queue.staffList.length < 1 ||
                      studentDemo
                    }
                    onClick={createDemo}
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
          const background_color =
            question.id === studentQuestionId || question.id === studentDemoId
              ? 'bg-teal-200/25'
              : 'bg-white'
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
            ) : !isStaff ? (
              <>
                <StudentBanner
                  queueId={qid}
                  editQuestion={openEditQuestionModal}
                  editDemo={openEditDemoModal}
                  leaveQueueQuestion={leaveQueueQuestion}
                  leaveQueueDemo={leaveQueueDemo}
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
              leaveQueue={leaveQueueAndCloseQuestion}
              finishQuestion={finishQuestionAndClose}
              position={studentQuestionIndex + 1}
              cancel={closeEditQuestionModal}
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
                leaveQueue={leaveQueueAndCloseDemo}
                finishDemo={finishDemoAndClose}
                position={studentDemoIndex + 1}
                cancel={closeEditDemoModal}
                queueId={qid}
              />
            )}
            <CantFindModal
              visible={studentQuestion?.status === LimboQuestionStatus.CantFind}
              leaveQueue={leaveQueueQuestion}
              rejoinQueue={rejoinQueueQuestion}
            />
            <CantFindModal
              visible={studentDemo?.status === LimboQuestionStatus.CantFind}
              leaveQueue={leaveQueueDemo}
              rejoinQueue={rejoinQueueDemo}
            />
            <StudentRemovedFromQueueModal
              question={studentQuestion}
              leaveQueue={leaveQueueQuestion}
              joinQueue={joinQueueAfterDeletionQuestion}
            />
            <StudentRemovedFromQueueModal
              question={studentDemo}
              leaveQueue={leaveQueueDemo}
              joinQueue={joinQueueAfterDeletionDemo}
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
