'use client'
/* eslint-disable @typescript-eslint/no-empty-function */
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'
import Chatbot from './Chatbot'
import {
  PreDeterminedQuestion,
  Message,
  chatbotStartingMessageCourse,
  ChatbotQuestionType,
} from '@/app/typings/chatbot'

interface ChatbotContextType {
  setCid: React.Dispatch<React.SetStateAction<number | null>>
  setRenderSmallChatbot: React.Dispatch<React.SetStateAction<boolean>>
  preDeterminedQuestions: PreDeterminedQuestion[]
  setPreDeterminedQuestions: React.Dispatch<
    React.SetStateAction<PreDeterminedQuestion[]>
  >
  questionsLeft: number
  setQuestionsLeft: React.Dispatch<React.SetStateAction<number>>
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
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
  setRenderSmallChatbot: () => {},
  preDeterminedQuestions: [],
  setPreDeterminedQuestions: () => {},
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
 * This provider will display the "Chat Now!" chatbot on the page.
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
  const [preDeterminedQuestions, setPreDeterminedQuestions] = useState<
    PreDeterminedQuestion[]
  >([])
  const [questionsLeft, setQuestionsLeft] = useState<number>(0)
  const [messages, setMessages] = useState<Message[]>([
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
    setPreDeterminedQuestions([])
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
    setRenderSmallChatbot,
    preDeterminedQuestions,
    setPreDeterminedQuestions,
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
          preDeterminedQuestions={preDeterminedQuestions}
          setPreDeterminedQuestions={setPreDeterminedQuestions}
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
