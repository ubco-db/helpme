import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { ReactElement } from 'react'
import styled from 'styled-components'
import { StandardPageContainer } from '../../../components/common/PageContainer'
import NavBar from '../../../components/Nav/NavBar'
import AsyncQuestionsPage from '../../../components/Questions/AsyncQuestions/AsyncQuestions'
import { Spin } from 'antd'
import { useProfile } from '../../../hooks/useProfile'
import { useCourse } from '../../../hooks/useCourse'

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`
export default function Queue(): ReactElement {
  const router = useRouter()
  const { cid } = router.query
  const profile = useProfile()
  const { course } = useCourse(Number(cid))

  if (!cid) {
    return <Spin tip="Loading..." size="large" />
  } else {
    return (
      <StandardPageContainer>
        <Container>
          <Head>
            <title>
              {course?.name} Async Question Centre |{' '}
              {profile?.organization?.organizationName} HelpMe
            </title>
          </Head>
          {/* accessiblity thing that lets users skip tabbing through the navbar */}
          <a href={`#post-question-button`} className="skip-link">
            Skip to main content
          </a>
          <NavBar courseId={Number(cid)} />
          <AsyncQuestionsPage courseId={Number(cid)} />
        </Container>
      </StandardPageContainer>
    )
  }
}
