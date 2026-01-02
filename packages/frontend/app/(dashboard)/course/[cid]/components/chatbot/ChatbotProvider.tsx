'use client'

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'
import Chatbot from './Chatbot'
import {
  ChatbotQuestionType,
  chatbotStartingMessageCourse,
} from '@/app/typings/chatbot'
import { HelpMeChatMessage, SuggestedQuestionResponse } from '@koh/common'

interface ChatbotContextType {
  setCid: React.Dispatch<React.SetStateAction<number | null>>
  renderSmallChatbot: boolean
  setRenderSmallChatbot: React.Dispatch<React.SetStateAction<boolean>>
  suggestedQuestions: SuggestedQuestionResponse[]
  setSuggestedQuestions: React.Dispatch<
    React.SetStateAction<SuggestedQuestionResponse[]>
  >
  questionsLeft: number
  setQuestionsLeft: React.Dispatch<React.SetStateAction<number>>
  messages: HelpMeChatMessage[]
  setMessages: React.Dispatch<React.SetStateAction<HelpMeChatMessage[]>>
  isOpen: boolean
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  interactionId: number | undefined
  setInteractionId: React.Dispatch<React.SetStateAction<number | undefined>>
  helpmeQuestionId: number | undefined
  setHelpmeQuestionId: React.Dispatch<React.SetStateAction<number | undefined>>
  chatbotQuestionType: ChatbotQuestionType
  setChatbotQuestionType: React.Dispatch<
    React.SetStateAction<ChatbotQuestionType>
  >
}

const chatbotContext = createContext<ChatbotContextType>({
  setCid: () => {},
  renderSmallChatbot: false,
  setRenderSmallChatbot: () => {},
  suggestedQuestions: [],
  setSuggestedQuestions: () => {},
  questionsLeft: 0,
  setQuestionsLeft: () => {},
  messages: [
    {
      type: 'apiMessage',
      message: chatbotStartingMessageCourse,
    },
  ],
  setMessages: () => {},
  isOpen: false,
  setIsOpen: () => {},
  interactionId: undefined,
  setInteractionId: () => {},
  helpmeQuestionId: undefined,
  setHelpmeQuestionId: () => {},
  chatbotQuestionType: 'Course',
  setChatbotQuestionType: () => {},
})
export function useChatbotContext() {
  return useContext(chatbotContext)
}
interface ChatbotContextProviderProps {
  children: ReactNode
}

/**
 * This provider will display the chatbot button on the page.
 * It also exports all of the state to allow you to put another Chatbot component outside this provider.
 * This is done so that the all Chatbot components share the same messages (so it the history won't be different between the components)
 * IMPORTANT: Any new Chatbot state that you do NOT want to be reset, put it here instead of inside the Chatbot component.
 */
const ChatbotContextProvider: React.FC<ChatbotContextProviderProps> = ({
  children,
}) => {
  const [cid, setCid] = useState<number | null>(null)
  const [renderSmallChatbot, setRenderSmallChatbot] = useState(false)

  // Chatbot states
  const [suggestedQuestions, setSuggestedQuestions] = useState<
    SuggestedQuestionResponse[]
  >([])
  const [questionsLeft, setQuestionsLeft] = useState<number>(0)
  const [messages, setMessages] = useState<HelpMeChatMessage[]>([
    {
      type: 'apiMessage',
      message: chatbotStartingMessageCourse,
    },
  ])
  const [isOpen, setIsOpen] = useState(false)
  const [interactionId, setInteractionId] = useState<number | undefined>(
    undefined,
  )
  const [helpmeQuestionId, setHelpmeQuestionId] = useState<number | undefined>(
    undefined,
  )
  const [chatbotQuestionType, setChatbotQuestionType] =
    useState<ChatbotQuestionType>('Course')
  useEffect(() => {
    // reset chatbot states when course changes
    setSuggestedQuestions([])
    setMessages([
      {
        type: 'apiMessage',
        message: chatbotStartingMessageCourse,
      },
    ])
    setInteractionId(undefined)
    setHelpmeQuestionId(undefined)
    setIsOpen(false)
    setChatbotQuestionType('Course')
  }, [cid])

  const values = {
    setCid,
    renderSmallChatbot,
    setRenderSmallChatbot,
    suggestedQuestions,
    setSuggestedQuestions,
    questionsLeft,
    setQuestionsLeft,
    messages,
    setMessages,
    isOpen,
    setIsOpen,
    interactionId,
    setInteractionId,
    helpmeQuestionId,
    setHelpmeQuestionId,
    chatbotQuestionType,
    setChatbotQuestionType,
  }
  return (
    <chatbotContext.Provider value={values}>
      {children}
      {renderSmallChatbot && cid && (
        <Chatbot
          key={cid}
          cid={cid}
          variant="small"
          suggestedQuestions={suggestedQuestions}
          setSuggestedQuestions={setSuggestedQuestions}
          questionsLeft={questionsLeft}
          setQuestionsLeft={setQuestionsLeft}
          messages={messages}
          setMessages={setMessages}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          interactionId={interactionId}
          setInteractionId={setInteractionId}
          helpmeQuestionId={helpmeQuestionId}
          setHelpmeQuestionId={setHelpmeQuestionId}
          chatbotQuestionType={chatbotQuestionType}
          setChatbotQuestionType={setChatbotQuestionType}
        />
      )}
    </chatbotContext.Provider>
  )
}
export default ChatbotContextProvider
