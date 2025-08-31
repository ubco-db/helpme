'use client'

import { ReactElement, useEffect, useMemo } from 'react'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useChatbotContext } from '@/app/(dashboard)/course/[cid]/components/chatbot/ChatbotProvider'
import Chatbot from '@/app/(dashboard)/course/[cid]/components/chatbot/Chatbot'
import { useLtiCourse } from '@/app/contexts/LtiCourseContext'
import { useLtiContext } from '@/app/contexts/LtiContext'
import { API } from '@/app/api'

export default function LtiCoursePage(): ReactElement {
  const { authToken } = useLtiContext()
  const customAPI = useMemo(() => API.withAuthorization(authToken), [authToken])

  const { courseId, course, courseFeatures } = useLtiCourse()

  // chatbot
  const {
    setCid,
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
    setCid(courseId)
  }, [courseId, setCid])

  if (!course || !courseFeatures) {
    return <CenteredSpinner tip="Loading Course Data..." />
  } else {
    return (
      <>
        <title>{`HelpMe | ${course.name}`}</title>
        {courseFeatures?.chatBotEnabled ? (
          <div className="mt-3 flex h-[100vh] flex-col items-center justify-items-end">
            <Chatbot
              key={courseId}
              cid={courseId}
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
              API={customAPI}
            />
          </div>
        ) : (
          <div className="mt-3 flex h-[100vh] flex-col items-center justify-items-end">
            Course chatbot is disabled
          </div>
        )}
      </>
    )
  }
}
