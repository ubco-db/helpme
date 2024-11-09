'use client'

import { ReactElement, useCallback, useState, useEffect, useRef } from 'react'
import {
  QuestionTypeParams,
  ClosedQuestionStatus,
  ERROR_MESSAGES,
  OpenQuestionStatus,
  Question,
  Role,
  QuestionStatus,
  ConfigTasksWithAssignmentProgress,
  transformIntoTaskTree,
  TaskTree,
  QuestionType,
  LimboQuestionStatus,
  QuestionLocations,
} from '@koh/common'
import { Tooltip, message, notification, Button, Divider } from 'antd'
import { mutate } from 'swr'
import {
  EditOutlined,
  LoginOutlined,
  PhoneOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { CheckCheck, ListChecks, ListTodoIcon } from 'lucide-react'
import { useQueue } from '@/app/hooks/useQueue'
import { useUserInfo } from '@/app/contexts/userContext'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useQuestions } from '@/app/hooks/useQuestions'
import {
  EditQueueButton,
  JoinQueueButton,
} from '@/app/(dashboard)/course/[cid]/components/QueueInfoColumnButton'
import VerticalDivider from '@/app/components/VerticalDivider'
import QueueHeader from './components/QueueHeader'
import { getErrorMessage, getRoleInCourse } from '@/app/utils/generalUtils'
import { useCourse } from '@/app/hooks/useCourse'
import { useStudentAssignmentProgress } from '@/app/hooks/useStudentAssignmentProgress'
import QuestionCard from './components/QuestionCard'
import { useStudentQuestion } from '@/app/hooks/useStudentQuestion'
import { isCheckedIn } from '../../utils/commonCourseFunctions'
import {
  getHelpingQuestions,
  getPausedQuestions,
} from './utils/commonQueueFunctions'
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'
import { useLocalStorage } from '@/app/hooks/useLocalStorage'
import QueueInfoColumn from './components/QueueInfoColumn'
import TACheckinButton from '../../components/TACheckinButton'
import { API } from '@/app/api'
import QueueQuestions from './components/QueueQuestions'
import { useRouter } from 'next/navigation'
import CreateQuestionModal from './components/modals/CreateQuestionModal'
import StudentRemovedFromQueueModal from './components/modals/StudentRemovedFromQueueModal'
import StudentBanner from './components/StudentBanner'
import EditQueueModal from './components/modals/EditQueueModal'
import AddStudentsToQueueModal from './components/modals/AddStudentsToQueueModal'
import CreateDemoModal from './components/modals/CreateDemoModal'
import AssignmentReportModal from './components/modals/AssignmentReportModal'
import CantFindModal from './components/modals/CantFindModal'
import { useChatbotContext } from '../../components/chatbot/ChatbotProvider'
import CircleButton from './components/CircleButton'
import JoinZoomNowModal from './components/modals/JoinZoomNowModal'
import JoinZoomButton from './components/JoinZoomButton'

type QueuePageProps = {
  params: { cid: string; qid: string }
}

