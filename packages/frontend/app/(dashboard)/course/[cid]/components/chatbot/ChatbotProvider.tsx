'use client'
/* eslint-disable @typescript-eslint/no-empty-function */
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'
import Chatbot, { Message, PreDeterminedQuestion } from './Chatbot'

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
      message:
        'Hello, how can I assist you? I can help with anything course related.',
    },
  ],
  setMessages: () => {},
  isOpen: false,
  setIsOpen: () => {},
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
      message:
        'Hello, how can I assist you? I can help with anything course related.',
    },
  ])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // reset chatbot states when course changes
    setPreDeterminedQuestions([])
    setMessages([
      {
        type: 'apiMessage',
        message:
          'Hello, how can I assist you? I can help with anything course related.',
      },
    ])
    setIsOpen(false)
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
        />
      )}
    </chatbotContext.Provider>
  )
}
export default ChatbotContextProvider
