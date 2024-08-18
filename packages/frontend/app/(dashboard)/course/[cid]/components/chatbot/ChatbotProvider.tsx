'use client'
/* eslint-disable @typescript-eslint/no-empty-function */
import { createContext, ReactNode, useContext, useState } from 'react'
import Chatbot from './Chatbot'

interface ChatbotContextType {
  setCid: (cid: number) => void
  setActive: (active: boolean) => void
}

const chatbotContext = createContext<ChatbotContextType>({
  setCid: () => {},
  setActive: () => {},
})
export function useChatbotContext() {
  return useContext(chatbotContext)
}
interface ChatbotContextProviderProps {
  children: ReactNode
}

const ChatbotContextProvider: React.FC<ChatbotContextProviderProps> = ({
  children,
}) => {
  const [cid, setCid] = useState<number | null>(null)
  const [active, setActive] = useState(false)

  const values = { setCid, setActive }
  return (
    <chatbotContext.Provider value={values}>
      {children}
      {active && cid && <Chatbot cid={cid} />}
    </chatbotContext.Provider>
  )
}
export default ChatbotContextProvider