export default function QueuePage({ params }: QueuePageProps): ReactElement {
  const cid = Number(params.cid)
  const qid = Number(params.qid)
  const router = useRouter()
  const { queue } = useQueue(qid)
  const isQueueHybrid = queue?.type == 'hybrid'
  const { queueQuestions, mutateQuestions } = useQuestions(qid)
  const [queueSettingsModalOpen, setQueueSettingsModalOpen] = useState(false)
  const [addStudentsModalOpen, setAddStudentsModalOpen] = useState(false)
  const [assignmentReportModalOpen, setAssignmentReportModalOpen] =
    useState(false)
  const [clickedZoomModal, setClickedZoomModal] = useState(false)
  const [staffListHidden, setStaffListHidden] = useState(false)
  const [isFinishAllHelpingButtonLoading, setIsFinishAllHelpingButtonLoading] =
    useState(false)
  const {
    studentQuestion,
    studentDemo,
    studentQuestions,
    studentQuestionIndex,
    studentDemoIndex,
  } = useStudentQuestion(qid)
  const { userInfo } = useUserInfo()
  const isUserCheckedIn = isCheckedIn(queue?.staffList, userInfo.id)
  const { course } = useCourse(cid)
  const [editQuestionModalOpen, setEditQuestionModalOpen] = useState(false)
  const [editDemoModalOpen, setEditDemoModalOpen] = useState(false)
  const role = getRoleInCourse(userInfo, cid)
  const isStaff = role === Role.TA || role === Role.PROFESSOR
  const [questionTypes] = useQuestionTypes(cid, qid)
  const queueConfig = queue?.config
  const configTasks = queueConfig?.tasks
  const isDemoQueue: boolean = !!configTasks && !!queueConfig.assignment_id
  const [studentAssignmentProgress, mutateStudentAssignmentProgress] =
    useStudentAssignmentProgress(
      cid,
      userInfo.id,
      queueConfig?.assignment_id,
      isDemoQueue,
      isStaff,
    )
  const [taskTree, setTaskTree] = useState<TaskTree>({} as TaskTree)
  const [isJoiningQuestion, setIsJoiningQuestion] = useState(
    queueQuestions &&
      studentQuestions &&
      studentQuestions.some(
        (question: Question) =>
          question.status !== OpenQuestionStatus.Queued &&
          !question.isTaskQuestion,
      ),
  )
  const [isJoiningDemo, setIsJoiningDemo] = useState(
    queueQuestions &&
      studentQuestions &&
      studentQuestions.some(
        (question: Question) =>
          question.status !== OpenQuestionStatus.Queued &&
          question.isTaskQuestion,
      ),
  )
  const [isJoinQueueModalLoading, setIsJoinQueueModalLoading] = useState(false)
  const [isCreateDemoModalLoading, setIsCreateDemoModalLoading] =
    useState(false)
  const [tagGroupsEnabled, setTagGroupsEnabled] = useState(
    queueConfig?.default_view === 'tag_groups',
  )
  const [isFirstQuestion, setIsFirstQuestion] = useLocalStorage(
    'isFirstQuestion',
    true,
  )
  const { helpingQuestions } = getHelpingQuestions(
    queueQuestions,
    userInfo.id,
    role,
  )
  const { pausedQuestions } = getPausedQuestions(queueQuestions, role)

  const resetClickedZoomModal = useCallback(() => {
    if (studentQuestion?.status !== OpenQuestionStatus.Helping) {
      setClickedZoomModal(false)
    }
  }, [clickedZoomModal, studentQuestion])

  useEffect(() => {
    resetClickedZoomModal()
  }, [resetClickedZoomModal, clickedZoomModal, studentQuestion])

  // chatbot
  const { setCid, setRenderSmallChatbot } = useChatbotContext()
  useEffect(() => {
    setCid(cid)
  }, [cid, setCid])
  useEffect(() => {
    setRenderSmallChatbot(true)
    return () => setRenderSmallChatbot(false) // make the chatbot inactive when the user leaves the page
  }, [setRenderSmallChatbot])

  const [openTagGroups, setOpenTagGroups] = useState<string[]>([])
  const tagGroupsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null) // need to keep track of timeouts so that old timeouts won't keep running when the user starts a new timeout (to prevent flickering when a tag group is spammed open/closed, UX thing)
  const onOpenTagGroupsChange = (key: string | string[]) => {
    // Delay before setting the openTagGroups state to allow the css transition to finish
    // If the old state is the same as the new state, don't set the state again (to prevent unnecessary timeouts) - Needs to be deep equality
    if (openTagGroups.toString() === key.toString()) {
      return
    }
    // Clear the previous timeout
    if (tagGroupsTimeoutRef.current) {
      clearTimeout(tagGroupsTimeoutRef.current)
    }
    tagGroupsTimeoutRef.current = setTimeout(() => {
      setOpenTagGroups(Array.isArray(key) ? key : [key])
      tagGroupsTimeoutRef.current = null // Clear the ref once the timeout completes
    }, 300)
  }

  const hasDefaultsBeenInitializedRef = useRef(false) // used to track if the defaults have been initialized. Can use when the default value for useState doesn't work due to delayed data
  useEffect(() => {
    // Only initialize once when queueConfig becomes defined and hasn't been initialized before
    if (
      !hasDefaultsBeenInitializedRef.current &&
      queueConfig &&
      configTasks &&
      queueQuestions &&
      questionTypes
    ) {
      // Set default values based on queueConfig
      const newTagGroupsEnabled = queueConfig.default_view === 'tag_groups'
      setTagGroupsEnabled(newTagGroupsEnabled)

      // if you're staff and there's less than 10 questions in the queue, open all tag groups by default
      if (isStaff && queueQuestions.questions?.length < 10) {
        setOpenTagGroups([
          ...Object.keys(configTasks),
          ...questionTypes.map((qt) => qt.id.toString()),
        ])
      } else {
        setOpenTagGroups([])
      }

      // Mark as initialized to prevent future updates
      hasDefaultsBeenInitializedRef.current = true
    }
  }, [queueConfig, configTasks, isStaff, queueQuestions, questionTypes])

  const staffCheckedIntoAnotherQueue = course?.queues?.some(
    (q) =>
      q.id !== qid &&
      q.staffList.some((staffMember) => staffMember.id === userInfo.id),
  )

  const studentQuestionId = studentQuestion?.id
  const studentQuestionStatus = studentQuestion?.status
  const studentDemoId = studentDemo?.id
  const studentDemoStatus = studentDemo?.status

  // whenever the student's demo goes from defined to undefined, re-run mutateStudentTaskProgress so that the student gets their updated progress right away
  useEffect(() => {
    if (!isStaff && studentDemo === undefined) {
      mutateStudentAssignmentProgress()
    }
  }, [isStaff, studentDemo, mutateStudentAssignmentProgress])

  const updateQuestionStatus = useCallback(
    async (id: number, status: QuestionStatus) => {
      await API.questions.update(id, { status }).catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error(errorMessage)
        throw e
      })
      await mutateQuestions()
    },
    [mutateQuestions],
  )

  const createQuestion = useCallback(
    async (
      text: string | undefined,
      questionTypes: QuestionType[],
      force: boolean,
      isTaskQuestion: boolean,
      location?: QuestionLocations,
    ) => {
      await API.questions
        .create({
          text: text || '',
          questionTypes: questionTypes,
          queueId: qid,
          location: location ?? isQueueHybrid ? 'Unselected' : undefined,
          force: force,
          groupable: false,
          isTaskQuestion,
        })
        .then(async (newQuestion) => {
          await updateQuestionStatus(newQuestion.id, OpenQuestionStatus.Queued)
        })
        .catch((e) => {
          const errorMessage = getErrorMessage(e)
          message.error(errorMessage)
          throw e
        })
    },
    [isQueueHybrid, qid, updateQuestionStatus],
  )

  const rejoinQueue = useCallback(
    (isTaskQuestion: boolean) => {
      const id = isTaskQuestion ? studentDemoId : studentQuestionId
      if (id === undefined) {
        return
      }
      updateQuestionStatus(id, OpenQuestionStatus.Queued)
    },
    [studentDemoId, studentQuestionId, updateQuestionStatus],
  )

  const setRequeuing = useCallback(
    async (isTaskQuestion: boolean) => {
      const id = isTaskQuestion ? studentDemoId : studentQuestionId
      if (id === undefined) {
        return
      }
      await updateQuestionStatus(id, LimboQuestionStatus.ReQueueing)
    },
    [studentDemoId, studentQuestionId, updateQuestionStatus],
  )

  const joinQueueAfterDeletion = useCallback(
    (isTaskQuestion: boolean) => {
      const question = isTaskQuestion ? studentDemo : studentQuestion
      const id = isTaskQuestion ? studentDemoId : studentQuestionId
      if (id === undefined || question === undefined) {
        return
      }
      // delete the old question and create a new one
      updateQuestionStatus(id, ClosedQuestionStatus.ConfirmedDeleted)
      createQuestion(
        question.text,
        question.questionTypes ?? [],
        true,
        isTaskQuestion,
        question.location,
      )
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
        setEditDemoModalOpen(true)
      } else {
        setEditQuestionModalOpen(true)
      }
      mutate(`/api/v1/queues/${qid}/questions`)
    },
    [qid],
  )

  const closeEditQuestionDemoModal = useCallback((isTaskQuestion: boolean) => {
    if (isTaskQuestion) {
      setEditDemoModalOpen(false)
      setIsJoiningDemo(false)
    } else {
      setEditQuestionModalOpen(false)
      setIsJoiningQuestion(false)
    }
  }, [])

  const joinQueueOpenModal = useCallback(
    async (force: boolean, isTaskQuestion: boolean) => {
      const specificErrorMessage = isTaskQuestion
        ? ERROR_MESSAGES.questionController.createQuestion.oneDemoAtATime
        : ERROR_MESSAGES.questionController.createQuestion.oneQuestionAtATime
      await API.questions
        .create({
          queueId: qid,
          text: '',
          force: force,
          questionTypes: undefined,
          groupable: false,
          isTaskQuestion,
        })
        .then(async (createdQuestion) => {
          // preemptively update the local question data by adding the new question to the queue
          if (queueQuestions) {
            const questionsWithNewQuestionAppended = [
              ...queueQuestions.questions,
              createdQuestion,
            ]
            await mutateQuestions({
              ...queueQuestions,
              questions: questionsWithNewQuestionAppended,
            })
          }
          isTaskQuestion
            ? setEditDemoModalOpen(true)
            : setEditQuestionModalOpen(true)
        })
        .catch((e) => {
          if (e.response?.data?.message?.includes(specificErrorMessage)) {
            message.error(
              `You already have a ${
                isTaskQuestion ? 'demo' : 'question'
              } in a queue for this course. Please delete your previous ${
                isTaskQuestion ? 'demo' : 'question'
              } before joining this queue.`,
            )
          } else {
            const errorMessage = getErrorMessage(e)
            message.error(errorMessage)
          }
        })
    },
    [mutateQuestions, qid, queueQuestions],
  )

  const leaveQueue = useCallback(
    async (isTaskQuestion: boolean) => {
      if (isTaskQuestion && studentDemoId) {
        await updateQuestionStatus(
          studentDemoId,
          ClosedQuestionStatus.ConfirmedDeleted,
        )
      } else if (studentQuestionId) {
        await updateQuestionStatus(
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
      studentQuestionId,
    ],
  )

  /**
   *  basically an "update question" function. Used for both when students "finish" creating a question and when they edit it
   * */
  const finishQuestionOrDemo = useCallback(
    async (
      text: string,
      questionTypes: QuestionTypeParams[],
      groupable: boolean,
      isTaskQuestion: boolean,
      location: QuestionLocations,
    ) => {
      const status = isTaskQuestion ? studentDemoStatus : studentQuestionStatus
      const id = isTaskQuestion ? studentDemoId : studentQuestionId
      if (id === undefined) {
        return
      }
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

      // preemptively update the local question data by finding the student's new question and updating it
      if (queueQuestions) {
        const yourUpdatedQuestions = studentQuestions?.map(
          (question: Question) =>
            question.id === id ? updatedQuestionFromStudent : question,
        )
        const questionsWithUpdatedInfo = queueQuestions.questions?.map(
          (question: Question) =>
            question.id === id ? updatedQuestionFromStudent : question,
        )
        mutateQuestions({
          ...queueQuestions,
          yourQuestions: yourUpdatedQuestions,
          questions: questionsWithUpdatedInfo,
        })
      }
    },
    [
      studentDemoStatus,
      studentQuestionStatus,
      studentDemoId,
      studentQuestionId,
      studentQuestions,
      queueQuestions,
      mutateQuestions,
    ],
  )

  const handleFirstQuestionNotification = useCallback(
    (cid: number) => {
      if (isFirstQuestion) {
        notification.warning({
          message: 'Enable Notifications',
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
                  router.push(`/profile?page=notifications`)
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
    [isFirstQuestion, router, setIsFirstQuestion],
  )

  // used for the "Join" button on the tag groups feature (specifically, for the tasks)
  useEffect(() => {
    // only re-calculate the taskTree and everything if tagGroups is enabled and the user is a student
    if (tagGroupsEnabled) {
      const configTasksCopy: ConfigTasksWithAssignmentProgress = {
        ...configTasks,
      } // Create a copy of configTasks (since the function will mutate it)
      // For each task that is marked as done, give it the isDone = true attribute
      if (studentAssignmentProgress) {
        for (const [taskKey, taskValue] of Object.entries(
          studentAssignmentProgress,
        )) {
          if (taskValue?.isDone && configTasksCopy[taskKey]) {
            configTasksCopy[taskKey].isDone = true
          }
        }
      }
      setTaskTree(transformIntoTaskTree(configTasksCopy)) // transformIntoTaskTree changes each precondition to carry a reference to the actual task object instead of just a string
    }
  }, [tagGroupsEnabled, configTasks, studentAssignmentProgress])

  function RenderQueueInfoCol(): ReactElement {
    // TODO: this probably doesn't need to be a separate component inside the whole queue page.
    if (!queue) {
      return <></>
    }
    return (
      <QueueInfoColumn
        cid={cid}
        queueId={qid}
        isStaff={isStaff}
        tagGroupsEnabled={tagGroupsEnabled}
        setTagGroupsEnabled={setTagGroupsEnabled}
        hasDemos={isDemoQueue}
        staffListHidden={staffListHidden}
        setStaffListHidden={setStaffListHidden}
        buttons={
          isStaff ? (
            <>
              <Tooltip
                title={
                  (queue.isDisabled && 'Cannot check into a disabled queue!') ||
                  (staffCheckedIntoAnotherQueue &&
                    'You are already checked into another queue') ||
                  (helpingQuestions &&
                    helpingQuestions.length > 0 &&
                    'You cannot check out while helping a student') ||
                  (queue.isProfessorQueue &&
                    role !== Role.PROFESSOR &&
                    'Only professors can check into this queue')
                }
              >
                <span>
                  <TACheckinButton
                    courseId={cid}
                    room={queue.room}
                    disabled={
                      staffCheckedIntoAnotherQueue ||
                      (helpingQuestions && helpingQuestions.length > 0) ||
                      (queue.isProfessorQueue && role !== Role.PROFESSOR) ||
                      queue.isDisabled
                    }
                    state={isUserCheckedIn ? 'CheckedIn' : 'CheckedOut'}
                    className="w-full md:mb-3"
                  />
                </span>
              </Tooltip>
              <span>
                <EditQueueButton
                  onClick={() => setQueueSettingsModalOpen(true)}
                  icon={<EditOutlined />}
                >
                  {/* only show the "Details" part on desktop to keep button small on mobile */}
                  <span>
                    Edit Queue <span className="hidden sm:inline">Details</span>
                  </span>
                </EditQueueButton>
              </span>
              <Tooltip
                title={
                  !isUserCheckedIn
                    ? 'You must be checked in to add students to the queue'
                    : ''
                }
              >
                <span>
                  <EditQueueButton
                    disabled={!isUserCheckedIn}
                    onClick={() => setAddStudentsModalOpen(true)}
                    icon={<PlusOutlined />}
                  >
                    {/* "+ Add Students to Queue" on desktop, "+ Students" on mobile */}
                    <span>
                      <span className="hidden sm:inline">Add</span> Students{' '}
                      <span className="hidden sm:inline">to Queue</span>
                    </span>
                  </EditQueueButton>
                </span>
              </Tooltip>
              {isDemoQueue && (
                <EditQueueButton
                  onClick={() => setAssignmentReportModalOpen(true)}
                  icon={<ListChecks className="mr-1" />}
                >
                  {/* "View Students {lab} Progress" on desktop, "{lab} Progress" on mobile */}
                  <span>
                    <span className="hidden sm:inline">View Students </span>
                    {queueConfig?.assignment_id} Progress
                  </span>
                </EditQueueButton>
              )}
            </>
          ) : (
            <>
              {((queue.type === 'hybrid' && // Show the "Join Zoom" button if staff is ready and student already clicked on the modal
                studentQuestion?.location === 'Online') ||
                queue.type === 'online') &&
                clickedZoomModal &&
                studentQuestion?.status === OpenQuestionStatus.Helping && (
                  <JoinZoomButton
                    zoomLink={queue.zoomLink ?? course?.zoomLink}
                    textSize="sm"
                  >
                    Join Zoom
                  </JoinZoomButton>
                )}
              <Tooltip
                title={
                  studentQuestion
                    ? 'You can have only one question in the queue at a time'
                    : queue.staffList.length < 1
                      ? 'No staff are checked into this queue'
                      : ''
                }
              >
                <JoinQueueButton
                  id="join-queue-button"
                  loading={isJoinQueueModalLoading}
                  className={!isDemoQueue ? 'w-[90%] md:w-full' : 'mx-2'}
                  disabled={
                    !queue?.allowQuestions ||
                    queue?.isDisabled ||
                    isCreateDemoModalLoading ||
                    queue.staffList.length < 1 ||
                    !!studentQuestion
                  }
                  onClick={() => {
                    setIsJoinQueueModalLoading(true)
                    joinQueueOpenModal(false, false)
                    // fallback: After 3s, if the modal hasn't opened, stop the loading state
                    setTimeout(() => {
                      if (isJoinQueueModalLoading) {
                        setIsJoinQueueModalLoading(false)
                      }
                    }, 3000)
                  }}
                  icon={<LoginOutlined aria-hidden="true" />}
                >
                  {isDemoQueue ? 'Create Question' : 'Join Queue'}
                </JoinQueueButton>
              </Tooltip>
              {isDemoQueue && (
                <Tooltip
                  title={
                    studentDemo
                      ? 'You can have only one demo in the queue at a time'
                      : queue?.staffList?.length < 1
                        ? 'No staff are checked into this queue'
                        : ''
                  }
                >
                  <JoinQueueButton
                    id="join-queue-button-demo"
                    loading={isCreateDemoModalLoading}
                    className="mx-2"
                    disabled={
                      !queue?.allowQuestions ||
                      queue?.isDisabled ||
                      isJoinQueueModalLoading ||
                      queue.staffList.length < 1 ||
                      !!studentDemo
                    }
                    onClick={() => {
                      setIsCreateDemoModalLoading(true)
                      joinQueueOpenModal(false, true)
                      // fallback: After 3s, if the modal hasn't opened, stop the loading state
                      setTimeout(() => {
                        if (isCreateDemoModalLoading) {
                          setIsCreateDemoModalLoading(false)
                        }
                      }, 3000)
                    }}
                    icon={<ListTodoIcon aria-hidden="true" />}
                  >
                    Create Demo
                  </JoinQueueButton>
                </Tooltip>
              )}
            </>
          )
        }
      />
    )
  }

  if (!course) {
    return <CenteredSpinner tip="Loading Course Data..." />
  } else if (!queue) {
    return <CenteredSpinner tip="Loading Queue Data..." />
  } else if (queueQuestions === undefined || queueQuestions === null) {
    return <CenteredSpinner tip="Loading Questions..." />
  } else {
    return (
      <div className="flex h-full flex-1 flex-col md:flex-row">
        <title>{`HelpMe | ${course.name} - ${queue.room}`}</title>
        <RenderQueueInfoCol />
        <VerticalDivider />
        <div className="flex-grow">
          {isStaff ? (
            <>
              {helpingQuestions.length > 0 && (
                <>
                  <div className="flex items-center justify-between md:mt-2">
                    <QueueHeader
                      text="You are Currently Helping"
                      visibleOnDesktopOrMobile="both"
                    />
                    {helpingQuestions.filter(
                      (q) => q.status !== OpenQuestionStatus.Paused,
                    ).length >= 2 && (
                      <Tooltip
                        title={
                          helpingQuestions.some(
                            (question) => question.isTaskQuestion,
                          )
                            ? 'You cannot finish helping all while checking demos (for your safety)'
                            : 'Finish helping all questions'
                        }
                      >
                        <span>
                          <CircleButton
                            className="mr-[1.2rem]"
                            variant="green"
                            icon={
                              <CheckCheck size={22} className="shrink-0 pl-1" />
                            }
                            loading={isFinishAllHelpingButtonLoading}
                            // disable this button if any of the questions isTaskQuestion (since it is rare that you would want to click this in that case)
                            disabled={helpingQuestions.some(
                              (question) => question.isTaskQuestion,
                            )}
                            onClick={() => {
                              setIsFinishAllHelpingButtonLoading(true)
                              const promises = helpingQuestions
                                .filter(
                                  (q) => q.status !== OpenQuestionStatus.Paused,
                                )
                                .map(async (question) => {
                                  return API.questions
                                    .update(question.id, {
                                      status: ClosedQuestionStatus.Resolved,
                                    })
                                    .catch((e) => {
                                      const errorMessage = getErrorMessage(e)
                                      message.error(errorMessage)
                                      throw e
                                    })
                                })
                              Promise.all(promises)
                                .catch((e) => {
                                  message.error(
                                    'One or more status updates failed:' + e,
                                  )
                                })
                                .finally(() => {
                                  setIsFinishAllHelpingButtonLoading(false)
                                })
                            }}
                          />
                        </span>
                      </Tooltip>
                    )}
                  </div>
                  {helpingQuestions.map((question: Question) => {
                    return (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        cid={cid}
                        queueType={queue.type}
                        qid={qid}
                        configTasks={configTasks}
                        studentAssignmentProgress={studentAssignmentProgress}
                        isStaff={isStaff}
                        isBeingHelped={true}
                      />
                    )
                  })}
                  <Divider className={'my-4'} />
                </>
              )}
              {pausedQuestions && pausedQuestions.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <QueueHeader
                      text="Paused Questions"
                      visibleOnDesktopOrMobile="both"
                    />
                  </div>
                  {pausedQuestions.map((question: Question) => (
                    <QuestionCard
                      className={'bg-amber-50'}
                      key={question.id}
                      question={question}
                      cid={cid}
                      qid={qid}
                      configTasks={configTasks}
                      queueType={queue.type}
                      studentAssignmentProgress={studentAssignmentProgress}
                      isStaff={isStaff}
                      isBeingHelped={true}
                      isPaused={true}
                    />
                  ))}
                  <Divider className={'my-4'} />
                </>
              )}
            </>
          ) : !isStaff ? (
            <StudentBanner
              queueId={qid}
              editQuestion={() => openEditQuestionDemoModal(false)}
              editDemo={() => openEditQuestionDemoModal(true)}
              leaveQueueQuestion={() => leaveQueue(false)}
              leaveQueueDemo={() => leaveQueue(true)}
              configTasks={configTasks}
              isQueueHybrid={isQueueHybrid}
            />
          ) : null}
          <QueueQuestions
            questions={queueQuestions.questions}
            /*
              The reason there are filters here is because students need to be able to see these too
            */
            questionsGettingHelp={queueQuestions.questionsGettingHelp.filter(
              (q) => q.status == 'Helping',
            )}
            pausedQuestions={queueQuestions.questionsGettingHelp.filter(
              (q) => q.status == 'Paused',
            )}
            cid={cid}
            qid={qid}
            queueType={queue.type}
            isStaff={isStaff}
            studentAssignmentProgress={studentAssignmentProgress}
            studentQuestionId={studentQuestionId}
            studentDemoId={studentDemoId}
            queueConfig={queueConfig}
            configTasks={configTasks}
            tagGroupsEnabled={tagGroupsEnabled}
            setTagGroupsEnabled={setTagGroupsEnabled}
            taskTree={taskTree}
            isDemoQueue={isDemoQueue}
            questionTypes={questionTypes}
            studentQuestion={studentQuestion}
            studentDemo={studentDemo}
            createQuestion={createQuestion}
            finishQuestionOrDemo={finishQuestionOrDemo}
            leaveQueue={leaveQueue}
            onOpenTagGroupsChange={onOpenTagGroupsChange}
            openTagGroups={openTagGroups}
            staffListLength={queue.staffList.length}
          />
        </div>
        {isStaff ? (
          <>
            <EditQueueModal
              queueId={qid}
              courseId={cid}
              open={queueSettingsModalOpen}
              onEditSuccess={() => setQueueSettingsModalOpen(false)}
              onCancel={() => setQueueSettingsModalOpen(false)}
            />
            <AddStudentsToQueueModal
              queueId={qid}
              courseId={cid}
              isQueueHybrid={queue.type === 'hybrid'}
              open={addStudentsModalOpen}
              onAddStudent={() => {
                mutateQuestions()
                setAddStudentsModalOpen(false)
              }}
              onCancel={() => setAddStudentsModalOpen(false)}
            />
            {isDemoQueue && (
              <AssignmentReportModal
                queueId={qid}
                courseId={cid}
                assignmentName={queueConfig?.assignment_id}
                configTasks={configTasks}
                open={assignmentReportModalOpen}
                onClose={() => setAssignmentReportModalOpen(false)}
              />
            )}
          </>
        ) : (
          <>
            <CreateQuestionModal
              queueId={qid}
              courseId={cid}
              isQueueHybrid={queue?.type === 'hybrid'}
              open={
                (!studentQuestion && isJoiningQuestion) || editQuestionModalOpen
              }
              question={studentQuestion}
              leaveQueue={() => leaveQueue(false)}
              finishQuestion={(
                text,
                questionTypes,
                location,
                isTaskQuestion,
                groupable,
              ) => {
                finishQuestionOrDemo(
                  text,
                  questionTypes ?? [],
                  groupable,
                  isTaskQuestion,
                  location,
                )
                handleFirstQuestionNotification(cid)
                closeEditQuestionDemoModal(isTaskQuestion)
              }}
              position={
                studentQuestionIndex === undefined
                  ? undefined
                  : studentQuestionIndex + 1
              }
              setIsJoinQueueModalLoading={setIsJoinQueueModalLoading}
              onCancel={() => closeEditQuestionDemoModal(false)}
              minTags={queueConfig?.minimum_tags}
            />
            <StudentRemovedFromQueueModal
              question={studentQuestion}
              leaveQueue={() => leaveQueue(false)}
              joinQueue={() => joinQueueAfterDeletion(false)}
            />
            <CantFindModal
              open={studentQuestion?.status === LimboQuestionStatus.CantFind}
              leaveQueue={() => leaveQueue(false)}
              rejoinQueue={() => rejoinQueue(false)}
            />
            <JoinZoomNowModal
              taName={studentQuestion?.taHelped?.name}
              open={
                ((queue.type === 'hybrid' &&
                  studentQuestion?.location === 'Online') ||
                  queue.type === 'online') &&
                !clickedZoomModal &&
                studentQuestion?.status === OpenQuestionStatus.Helping
              }
              notes={queue?.notes}
              zoomLink={queue.zoomLink ?? course?.zoomLink}
              onJoin={() => {
                setClickedZoomModal(true)
              }}
              setRequeuing={() => setRequeuing(false)}
            />

            {isDemoQueue && (
              <>
                <CreateDemoModal
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  configTasks={configTasks!} // configTasks is guaranteed to be defined here since isDemoQueue would be false otherwise. Typescript is being silly
                  studentAssignmentProgress={studentAssignmentProgress}
                  open={(!studentDemo && isJoiningDemo) || editDemoModalOpen}
                  question={studentDemo}
                  leaveQueue={() => leaveQueue(true)}
                  finishDemo={(
                    text,
                    questionTypes,
                    location,
                    isTaskQuestion,
                    groupable,
                  ) => {
                    finishQuestionOrDemo(
                      text,
                      questionTypes,
                      groupable,
                      isTaskQuestion,
                      location,
                    )
                    handleFirstQuestionNotification(cid)
                    closeEditQuestionDemoModal(isTaskQuestion)
                  }}
                  position={
                    studentDemoIndex === undefined
                      ? undefined
                      : studentDemoIndex + 1
                  }
                  setIsCreateDemoModalLoading={setIsCreateDemoModalLoading}
                  onCancel={() => closeEditQuestionDemoModal(true)}
                />
                <StudentRemovedFromQueueModal
                  question={studentDemo}
                  leaveQueue={() => leaveQueue(true)}
                  joinQueue={() => joinQueueAfterDeletion(true)}
                />
                <CantFindModal
                  open={studentDemo?.status === LimboQuestionStatus.CantFind}
                  leaveQueue={() => leaveQueue(true)}
                  rejoinQueue={() => rejoinQueue(true)}
                />
                <JoinZoomNowModal
                  taName={studentQuestion?.taHelped?.name}
                  open={
                    ((queue.type === 'hybrid' && // Forces student to join zoom or requeue themselves if they are not ready
                      studentQuestion?.location === 'Online') || // Modal closes in either case
                      queue.type === 'online') &&
                    !clickedZoomModal &&
                    studentQuestion?.status === OpenQuestionStatus.Helping
                  }
                  notes={queue?.notes}
                  zoomLink={queue.zoomLink ?? course?.zoomLink}
                  onJoin={() => setClickedZoomModal(true)}
                  setRequeuing={() => setRequeuing(false)}
                />
              </>
            )}
          </>
        )}
      </div>
    )
  }
}
