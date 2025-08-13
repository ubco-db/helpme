'use client'

import { ReactElement, use, useEffect } from 'react'
import AddChatbot from '@/app/(dashboard)/components/AddChatbot'
import { useChatbotContext } from '@/app/(dashboard)/course/[cid]/components/chatbot/ChatbotProvider'
import Chatbot from '@/app/(dashboard)/course/[cid]/components/chatbot/Chatbot'

type CoursePageProps = {
  params: Promise<{ cid: string }>
}

export default function LTICoursePage(props: CoursePageProps): ReactElement {
  const params = use(props.params)
  const cid = Number(params.cid)

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

  return (
    <>
      <AddChatbot courseId={cid}>
        {/*{courseFeatures.chatBotEnabled && (*/}
        {true && (
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
        )}
      </AddChatbot>
    </>
  )
}
