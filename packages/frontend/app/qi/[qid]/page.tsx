'use client'

import {
  Button,
  Collapse,
  Divider,
  message,
  QRCode,
  Result,
  Switch,
  Tooltip,
} from 'antd'
import {
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  use,
} from 'react'
import {
  decodeBase64,
  encodeBase64,
  LimboQuestionStatus,
  OpenQuestionStatus,
  parseTaskIdsFromQuestionText,
  PublicQueueInvite,
  Question,
  Role,
  TaskTree,
  transformIntoTaskTree,
  UBCOuserParam,
  User,
} from '@koh/common'
import { API } from '@/app/api'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import Link from 'next/link'
import { userApi } from '@/app/api/userApi'
import StandardPageContainer from '@/app/components/standardPageContainer'
import { setQueueInviteCookie } from '@/app/api/cookieApi'
import { StatusCard } from '@/app/(dashboard)/course/[cid]/queue/[qid]/components/StaffList'
import { useQuestionsWithQueueInvite } from '@/app/hooks/useQuestionsWithQueueInvite'
import { useQueueWithQueueInvite } from '@/app/hooks/useQueueWithQueueInvite'
import QuestionCardSimple from './components/QuestionCardSimple'
import TagGroupSwitch from '@/app/(dashboard)/course/[cid]/queue/[qid]/components/TagGroupSwitch'
import { QuestionTagElement } from '@/app/(dashboard)/course/[cid]/components/QuestionTagElement'
import printQRCode from '@/app/utils/QRCodePrintUtils'

const Panel = Collapse.Panel

type QueueInvitePageProps = {
  params: Promise<{ qid: string }>
}
/**
 * NOTE: This is the QUEUE INVITES page.
 * The reason the folder is called `qi` is to shorten the URL so the QR code is easier to scan.
 */
