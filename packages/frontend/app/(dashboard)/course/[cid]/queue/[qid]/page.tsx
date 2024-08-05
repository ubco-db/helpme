'use client'

import {
  ReactElement,
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import {
  QuestionTypeParams,
  ClosedQuestionStatus,
  ERROR_MESSAGES,
  LimboQuestionStatus,
  OpenQuestionStatus,
  Question,
  Role,
  QuestionStatus,
  ConfigTasksWithAssignmentProgress,
  transformIntoTaskTree,
  TaskTree,
  Task,
  parseTaskIdsFromQuestionText,
  QuestionType,
} from '@koh/common'
// import { QueueInfoColumn } from '../Queue/QueueInfoColumn'
import {
  Tooltip,
  message,
  notification,
  Button,
  Switch,
  Card,
  Divider,
  Collapse,
} from 'antd'
// import CantFindModal from './StudentCantFindModal'
// import StudentBanner from './StudentBanner'
import { mutate } from 'swr'
// import QuestionForm from './QuestionForm'
// import DemoForm from './DemoForm'
// import { AddStudentsModal } from './TAAddStudent'
// import { EditQueueModal } from './EditQueueModal'
import {
  EditOutlined,
  LoginOutlined,
  MenuOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { NextRouter } from 'next/router'
import { ListChecks, ListTodoIcon } from 'lucide-react'
// import { useStudentAssignmentProgress } from '../../../hooks/useStudentAssignmentProgress'
// import { AssignmentReportModal } from './AssignmentReportModal'
// import JoinTagGroupButton from './JoinTagGroupButton'
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
import { getHelpingQuestions } from './utils/commonQueueFunctions'
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'
import { QuestionTagElement } from '../../components/QuestionTagElement'
import { useLocalStorage } from '@/app/hooks/useLocalStorage'
import QueueInfoColumn from './components/QueueInfoColumn'
import TACheckinButton from '../../components/TACheckinButton'
import { API } from '@/app/api'
import TagGroupSwitch from './components/TagGroupSwitch'
import QueueQuestions from './components/QueueQuestions'
import { useRouter } from 'next/navigation'
import CreateQuestionModal from './components/modals/CreateQuestionModal'
import StudentRemovedFromQueueModal from './components/modals/StudentRemovedFromQueueModal'
import StudentBanner from './components/StudentBanner'
import EditQueueModal from './components/modals/EditQueueModal'
import AddStudentsToQueueModal from './components/modals/AddStudentsToQueueModal'

const Panel = Collapse.Panel

type QueuePageProps = {
  params: { cid: string; qid: string }
}

export default function QueuePage({ params }: QueuePageProps): ReactElement {
  const cid = Number(params.cid)
  const qid = Number(params.qid)
  const router = useRouter()
  const { queue } = useQueue(qid)
  const isQueueOnline = queue?.room.startsWith('Online')
  const { queueQuestions, mutateQuestions } = useQuestions(qid)
  const [queueSettingsModalOpen, setQueueSettingsModalOpen] = useState(false)
  const [addStudentsModalOpen, setAddStudentsModalOpen] = useState(false)
  const [assignmentReportModal, setAssignmentReportModal] = useState(false)
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
  const [editQuestionModalVisible, setEditQuestionModalVisible] =
    useState(false)
  const [popupEditDemo, setPopupEditDemo] = useState(false)
  const role = getRoleInCourse(userInfo, cid)
  const isStaff = role === Role.TA || role === Role.PROFESSOR
  const [questionTypes] = useQuestionTypes(cid, qid)
  const queueConfig = queue?.config
  const configTasks = queueConfig?.tasks
  const isDemoQueue: boolean = !!configTasks && !!queueConfig.assignment_id
  const studentAssignmentProgress = useStudentAssignmentProgress(
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
  const [tagGroupsEnabled, setTagGroupsEnabled] = useState(
    queueConfig?.default_view === 'tag_groups',
  )
  const [, , deleteStoredDraftQuestion] = useLocalStorage('draftQuestion', null)
  const [isFirstQuestion, setIsFirstQuestion] = useLocalStorage(
    'isFirstQuestion',
    true,
  )
  const { helpingQuestions } = getHelpingQuestions(
    queueQuestions,
    userInfo.id,
    role,
  )

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

  const updateQuestionStatus = useCallback(
    async (id: number, status: QuestionStatus) => {
      await API.questions.update(id, { status })
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
      location?: string,
    ) => {
      const newQuestion = await API.questions.create({
        text: text || '',
        questionTypes: questionTypes,
        queueId: qid,
        location: location ?? isQueueOnline ? 'Online' : 'In Person',
        force: force,
        groupable: false,
        isTaskQuestion,
      })
      await updateQuestionStatus(newQuestion.id, OpenQuestionStatus.Queued)
    },
    [isQueueOnline, qid, updateQuestionStatus],
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
        setPopupEditDemo(true)
      } else {
        setEditQuestionModalVisible(true)
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
      setEditQuestionModalVisible(false)
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
            ? setPopupEditDemo(true)
            : setEditQuestionModalVisible(true)
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
      location: string,
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

  const isTaskJoinable = (
    task: Task,
    isFirst = true,
    studentDemoText: string | undefined,
  ): boolean => {
    // Goal: Before joining, for the task's preconditions, make sure there are no blocking tasks that are not done (this is done recursively)
    if (task.blocking && !task.isDone && !isFirst) {
      return false
    }

    // Goal: Before joining, all the task's preconditions must be in the student's demo (this is also done recursively)
    if (
      !(
        !task.precondition ||
        studentDemoText?.includes(` "${task.precondition.taskId}"`)
      )
    ) {
      return false
    }

    // Goal: Before leaving, the student's demo must not have any tasks that depend on this task
    if (isFirst) {
      if (
        Object.entries(taskTree).some(([, tempTask]) => {
          return (
            tempTask.precondition?.taskId === task.taskId &&
            studentDemoText?.includes(` "${tempTask.taskId}"`)
          )
        })
      ) {
        return false
      }
    }

    // If there's a precondition, recursively check it, marking it as not the first task
    if (task.precondition) {
      return isTaskJoinable(task.precondition, false, studentDemoText)
    }

    // If none of the above conditions are met, the task is valid
    return true
  }

  function RenderQueueInfoCol(): ReactElement {
    const [isJoinQueueModalLoading, setIsJoinQueueModalLoading] =
      useState(false)

    const joinQueue = useCallback(async (isTaskQuestion: boolean) => {
      setIsJoinQueueModalLoading(true)
      joinQueueOpenModal(false, isTaskQuestion)
      setIsJoinQueueModalLoading(false)
    }, [])

    if (!queue) {
      return <></>
    }
    return (
      <QueueInfoColumn
        queueId={qid}
        isStaff={isStaff}
        tagGroupsEnabled={tagGroupsEnabled}
        setTagGroupsEnabled={setTagGroupsEnabled}
        hasDemos={isDemoQueue}
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
              <EditQueueButton
                onClick={() => setQueueSettingsModalOpen(true)}
                icon={<EditOutlined />}
              >
                {/* only show the "Details" part on desktop to keep button small on mobile */}
                <span>
                  Edit Queue <span className="hidden sm:inline">Details</span>
                </span>
              </EditQueueButton>
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
                  onClick={() => setAssignmentReportModal(true)}
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
                  <JoinQueueButton
                    id="join-queue-button"
                    disabled={
                      !queue?.allowQuestions ||
                      queue?.isDisabled ||
                      isJoinQueueModalLoading ||
                      queue.staffList.length < 1 ||
                      !!studentQuestion
                    }
                    onClick={() => joinQueue(false)}
                    icon={<LoginOutlined aria-hidden="true" />}
                  >
                    {isDemoQueue ? 'Create Question' : 'Join Queue'}
                  </JoinQueueButton>
                </div>
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
                  <div>
                    <JoinQueueButton
                      id="join-queue-button-demo"
                      disabled={
                        !queue?.allowQuestions ||
                        queue?.isDisabled ||
                        isJoinQueueModalLoading ||
                        queue.staffList.length < 1 ||
                        !!studentDemo
                      }
                      onClick={() => joinQueue(true)}
                      icon={
                        <ListTodoIcon aria-hidden="true" className="mr-1" />
                      }
                    >
                      Create Demo
                    </JoinQueueButton>
                  </div>
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
        <RenderQueueInfoCol />
        <VerticalDivider />
        <div className="flex-grow md:mt-8">
          {isStaff && helpingQuestions && helpingQuestions.length > 0 ? (
            <>
              <QueueHeader
                text="You are Currently Helping"
                visibleOnDesktopOrMobile="both"
              />
              {helpingQuestions.map((question: Question) => {
                return (
                  <QuestionCard
                    key={question.id}
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
          ) : null}
          <QueueQuestions
            questions={queueQuestions.questions}
            cid={cid}
            qid={qid}
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
              open={addStudentsModalOpen}
              onAddStudent={() => {
                mutateQuestions()
                setAddStudentsModalOpen(false)
              }}
              onCancel={() => setAddStudentsModalOpen(false)}
            />
          </>
        ) : (
          <>
            <CreateQuestionModal
              queueId={qid}
              courseId={cid}
              open={
                (!studentQuestion && isJoiningQuestion) ||
                editQuestionModalVisible
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
                studentQuestionIndex ? studentQuestionIndex + 1 : undefined
              }
              onCancel={() => closeEditQuestionDemoModal(false)}
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
        {/* {isStaff ? (
          <>
            {isDemoQueue && (
              <AssignmentReportModal
                queueId={qid}
                courseId={cid}
                assignmentName={queueConfig?.assignment_id}
                configTasks={configTasks}
                visible={assignmentReportModal}
                onClose={() => setAssignmentReportModal(false)}
              />
            )}
          </>
        ) : (
          <>
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
          </>
        )} */}
      </div>
    )
  }
}
