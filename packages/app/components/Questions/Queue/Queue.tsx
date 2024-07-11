import {
  ReactElement,
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
} from 'react'
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
  ConfigTasksWithAssignmentProgress,
  transformIntoTaskTree,
  TaskTree,
  Task,
} from '@koh/common'
import { useTAInQueueInfo } from '../../../hooks/useTAInQueueInfo'
import { useCourse } from '../../../hooks/useCourse'
import {
  QueueInfoColumnButton,
  EditQueueButton,
  VerticalDivider,
} from '../Shared/SharedComponents'
import { QueueInfoColumn } from '../Queue/QueueInfoColumn'
import {
  Tooltip,
  message,
  notification,
  Spin,
  Button,
  Switch,
  Card,
  Divider,
  Collapse,
} from 'antd'
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
import {
  EditOutlined,
  LoginOutlined,
  MenuOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { NextRouter } from 'next/router'
import { ListChecks, ListTodoIcon } from 'lucide-react'
import { useStudentAssignmentProgress } from '../../../hooks/useStudentAssignmentProgress'
import { AssignmentReportModal } from './AssignmentReportModal'
import { QuestionType } from '../Shared/QuestionType'
import { useQuestionTypes } from '../../../hooks/useQuestionTypes'
import JoinTagGroupButton from './JoinTagGroupButton'

const Panel = Collapse.Panel

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
  const [questionTypes] = useQuestionTypes(cid, qid)
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
  const [taskTree, setTaskTree] = useState<TaskTree>({} as TaskTree)
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
  const [tagGroupsEnabled, setTagGroupsEnabled] = useState(
    queueConfig?.default_view === 'tag_groups',
  )
  // Memoize the calculation of isStaff based on relevant profile changes
  const isUserStaff = useMemo(() => {
    return (
      profile?.courses?.some(
        (course) =>
          course.course.id === cid &&
          (course.role === Role.PROFESSOR || course.role === Role.TA),
      ) || false
    )
  }, [profile?.courses, cid])

  // Update isStaff state only when isUserStaff changes
  // Previously, this was done in the useEffect hook with profile as a dependency, but this caused unnecessary re-renders on anything that's dependent on isStaff
  // This is because profile is a complex object and changes frequently, so it's better to compare the derived value (isUserStaff) instead
  useEffect(() => {
    setIsStaff(isUserStaff)
  }, [isUserStaff])

  // const [openTagGroups, setOpenTagGroups] = useState((questions?.queue?.length > 0 && isStaff) ? Object.keys(configTasks) : []);
  const [openTagGroups, setOpenTagGroups] = useState<string[]>([])
  const tagGroupsTimeoutRef = useRef(null) // need to keep track of timeouts so that old timeouts won't keep running when the user starts a new timeout (to prevent flickering when a tag group is spammed open/closed, UX thing)
  const onOpenTagGroupsChange = (key) => {
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
      setOpenTagGroups(key)
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
      questions &&
      questionTypes
    ) {
      // Set default values based on queueConfig
      const newTagGroupsEnabled = queueConfig.default_view === 'tag_groups'
      setTagGroupsEnabled(newTagGroupsEnabled)

      // if you're staff and there's less than 10 questions in the queue, open all tag groups by default
      if (isStaff && questions.queue?.length < 10) {
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
  }, [queueConfig, configTasks, isStaff, questions, questionTypes])

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
    async (
      text: string,
      questionTypes: QuestionTypeParams[],
      force: boolean,
      isTaskQuestion: boolean,
      location?: string,
    ) => {
      const newQuestion = await API.questions.create({
        text: text,
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
      updateQuestionStatus(id, OpenQuestionStatus.Queued)
    },
    [studentDemoId, studentQuestionId, updateQuestionStatus],
  )

  const joinQueueAfterDeletion = useCallback(
    (isTaskQuestion: boolean) => {
      const question = isTaskQuestion ? studentDemo : studentQuestion
      const id = isTaskQuestion ? studentDemoId : studentQuestionId
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
    async (isTaskQuestion) => {
      if (isTaskQuestion) {
        await updateQuestionStatus(
          studentDemoId,
          ClosedQuestionStatus.ConfirmedDeleted,
        )
      } else {
        //delete draft when they leave the queue
        deleteDraftQuestion()
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
      deleteDraftQuestion,
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
          if (taskValue.isDone && configTasksCopy[taskKey]) {
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
        tagGroupsEnabled={tagGroupsEnabled}
        setTagGroupsEnabled={setTagGroupsEnabled}
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
        tagGroupsEnabled={tagGroupsEnabled}
        setTagGroupsEnabled={setTagGroupsEnabled}
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
        <div className="flex items-center justify-between">
          {questions?.length === 0 ? (
            <NoQuestionsText>
              There are no questions in the queue
            </NoQuestionsText>
          ) : (
            // only show this queue header on desktop
            <QueueHeader className="hidden sm:block">
              {tagGroupsEnabled ? 'Queue Groups By Tag' : 'Queue'}
            </QueueHeader>
          )}
          {!(
            queueConfig.fifo_queue_view_enabled === false ||
            queueConfig.tag_groups_queue_view_enabled === false
          ) ? (
            <Switch
              className="hidden sm:block" // only show on desktop
              defaultChecked={tagGroupsEnabled}
              onChange={() => {
                setTimeout(() => {
                  // do a timeout to allow the animation to play
                  setTagGroupsEnabled(!tagGroupsEnabled)
                }, 200)
              }}
              checkedChildren={
                <div className="flex min-h-[12px] flex-col items-center justify-center">
                  <div className="mb-[2px] min-h-[5px] w-full rounded-[1px] border border-gray-300" />
                  <div className="min-h-[5px] w-full rounded-[1px] border border-gray-300" />
                </div>
              }
              unCheckedChildren={<MenuOutlined />}
            />
          ) : null}
        </div>
        {tagGroupsEnabled ? (
          <Collapse
            onChange={onOpenTagGroupsChange}
            className="border-none"
            defaultActiveKey={openTagGroups}
          >
            {/* tasks (for demos/TaskQuestions) */}
            {taskTree &&
              Object.entries(taskTree).map(([taskKey, task]) => {
                const filteredQuestions = questions?.filter(
                  (question: Question) => {
                    const tasks = question.isTaskQuestion
                      ? question.text
                          .match(/"(.*?)"/g)
                          ?.map((task) => task.slice(1, -1)) || []
                      : []
                    return question.isTaskQuestion && tasks.includes(taskKey)
                  },
                )
                return (
                  filteredQuestions &&
                  ((isStaff && filteredQuestions.length > 0) || !isStaff) && (
                    <Panel
                      className="tag-group mb-3 rounded bg-white shadow-lg"
                      key={taskKey}
                      header={
                        <div className="flex justify-between">
                          <div>
                            <QuestionType
                              typeName={task.display_name}
                              typeColor={task.color_hex}
                            />
                            <span className=" ml-2 text-gray-700">
                              {filteredQuestions.length > 1
                                ? `${filteredQuestions.length} Students`
                                : filteredQuestions.length == 1
                                  ? `${filteredQuestions.length} Student`
                                  : ''}
                            </span>
                          </div>
                          <div className="row flex">
                            {task.blocking && (
                              <span className="mr-2 text-gray-400">
                                blocking
                              </span>
                            )}
                            {!isStaff && (
                              <JoinTagGroupButton
                                studentQuestion={studentQuestion}
                                studentDemo={studentDemo}
                                createQuestion={createQuestion}
                                updateQuestion={finishQuestionOrDemo}
                                leaveQueue={leaveQueue}
                                isDone={task.isDone}
                                taskId={taskKey}
                                disabled={
                                  !isTaskJoinable(
                                    task,
                                    true,
                                    studentDemo?.text,
                                  ) || queue.staffList?.length < 1
                                }
                              />
                            )}
                          </div>
                        </div>
                      }
                    >
                      {filteredQuestions.map(
                        (question: Question, index: number) => {
                          const isMyQuestion = question.id === studentDemoId
                          const background_color = isMyQuestion
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
                              studentAssignmentProgress={
                                studentAssignmentProgress
                              }
                              isMyQuestion={isMyQuestion}
                              className={background_color}
                            />
                          )
                        },
                      )}
                    </Panel>
                  )
                )
              })}
            {isDemoQueue && (
              <Divider
                className="-mx-4 my-2 w-[calc(100%+2rem)] border-[#cfd6de]"
                key="DIVIDER"
              />
            )}
            {/* questionTypes/tags (for regular questions) */}
            {questionTypes?.map((tag) => {
              // naming this "tags" to make some code slightly easier to follow
              const filteredQuestions = questions?.filter(
                (question: Question) =>
                  question.questionTypes.some(
                    (questionType) => questionType.name === tag.name,
                  ),
              )
              return (
                filteredQuestions &&
                ((isStaff && filteredQuestions.length > 0) || !isStaff) && (
                  <Panel
                    className="tag-group mb-3 rounded bg-white shadow-lg"
                    key={tag.id.toString()}
                    header={
                      <div className="flex justify-between">
                        <div>
                          <QuestionType
                            typeName={tag.name}
                            typeColor={tag.color}
                          />
                          <span className=" ml-2 text-gray-700">
                            {filteredQuestions.length > 1
                              ? `${filteredQuestions.length} Students`
                              : filteredQuestions.length == 1
                                ? `${filteredQuestions.length} Student`
                                : ''}
                          </span>
                        </div>
                        {!isStaff && (
                          <JoinTagGroupButton
                            studentQuestion={studentQuestion}
                            studentDemo={studentDemo}
                            createQuestion={createQuestion}
                            updateQuestion={finishQuestionOrDemo}
                            leaveQueue={leaveQueue}
                            questionType={tag}
                            disabled={queue.staffList?.length < 1}
                          />
                        )}
                      </div>
                    }
                  >
                    {filteredQuestions.map(
                      (question: Question, index: number) => {
                        const isMyQuestion = question.id === studentQuestionId
                        const background_color = isMyQuestion
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
                            studentAssignmentProgress={
                              studentAssignmentProgress
                            }
                            isMyQuestion={isMyQuestion}
                            className={background_color}
                          />
                        )
                      },
                    )}
                  </Panel>
                )
              )
            })}
          </Collapse>
        ) : (
          questions?.map((question: Question, index: number) => {
            const isMyQuestion =
              question.id === studentQuestionId || question.id === studentDemoId
            const background_color = isMyQuestion
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
                isMyQuestion={isMyQuestion}
                className={background_color}
              />
            )
          })
        )}
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
