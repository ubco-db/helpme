import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { ReactElement, useEffect } from 'react'
import styled from 'styled-components'
import { StandardPageContainer } from '../../../../components/common/PageContainer'
import NavBar from '../../../../components/Nav/NavBar'
import { useQueue } from '../../../../hooks/useQueue'
import { useChatbotContext } from '../../../../providers/chatbotProvider'
import QueuePage from '../../../../components/Questions/Queue/Queue'
import { useProfile } from '../../../../hooks/useProfile'

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`

export default function Queue(): ReactElement {
  const { setCid, setOpen } = useChatbotContext()
  const router = useRouter()
  const { cid, qid } = router.query
  const { queue } = useQueue(Number(qid))
  const profile = useProfile()
  useEffect(() => {
    setOpen(true)
    return () => setOpen(false)
  }, [setOpen])

  useEffect(() => {
    setCid(cid)
  }, [cid, setCid])

  return (
    <StandardPageContainer>
      <Container>
        <Head>
          <title>
            {queue?.room} Queue | {profile?.organization?.organizationName}{' '}
            HelpMe
          </title>
        </Head>
        {/* accessiblity thing that lets users skip tabbing through the navbar */}
        <a href={`#join-queue-button`} className="skip-link">
          Skip to main content
        </a>
        <NavBar courseId={Number(cid)} />
        <QueuePage qid={Number(qid)} cid={Number(cid)} />
      </Container>
    </StandardPageContainer>
  )
}
