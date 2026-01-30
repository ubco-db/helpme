'use client'

import { QUERY_PARAMS, Role } from '@koh/common'
import { Col, Row, Button, Alert } from 'antd'
import { ReactElement, useEffect, useMemo, useState, use } from 'react'
import QueueCard from './components/QueueCard'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import { useUserInfo } from '@/app/contexts/userContext'
import { getRoleInCourse } from '@/app/utils/generalUtils'
import { useCourse } from '@/app/hooks/useCourse'
import CreateQueueModal from './components/CreateQueueModal'
import AsyncCentreCard from './components/AsyncCentreCard'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import CoursePageCheckInButton from './components/CoursePageCheckInButton'
import PopularTimes from './components/popularTimes/PopularTimes'
import { arrayRotate, collapseHeatmap } from './utils/popularTimesFunctions'
import moment from 'moment'
import { sortQueues } from './utils/commonCourseFunctions'
import TAFacultySchedulePanel from './schedule/components/TASchedulePanel'
import StudentSchedulePanel from './schedule/components/StudentSchedulePanel'
import { useChatbotContext } from './components/chatbot/ChatbotProvider'
import Chatbot from './components/chatbot/Chatbot'
import { useSearchParams } from 'next/navigation'

type CoursePageProps = {
  params: Promise<{ cid: string }>
}

