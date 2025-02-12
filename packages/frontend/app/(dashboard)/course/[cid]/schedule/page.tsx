'use client'
import { useUserInfo } from '@/app/contexts/userContext'
import { getRoleInCourse } from '@/app/utils/generalUtils'
import StudentSchedulePanel from './components/StudentSchedulePanel'
import TAFacultySchedulePanel from './components/TASchedulePanel'
import { Role } from '@koh/common'
import { useEffect } from 'react'
import { useChatbotContext } from '../components/chatbot/ChatbotProvider'
type SchedulePageProps = {
  params: { cid: string }
}

export default function SchedulePage({ params }: SchedulePageProps) {
  const cid = Number(params.cid)
  // chatbot
  const { setCid, setRenderSmallChatbot } = useChatbotContext()
  useEffect(() => {
    setCid(cid)
  }, [cid, setCid])
  useEffect(() => {
    setRenderSmallChatbot(true)
    return () => setRenderSmallChatbot(false) // make the chatbot inactive when the user leaves the page
  }, [setRenderSmallChatbot])

  const { userInfo } = useUserInfo()
  const role = getRoleInCourse(userInfo, cid)
  return (
    <div className="mb-5 mt-8">
      {role === Role.PROFESSOR ? (
        <TAFacultySchedulePanel courseId={cid} />
      ) : (
        <StudentSchedulePanel courseId={cid} />
      )}
    </div>
  )
}
