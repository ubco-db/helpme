'use client'
import React, { useEffect } from 'react'
import { useChatbotContext } from '../course/[cid]/components/chatbot/ChatbotProvider'

type AddChatbotProps = {
  courseId: number
  children?: React.ReactNode
}

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
