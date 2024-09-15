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
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import {
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
import { createRoot } from 'react-dom/client'
import { useQuestionsWithQueueInvite } from '@/app/hooks/useQuestionsWithQueueInvite'
import { useQueueWithQueueInvite } from '@/app/hooks/useQueueWithQueueInvite'
import QuestionCardSimple from './components/QuestionCardSimple'
import TagGroupSwitch from '@/app/(dashboard)/course/[cid]/queue/[qid]/components/TagGroupSwitch'
import { QuestionTagElement } from '@/app/(dashboard)/course/[cid]/components/QuestionTagElement'

const Panel = Collapse.Panel

type QueueInvitePageProps = {
  params: { qid: string }
}
/**
 * NOTE: This is the QUEUE INVITES page.
 * The reason the folder is called `qi` is to shorten the URL so the QR code is easier to scan.
 */
export default function QueueInvitePage({
  params,
}: QueueInvitePageProps): ReactElement {
  const qid = Number(params.qid)
  const searchParams = useSearchParams()
  const router = useRouter()
  const code = decodeURIComponent(searchParams.get('c') ?? '')
  const [projectorModeEnabled, setProjectorModeEnabled] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [hasFetchErrorOccurred, setHasFetchErrorOccurred] = useState(false)
  const [queueInviteInfo, setQueueInviteInfo] =
    useState<PublicQueueInvite | null>(null)
  const [profile, setProfile] = useState<User>()
  const [hasGettingUserBeenResolved, setHasGettingUserBeenResolved] =
    useState(false) // don't let the users hit the join button before we find out if they're logged in or not
  const [isJoinButtonLoading, setIsJoinButtonLoading] = useState(false)
  // NOTE: queueQuestions and queue are ONLY set if the queue invite code is correct and if the questions are visible
  const { queueQuestions } = useQuestionsWithQueueInvite(
    qid,
    code,
    queueInviteInfo?.isQuestionsVisible,
  )
  const { queue } = useQueueWithQueueInvite(
    qid,
    code,
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
      const userDetails = await userApi.getUser()
      const response = await userDetails.json()
      if (!(response.statusCode >= 400)) {
        setProfile(response)
      }
      setHasGettingUserBeenResolved(true)
    }
    fetchUserDetails()
  }, [setProfile, setHasGettingUserBeenResolved])

  const isHttps =
    (typeof window !== 'undefined' && window.location.protocol) === 'https:'
  const baseURL =
    typeof window !== 'undefined'
      ? `${isHttps ? 'https' : 'http'}://${window.location.host}`
      : ''
  const inviteURL = queueInviteInfo
    ? `${baseURL}/qi/${queueInviteInfo.queueId}?c=${encodeURIComponent(queueInviteInfo.inviteCode)}`
    : ''

  const fetchPublicQueueInviteInfo = useCallback(async () => {
    try {
      const queueInviteInfo = await API.queueInvites.get(qid, code)
      setQueueInviteInfo(queueInviteInfo)
    } catch (error) {
      setHasFetchErrorOccurred(true)
    } finally {
      setPageLoading(false)
    }
  }, [qid, code])

  useEffect(() => {
    fetchPublicQueueInviteInfo()
  }, [fetchPublicQueueInviteInfo])

  // if the user is already logged in, is a student, and is in the course, redirect them to the queue page
  // The reason why it's only students is so that professors can easily show this page (to show the QR code)
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
      router.push(
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
    } else if (profile && queueInviteInfo.willInviteToCourse) {
      // if the user is already logged in but not in the course (and willInviteToCourse is enabled), enroll them in the course
      setIsJoinButtonLoading(true)
      const userData: UBCOuserParam = {
        email: profile.email,
        selected_course: queueInviteInfo.courseId,
        organizationId: queueInviteInfo.orgId,
      }
      await API.course
        .enrollByInviteCode(userData, code)
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
  }, [code, queueInviteInfo, router, profile])

  const handlePrintQRCode = useCallback(() => {
    if (!queueInviteInfo) {
      message.error('Queue invite info not loaded. Please try again')
      return
    }
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>HelpMe | ${queueInviteInfo.room} QR Code (${queueInviteInfo.courseName})</title>
            <style>
              body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;  }
              h1 { text-align: center; }
              .qrcode { display: flex; justify-content: center; flex-direction: column; align-items: center; }
            </style>
          </head>
          <body>
            <div class="qrcode">
              <h1>Scan to join ${queueInviteInfo.room} for ${queueInviteInfo.courseName}</h1>
              <div id="qrcode"></div>
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()

      const qrCodeContainer = printWindow.document.getElementById('qrcode')
      if (qrCodeContainer) {
        const qrCodeElement = (
          <QRCode
            errorLevel={queueInviteInfo.QRCodeErrorLevel}
            value={inviteURL}
            icon="/helpme_logo_small.png"
            size={400}
          />
        )
        const root = createRoot(qrCodeContainer)
        root.render(qrCodeElement)
      }

      printWindow.print()
    }
  }, [queueInviteInfo, inviteURL])

  useEffect(() => {
    // only re-calculate the taskTree and everything if tagGroups is enabled
    if (tagGroupsEnabled) {
      const configTasksCopy = {
        ...configTasks,
      } // Create a copy of configTasks (since the function will mutate it)
      setTaskTree(transformIntoTaskTree(configTasksCopy)) // transformIntoTaskTree changes each precondition to carry a reference to the actual task object instead of just a string
    }
  }, [tagGroupsEnabled, configTasks])

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
        <div className="flex min-h-full w-full flex-col md:flex-row md:gap-x-4">
          <div className="flex min-h-screen w-full flex-col gap-y-4 border-r-2 border-[#cfd6de] pr-4 md:w-[30rem] md:pt-5">
            <h1>
              {queueInviteInfo.room} | {queueInviteInfo.courseName}
            </h1>
            {queueInviteInfo.queueSize === 0 ? (
              <p>The queue is empty!</p>
            ) : (
              <p>
                There are currently{' '}
                <span className="font-bold">{queueInviteInfo.queueSize}</span>{' '}
                students in the queue.
              </p>
            )}
            {!projectorModeEnabled && (
              <Button
                type="primary"
                className="w-full"
                size="large"
                loading={!hasGettingUserBeenResolved || isJoinButtonLoading}
                disabled={!hasGettingUserBeenResolved}
                onClick={JoinQueueButtonClick}
              >
                Join Queue
              </Button>
            )}
            <div>
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
                      taName={ta.name}
                      taPhotoURL={ta.photoURL}
                      helpedAt={ta.questionHelpedAt}
                    />
                  ))}
                </div>
              )}
            </div>
            {projectorModeEnabled && (
              <div className="mb-4 mt-40 flex flex-col items-center justify-center gap-y-1">
                <div className="font-bold">Scan to join queue:</div>
                <Tooltip title="Click this to print it">
                  <QRCode
                    errorLevel={queueInviteInfo.QRCodeErrorLevel}
                    value={inviteURL}
                    icon="/helpme_logo_small.png"
                    onClick={handlePrintQRCode}
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
              <div className="flex items-center justify-between">
                <h2 className="mr-2">Questions</h2>
                {!(
                  queueConfig?.fifo_queue_view_enabled === false ||
                  queueConfig?.tag_groups_queue_view_enabled === false
                ) && (
                  <TagGroupSwitch
                    tagGroupsEnabled={tagGroupsEnabled}
                    setTagGroupsEnabled={setTagGroupsEnabled}
                    mobile={false}
                  />
                )}
              </div>
              <Divider className="-mx-2 my-2 w-[calc(100%+1rem)] border-[#cfd6de]" />
              <div className="flex flex-col items-center justify-between">
                {!queueQuestions ? (
                  <div className="text-md font-medium text-gray-700">
                    There was an error getting questions
                  </div>
                ) : !queueQuestions.questions ||
                  queueQuestions.questions?.length === 0 ? (
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
                              {filteredQuestions.map((question: Question) => {
                                return (
                                  <QuestionCardSimple
                                    key={question.id}
                                    question={question}
                                    configTasks={configTasks}
                                  />
                                )
                              })}
                            </Panel>
                          )
                        )
                      })}
                    {isDemoQueue && (
                      <Divider
                        className="-mx-2 my-2 w-[calc(100%+1rem)] border-[#cfd6de]"
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
                              {filteredQuestions.map((question: Question) => {
                                return (
                                  <QuestionCardSimple
                                    key={question.id}
                                    question={question}
                                    configTasks={configTasks}
                                  />
                                )
                              })}
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
                            isBeingHelped={true}
                          />
                        )
                      },
                    )}
                    {queueQuestions.questions.map((question: Question) => {
                      return (
                        <QuestionCardSimple
                          key={question.id}
                          question={question}
                          configTasks={configTasks}
                        />
                      )
                    })}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <Switch
          className="mb-0 mt-auto md:hidden" // only show on mobile
          checkedChildren=""
          unCheckedChildren={
            queueInviteInfo.QRCodeEnabled
              ? 'Show QR Code'
              : 'Toggle Projector Mode'
          }
          onChange={(checked) => setProjectorModeEnabled(checked)}
        />
      </StandardPageContainer>
    )
  }
}