export default function QueueInvitePage(
  props: QueueInvitePageProps,
): ReactElement {
  const params = use(props.params)
  const qid = Number(params.qid)
  const searchParams = useSearchParams()
  const router = useRouter()
  const encodedCode = searchParams.get('c') ?? ''
  const code = decodeBase64(encodedCode)
  const [projectorModeEnabled, setProjectorModeEnabled] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [hasFetchErrorOccurred, setHasFetchErrorOccurred] = useState(false)
  const [queueInviteInfo, setQueueInviteInfo] =
    useState<PublicQueueInvite | null>(null)
  const [profile, setProfile] = useState<User>()
  const [hasGettingUserBeenResolved, setHasGettingUserBeenResolved] =
    useState(false) // don't let the users hit the join button before we find out if they're logged in or not
  const [isJoinButtonLoading, setIsJoinButtonLoading] = useState(false)
  const [queueSize, setQueueSize] = useState<number | null>(null)
  // NOTE: queueQuestions and queue are ONLY set if the queue invite code is correct and if the questions are visible
  const { queueQuestions } = useQuestionsWithQueueInvite(
    qid,
    encodedCode,
    queueInviteInfo?.isQuestionsVisible,
  )
  const { queue } = useQueueWithQueueInvite(
    qid,
    encodedCode,
    queueInviteInfo?.isQuestionsVisible,
  )
  const queueConfig = queue?.config
  const configTasks = queueConfig?.tasks
  const isDemoQueue: boolean = !!configTasks && !!queueConfig.assignment_id
  const [taskTree, setTaskTree] = useState<TaskTree>({} as TaskTree)
  const [tagGroupsEnabled, setTagGroupsEnabled] = useState(
    queueConfig?.default_view === 'tag_groups',
  )

  const hasDefaultsBeenInitializedRef = useRef(false) // used to track if the defaults have been initialized.
  useEffect(() => {
    // Only initialize once when queueConfig becomes defined and hasn't been initialized before
    if (
      !hasDefaultsBeenInitializedRef.current &&
      queueConfig &&
      configTasks &&
      queueQuestions
    ) {
      // Set default values based on queueConfig
      const newTagGroupsEnabled = queueConfig.default_view === 'tag_groups'
      setTagGroupsEnabled(newTagGroupsEnabled)

      // Mark as initialized to prevent future updates
      hasDefaultsBeenInitializedRef.current = true
    }
  }, [queueConfig, configTasks, queueQuestions])

  useEffect(() => {
    const fetchUserDetails = async () => {
      await userApi
        .getUser()
        .then((userDetails) => {
          setProfile(userDetails)
        })
        .finally(() => {
          setHasGettingUserBeenResolved(true)
        })
    }
    fetchUserDetails()
  }, [setProfile, setHasGettingUserBeenResolved])

  // if questions are enabled, dynamically set the queue size, otherwise set it to queueInvite.queueSize
  useEffect(() => {
    if (queueInviteInfo) {
      if (queueInviteInfo.isQuestionsVisible && queue) {
        setQueueSize(queue.queueSize)
      } else {
        setQueueSize(queueInviteInfo.queueSize)
      }
    }
  }, [queue, queueInviteInfo])

  const isHttps =
    (typeof window !== 'undefined' && window.location.protocol) === 'https:'
  const baseURL =
    typeof window !== 'undefined'
      ? `${isHttps ? 'https' : 'http'}://${window.location.host}`
      : ''
  const inviteURL = queueInviteInfo
    ? `${baseURL}/qi/${queueInviteInfo.queueId}?c=${encodeBase64(queueInviteInfo.inviteCode)}`
    : ''

  const fetchPublicQueueInviteInfo = useCallback(async () => {
    try {
      const queueInviteInfo = await API.queueInvites.get(qid, encodedCode)
      setQueueInviteInfo(queueInviteInfo)
    } catch (error) {
      setHasFetchErrorOccurred(true)
    } finally {
      setPageLoading(false)
    }
  }, [qid, encodedCode])

  useEffect(() => {
    fetchPublicQueueInviteInfo()
  }, [fetchPublicQueueInviteInfo])

  // if the user is already logged in, is a student, and is in the course, redirect them to the queue page
  // The reason why it's only students is so that professors can easily show this page (to show the QR code)
  // don't redirect if they hit the back button
  useEffect(() => {
    if (
      queueInviteInfo &&
      profile &&
      profile.courses.some(
        (course) =>
          course.course.id === queueInviteInfo.courseId &&
          course.role === Role.STUDENT,
      )
    ) {
      router.replace(
        `/course/${queueInviteInfo.courseId}/queue/${queueInviteInfo.queueId}`,
      )
    }
  }, [profile, queueInviteInfo, router])

  const JoinQueueButtonClick = useCallback(async () => {
    if (!queueInviteInfo) {
      message.error('Queue invite info not loaded. Please try again')
      return
    }
    // if the user is already logged in and is in the course, redirect them to the queue
    if (
      profile &&
      profile.courses.some(
        (course) => course.course.id === queueInviteInfo.courseId,
      )
    ) {
      router.push(
        `/course/${queueInviteInfo.courseId}/queue/${queueInviteInfo.queueId}`,
      )
    } else if (
      profile &&
      profile.organization?.orgId !== queueInviteInfo.orgId
    ) {
      // if the user is not a part of this organization, log them out
      await setQueueInviteCookie(
        queueInviteInfo.queueId,
        queueInviteInfo.courseId,
        queueInviteInfo.orgId,
        queueInviteInfo.courseInviteCode,
      ).then(() => {
        router.push('/api/v1/logout')
      })
    } else if (
      profile &&
      queueInviteInfo.willInviteToCourse &&
      queueInviteInfo.courseInviteCode
    ) {
      // if the user is already logged in but not in the course (and willInviteToCourse is enabled), enroll them in the course
      setIsJoinButtonLoading(true)
      const userData: UBCOuserParam = {
        email: profile.email,
        selected_course: queueInviteInfo.courseId,
        organizationId: queueInviteInfo.orgId,
      }
      await API.course
        .enrollByInviteCode(userData, queueInviteInfo.courseInviteCode)
        .then(() => {
          router.push(
            `/course/${queueInviteInfo.courseId}/queue/${queueInviteInfo.queueId}`,
          )
        })
        .catch((error) => {
          const errorMessage = getErrorMessage(error)
          message.error('Failed to enroll in course: ' + errorMessage)
        })
        .finally(() => {
          setIsJoinButtonLoading(false)
        })
    } else if (profile) {
      message.error('You must be a part of this course to use this invite')
    } else {
      // if the user is not logged in, set their cookies and then redirect them to the login page
      await setQueueInviteCookie(
        queueInviteInfo.queueId,
        queueInviteInfo.courseId,
        queueInviteInfo.orgId,
        queueInviteInfo.courseInviteCode,
      ).then(() => {
        router.push('/login')
      })
    }
  }, [queueInviteInfo, router, profile])

  useEffect(() => {
    // only re-calculate the taskTree and everything if tagGroups is enabled
    if (tagGroupsEnabled) {
      const configTasksCopy = {
        ...configTasks,
      } // Create a copy of configTasks (since the function will mutate it)
      setTaskTree(transformIntoTaskTree(configTasksCopy)) // transformIntoTaskTree changes each precondition to carry a reference to the actual task object instead of just a string
    }
  }, [tagGroupsEnabled, configTasks])

  const renderQuestion = (question: Question) => {
    return (
      <QuestionCardSimple
        key={question.id}
        question={question}
        configTasks={configTasks}
        isBeingHelped={question.status == OpenQuestionStatus.Helping}
        isPaused={question.status == OpenQuestionStatus.Paused}
        isBeingReQueued={question.status === LimboQuestionStatus.ReQueueing}
      />
    )
  }

  if (pageLoading) {
    return <CenteredSpinner tip="Loading..." />
  } else if (hasFetchErrorOccurred) {
    return (
      <Result
        status="404"
        title="404"
        subTitle="Sorry, the queue invite link you used is invalid or was removed."
        extra={
          <Link href="/login">
            <Button type="primary">Back to Login</Button>
          </Link>
        }
      />
    )
  } else if (!queueInviteInfo) {
    return <CenteredSpinner tip="Queue invite loading..." />
  } else {
    return (
      <StandardPageContainer className="min-h-full items-center gap-y-2">
        <title>{`HelpMe - Invitation to join ${queueInviteInfo.room} for ${queueInviteInfo.courseName}`}</title>
        <div className="flex min-h-full w-full flex-col px-1 md:flex-row md:gap-x-4 md:px-0">
          <div
            className={cn(
              'flex w-full flex-col items-center gap-y-4 md:min-h-screen',
              queueInviteInfo.isQuestionsVisible &&
                'md:w-[30rem] md:items-start md:border-r-2 md:border-[#cfd6de] md:pr-4 md:pt-5',
            )}
          >
            <h1>
              {queueInviteInfo.room} | {queueInviteInfo.courseName}
            </h1>
            {queueSize === null ? (
              <p>Loading...</p>
            ) : queueSize === 0 ? (
              <p>The queue is empty!</p>
            ) : (
              <p>
                There {queueSize === 1 ? 'is' : 'are'} currently{' '}
                <span className="font-bold">{queueSize}</span>{' '}
                {queueSize === 1 ? 'student' : 'students'} in queue
              </p>
            )}
            {!projectorModeEnabled && (
              <Button
                type="primary"
                className="w-full md:max-w-[30rem]"
                size="large"
                loading={!hasGettingUserBeenResolved || isJoinButtonLoading}
                disabled={!hasGettingUserBeenResolved}
                onClick={JoinQueueButtonClick}
              >
                Join Queue
              </Button>
            )}
            <div className="w-full md:max-w-[30rem]">
              <h2 className="">Staff</h2>
              {queueInviteInfo.staffList.length === 0 ? (
                <div
                  role="alert"
                  className="border-l-4 border-orange-500 bg-orange-100 p-4 text-orange-700"
                >
                  <p> No staff checked in</p>
                </div>
              ) : (
                <div className="text-sm">
                  {queueInviteInfo.staffList.map((ta) => (
                    <StatusCard
                      key={ta.id}
                      courseId={queueInviteInfo.courseId}
                      queueId={queueInviteInfo.queueId}
                      ta={ta}
                      helpedAt={ta.questionHelpedAt}
                      isForPublic
                    />
                  ))}
                </div>
              )}
            </div>
            {projectorModeEnabled && queueInviteInfo.QRCodeEnabled && (
              <div className="mb-4 flex flex-col items-center justify-center gap-y-1 md:mt-40">
                <div className="font-bold">Scan to join queue:</div>
                <Tooltip title="Click this to print it">
                  <QRCode
                    errorLevel={queueInviteInfo.QRCodeErrorLevel}
                    value={inviteURL}
                    icon="/helpme_logo_small.png"
                    onClick={() =>
                      printQRCode(
                        queueInviteInfo.courseName,
                        inviteURL,
                        queueInviteInfo.QRCodeErrorLevel,
                        queueInviteInfo.room,
                      )
                    }
                    size={300}
                  />
                </Tooltip>
              </div>
            )}
            {/* only show this switch on desktop */}
            <div className="group relative mb-0 ml-auto mr-auto mt-auto hidden md:block">
              <Switch
                style={{
                  backgroundColor: projectorModeEnabled
                    ? 'rgba(0, 0, 0, 0.20)'
                    : 'rgb(54 132 196)',
                }}
                className={cn(
                  'max-w-40',
                  projectorModeEnabled
                    ? ' opacity-0 transition-opacity duration-300 group-hover:opacity-100'
                    : '', // make it fade out when not hovered once projector mode is enabled
                )}
                checkedChildren=""
                unCheckedChildren={
                  queueInviteInfo.QRCodeEnabled
                    ? 'Show QR Code'
                    : 'Toggle Projector Mode'
                }
                onChange={(checked) => setProjectorModeEnabled(checked)}
              />
            </div>
          </div>
          {queueInviteInfo.isQuestionsVisible && (
            <div className="w-full md:flex md:flex-grow md:flex-col md:pt-5">
              <div className="mb-1 flex items-center justify-between md:mb-0">
                <h2 className="mr-2">Questions</h2>
                {!(
                  queueConfig?.fifo_queue_view_enabled === false ||
                  queueConfig?.tag_groups_queue_view_enabled === false
                ) && (
                  <TagGroupSwitch
                    tagGroupsEnabled={tagGroupsEnabled}
                    setTagGroupsEnabled={setTagGroupsEnabled}
                  />
                )}
              </div>
              <Divider className="-mx-2 my-2 hidden w-[calc(100%+1rem)] border-[#cfd6de] md:block" />
              <div className="flex flex-col items-center justify-between">
                {!queueQuestions ? (
                  <div className="text-md font-medium text-gray-700">
                    There was an error getting questions
                  </div>
                ) : (!queueQuestions.questions &&
                    !queueQuestions.questionsGettingHelp) ||
                  (queueQuestions.questions.length === 0 &&
                    queueQuestions.questionsGettingHelp.length === 0) ? (
                  <div className="text-md font-medium text-gray-600">
                    The queue is empty!
                  </div>
                ) : tagGroupsEnabled ? (
                  <Collapse
                    className="w-full border-none"
                    defaultActiveKey={[
                      ...Object.keys(queueConfig?.tags || {}),
                      ...Object.keys(taskTree),
                    ]} // open all task groups by default
                  >
                    {/* tasks (for demos/TaskQuestions) */}
                    {taskTree &&
                      Object.entries(taskTree).map(([taskKey, task]) => {
                        const filteredQuestions =
                          queueQuestions.questions.filter(
                            (question: Question) => {
                              const tasks = question.isTaskQuestion
                                ? parseTaskIdsFromQuestionText(question.text)
                                : []
                              return (
                                question.isTaskQuestion &&
                                tasks.includes(taskKey)
                              )
                            },
                          )
                        return (
                          filteredQuestions && (
                            <Panel
                              className="tag-group mb-3 rounded bg-white shadow-lg"
                              key={taskKey}
                              header={
                                <div className="flex justify-between">
                                  <div>
                                    <QuestionTagElement
                                      tagName={task.display_name}
                                      tagColor={task.color_hex}
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
                                  </div>
                                </div>
                              }
                            >
                              {filteredQuestions.map((question: Question) =>
                                renderQuestion(question),
                              )}
                            </Panel>
                          )
                        )
                      })}
                    {isDemoQueue && (
                      <Divider
                        className="my-2 border-[#cfd6de] md:-mx-2 md:w-[calc(100%+1rem)]"
                        key="DIVIDER"
                      />
                    )}
                    {/* questionTypes/tags (for regular questions) */}
                    {queueConfig &&
                      queueConfig.tags &&
                      Object.entries(queueConfig.tags).map(([tagId, tag]) => {
                        // naming this "tags" to make some code slightly easier to follow
                        const filteredQuestions =
                          queueQuestions.questions.filter(
                            (question: Question) =>
                              question.questionTypes?.some(
                                (questionType) =>
                                  questionType.name === tag.display_name,
                              ),
                          )
                        return (
                          filteredQuestions && (
                            <Panel
                              className="tag-group mb-3 rounded bg-white shadow-lg"
                              key={tagId}
                              header={
                                <div className="flex justify-between">
                                  <div>
                                    <QuestionTagElement
                                      tagName={tag.display_name}
                                      tagColor={tag.color_hex}
                                    />
                                    <span className=" ml-2 text-gray-700">
                                      {filteredQuestions.length > 1
                                        ? `${filteredQuestions.length} Students`
                                        : filteredQuestions.length == 1
                                          ? `${filteredQuestions.length} Student`
                                          : ''}
                                    </span>
                                  </div>
                                </div>
                              }
                            >
                              {filteredQuestions.map((question: Question) =>
                                renderQuestion(question),
                              )}
                            </Panel>
                          )
                        )
                      })}
                  </Collapse>
                ) : (
                  <>
                    {queueQuestions.questionsGettingHelp.map(
                      (question: Question) => {
                        return (
                          <QuestionCardSimple
                            key={question.id}
                            question={question}
                            configTasks={configTasks}
                            isBeingHelped={
                              question.status === OpenQuestionStatus.Helping
                            }
                            isPaused={
                              question.status === OpenQuestionStatus.Paused
                            }
                            isBeingReQueued={
                              question.status === LimboQuestionStatus.ReQueueing
                            }
                          />
                        )
                      },
                    )}
                    {queueQuestions.questions.map((question: Question) =>
                      renderQuestion(question),
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        {/* Keeping this is a bit of an edge use case, since it would be rare that you would want to show the QR code via mobile, but maybe there's a case for it */}
        {queueInviteInfo.QRCodeEnabled && (
          <Switch
            className="mb-0 mt-auto md:hidden" // only show on mobile
            checkedChildren="Hide QR Code"
            unCheckedChildren="Show QR Code"
            onChange={(checked) => setProjectorModeEnabled(checked)}
          />
        )}
      </StandardPageContainer>
    )
  }
}
