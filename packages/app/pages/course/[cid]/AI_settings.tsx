import { Role } from '@koh/common'
import DefaultErrorPage from 'next/error'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { ReactElement } from 'react'
import { StandardPageContainer } from '../../../components/common/PageContainer'
import NavBar from '../../../components/Nav/NavBar'
import ChatbotSettingsPanel from '../../../components/ChatbotSettings/ChatbotSettingPanel'

import { useRoleInCourse } from '../../../hooks/useRoleInCourse'

export default function ChatbotSettingsPanelPage(): ReactElement {
  const router = useRouter()
  const courseId = router.query['cid']
  const role = useRoleInCourse(Number(courseId))

  if (role !== Role.PROFESSOR && role !== Role.TA) {
    return <DefaultErrorPage statusCode={404} />
  }

  return (
    <div>
      <StandardPageContainer>
        <Head>
          <title>Chatbot Settings Panel | UBC Office Hours</title>
        </Head>
        <NavBar courseId={Number(courseId)} />
        {courseId && <ChatbotSettingsPanel courseId={Number(courseId)} />}
      </StandardPageContainer>
    </div>
  )
}
