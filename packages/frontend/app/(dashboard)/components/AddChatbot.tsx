'use client'
import React, { useEffect } from 'react'
import { useChatbotContext } from '../course/[cid]/components/chatbot/ChatbotProvider'

type AddChatbotProps = {
  courseId: number
  children?: React.ReactNode
}

/** Adds the sticky chatbot "Chat Now!" button/modal to side of the page
 * Only added in a couple areas right now, will move to other areas and do refactoring in the future.
 * This is kinda a workaround to get this on layout.tsx (which is a server component)
 */
const AddChatbot: React.FC<AddChatbotProps> = ({ courseId, children }) => {
  // chatbot
  const { setCid, setRenderSmallChatbot } = useChatbotContext()
  useEffect(() => {
    setCid(courseId)
  }, [courseId, setCid])
  useEffect(() => {
    setRenderSmallChatbot(true)
    return () => setRenderSmallChatbot(false) // make the chatbot inactive when the user leaves the page
  }, [setRenderSmallChatbot])
  return children
}
export default AddChatbot