export default function CoursePage(props: CoursePageProps): ReactElement {
  const params = use(props.params)
  const cid = Number(params.cid)
  const { userInfo } = useUserInfo()
  const role = getRoleInCourse(userInfo, cid)
  const { course } = useCourse(cid)
  const searchParams = useSearchParams()
  const queryParamNotice = searchParams.get('notice')
  const [createQueueModalOpen, setCreateQueueModalOpen] = useState(false)
  const courseFeatures = useCourseFeatures(cid)
  const onlyChatBotEnabled = useMemo(
    () =>
      courseFeatures?.chatBotEnabled &&
      !courseFeatures?.queueEnabled &&
      !courseFeatures?.asyncQueueEnabled,
    [courseFeatures],
  )
  // chatbot
  const {
    setCid,
    setRenderSmallChatbot,
    preDeterminedQuestions,
    setPreDeterminedQuestions,
    questionsLeft,
    setQuestionsLeft,
    messages,
    setMessages,
    interactionId,
    setInteractionId,
    helpmeQuestionId,
    setHelpmeQuestionId,
    chatbotQuestionType,
    setChatbotQuestionType,
  } = useChatbotContext()
  useEffect(() => {
    setCid(cid)
  }, [cid, setCid])
  useEffect(() => {
    const shouldRenderSmallChatbot =
      courseFeatures?.queueEnabled &&
      courseFeatures?.chatBotEnabled &&
      courseFeatures?.scheduleOnFrontPage
    setRenderSmallChatbot(!!shouldRenderSmallChatbot)
  }, [courseFeatures, setRenderSmallChatbot])

  const sortedQueues = useMemo(() => {
    if (!course?.queues) return []
    return sortQueues(course.queues)
  }, [course?.queues])

  const skipLinkTarget: 'first-queue' | 'async-centre' | 'chatbot-input' | '' =
    useMemo(() => {
      if (courseFeatures?.queueEnabled) {
        return 'first-queue'
      } else if (courseFeatures?.asyncQueueEnabled) {
        return 'async-centre'
      } else if (courseFeatures?.chatBotEnabled) {
        return 'chatbot-input'
      }
      return ''
    }, [courseFeatures])

  if (!course || !courseFeatures) {
    return <CenteredSpinner tip="Loading Course Data..." />
  } else {
    return (
      <>
        <title>{`HelpMe | ${course.name}`}</title>
        {(!onlyChatBotEnabled && (
          <div className="mt-1 md:mt-8">
            <Row gutter={64} className="!mx-0 md:!mx-2 lg:!mx-4 xl:!mx-8">
              <Col
                className="mb-4 !px-0 md:!px-2 lg:!px-4 xl:!px-8"
                md={12}
                xs={24}
              >
                <Row>
                  {queryParamNotice && (
                    <Alert
                      message={(() => {
                        switch (queryParamNotice) {
                          case QUERY_PARAMS.profInvite.notice
                            .adminAlreadyInCourse:
                            return 'You (admin) are already in this course. Professor invite not consumed and still working'
                          case QUERY_PARAMS.profInvite.notice
                            .adminAcceptedInviteNotConsumed:
                            return `Professor invite successfully accepted! You are now a professor inside this course. Since you are an admin, the professor invite was not consumed and still working`
                          case QUERY_PARAMS.profInvite.notice.inviteAccepted: // TODO: Start the tutorial from here
                            return (
                              <div className="flex flex-col items-center">
                                <p>
                                  Professor invite successfully accepted!
                                  Welcome to your course!
                                </p>
                                <p>
                                  You can find a list of video tutorials here:
                                </p>
                                <ul className="flex list-disc gap-4 gap-x-6">
                                  <li>
                                    <a
                                      href="https://www.youtube.com/watch?v=H9ywkvDdeZ0"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      HelpMe Overview
                                    </a>
                                  </li>
                                  <li>
                                    <a
                                      href="https://www.youtube.com/watch?v=Y8v8HfEpkqo"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Chatbot Configuration Tutorial
                                    </a>
                                  </li>
                                </ul>
                              </div>
                            )
                          default:
                            return queryParamNotice
                        }
                      })()}
                      type="info"
                      className="mb-1 w-full"
                      showIcon
                      closable
                    />
                  )}
                </Row>
                <Row justify="space-between">
                  <h1 className="overflow-hidden whitespace-nowrap text-2xl font-semibold text-[#212934] md:text-3xl">
                    {course?.name} Help Centre
                  </h1>
                  {courseFeatures.queueEnabled && (
                    <CoursePageCheckInButton courseId={cid} />
                  )}
                </Row>
                <Row>
                  <div>
                    <i>
                      You are a{' '}
                      <span className="text-helpmeblue font-bold">
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </span>{' '}
                      for this course
                    </i>
                  </div>
                </Row>
                {courseFeatures.queueEnabled &&
                  sortedQueues?.map((q) => (
                    <QueueCard
                      cid={cid}
                      linkId={
                        skipLinkTarget == 'first-queue' &&
                        q.id === sortedQueues[0].id
                          ? 'skip-link-target'
                          : ''
                      }
                      key={q.id}
                      queue={q}
                      isStaff={role === Role.TA || role === Role.PROFESSOR}
                    />
                  ))}

                {courseFeatures.asyncQueueEnabled && (
                  <AsyncCentreCard
                    cid={cid}
                    linkId={
                      skipLinkTarget == 'async-centre' ? 'skip-link-target' : ''
                    }
                  />
                )}

                {role === Role.TA ||
                  (role === Role.PROFESSOR && courseFeatures.queueEnabled && (
                    <Row>
                      <Button
                        type="primary"
                        className="mx-auto rounded-md px-4 py-1 font-semibold"
                        onClick={() => setCreateQueueModalOpen(true)}
                      >
                        + Create Queue
                      </Button>
                    </Row>
                  ))}

                {role === Role.TA ||
                  (role === Role.PROFESSOR && (
                    <CreateQueueModal
                      cid={cid}
                      open={createQueueModalOpen}
                      onSuccessfulSubmit={() => setCreateQueueModalOpen(false)}
                      onCancel={() => setCreateQueueModalOpen(false)}
                      role={role}
                    />
                  ))}
                {
                  // This only works with UTC offsets in the form N:00, to help with other offsets, the size of the array might have to change to a size of 24*7*4 (for every 15 min interval)
                  course && course.heatmap && courseFeatures.queueEnabled && (
                    <PopularTimes
                      heatmap={collapseHeatmap(
                        arrayRotate(
                          course.heatmap,
                          -Math.floor(moment().utcOffset() / 15),
                        ),
                      )}
                    />
                  )
                }
              </Col>
              <Col
                className="mb-4 h-[100vh] !px-0 md:!px-2 lg:!px-4 xl:!px-8"
                md={12}
                sm={24}
              >
                {courseFeatures.queueEnabled &&
                (!courseFeatures.chatBotEnabled ||
                  courseFeatures.scheduleOnFrontPage) ? (
                  <>
                    {role === Role.PROFESSOR ? (
                      <TAFacultySchedulePanel courseId={cid} condensed={true} />
                    ) : (
                      <StudentSchedulePanel courseId={cid} />
                    )}
                  </>
                ) : (
                  courseFeatures.chatBotEnabled && (
                    <Chatbot
                      key={cid}
                      cid={cid}
                      variant="big"
                      preDeterminedQuestions={preDeterminedQuestions}
                      setPreDeterminedQuestions={setPreDeterminedQuestions}
                      questionsLeft={questionsLeft}
                      setQuestionsLeft={setQuestionsLeft}
                      messages={messages}
                      setMessages={setMessages}
                      isOpen={true}
                      setIsOpen={() => undefined}
                      interactionId={interactionId}
                      setInteractionId={setInteractionId}
                      setHelpmeQuestionId={setHelpmeQuestionId}
                      helpmeQuestionId={helpmeQuestionId}
                      chatbotQuestionType={chatbotQuestionType}
                      setChatbotQuestionType={setChatbotQuestionType}
                    />
                  )
                )}
              </Col>
            </Row>
          </div>
        )) || (
          // only show if only the chatbot is enabled
          <div className="mt-3 flex h-[100vh] flex-col items-center justify-items-end">
            <Chatbot
              key={cid}
              cid={cid}
              variant="huge"
              preDeterminedQuestions={preDeterminedQuestions}
              setPreDeterminedQuestions={setPreDeterminedQuestions}
              questionsLeft={questionsLeft}
              setQuestionsLeft={setQuestionsLeft}
              messages={messages}
              setMessages={setMessages}
              isOpen={true}
              interactionId={interactionId}
              setInteractionId={setInteractionId}
              setHelpmeQuestionId={setHelpmeQuestionId}
              helpmeQuestionId={helpmeQuestionId}
              chatbotQuestionType={chatbotQuestionType}
              setChatbotQuestionType={setChatbotQuestionType}
              setIsOpen={() => {}}
            />
          </div>
        )}
      </>
    )
  }
}
