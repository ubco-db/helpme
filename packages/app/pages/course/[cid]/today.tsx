import { API } from '@koh/api-client'
import { Heatmap, QueuePartial, Role } from '@koh/common'
import { Col, Row, Spin, Button, message } from 'antd'
import { chunk, mean } from 'lodash'
import moment from 'moment'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { ReactElement, useState } from 'react'
import styled from 'styled-components'
import { StandardPageContainer } from '../../../components/common/PageContainer'
import NavBar from '../../../components/Nav/NavBar'
import QueueCard, {
  QueueCardSkeleton,
} from '../../../components/Today/QueueCard'
import TodayPageCheckinButton from '../../../components/Today/QueueCheckInButton'
import QueueCreateModal from '../../../components/Today/QueueCreateModal'
import { useCourse } from '../../../hooks/useCourse'
import PopularTimes from '../../../components/Today/PopularTimes/PopularTimes'
import AsyncQuestionCard from '../../../components/Questions/AsyncQuestions/AsyncQuestionCard'
import { orderBy } from 'lodash'
import { ChatbotToday } from '../../../components/Today/ChatbotToday'
import { useCourseFeatures } from '../../../hooks/useCourseFeatures'
import { useProfile } from '../../../hooks/useProfile'

const Container = styled.div`
  margin-top: 32px;
`

const Title = styled.div`
  font-weight: 500;
  font-size: 1.5em; /* Mobile devices */
  color: #212934;
  white-space: nowrap;
  overflow: hidden;

  @media (min-width: 768px) {
    font-size: 2em; /* Desktop devices */
  }
`

const TodayCol = styled(Col)`
  margin-bottom: 15px;
`

const RoleColorSpan = styled.span`
  color: #3684c6;
  font-weight: bold;
`

export const CreateQueueButton = styled(Button)`
  background: #1890ff;
  border-radius: 6px;
  color: white;
  font-weight: 500;
  font-size: 14px;
  margin: auto;
  padding: 0.25em 1em;
`

function roleToString(role: Role) {
  switch (role) {
    case Role.TA:
      return 'TA'
    case Role.STUDENT:
      return 'Student'
    case Role.PROFESSOR:
      return 'Professor'
    default:
      return ''
  }
}

function arrayRotate(arr, count) {
  const adjustedCount = (arr.length + count) % arr.length
  return arr
    .slice(adjustedCount, arr.length)
    .concat(arr.slice(0, adjustedCount))
}

const collapseHeatmap = (heatmap: Heatmap): Heatmap =>
  chunk(heatmap, 4).map((hours) => {
    const filteredOfficeHours = hours.filter((v) => v !== -1)
    return filteredOfficeHours.length > 0 ? mean(filteredOfficeHours) : -1
  })

export default function Today(): ReactElement {
  const router = useRouter()
  const { cid } = router.query
  const profile = useProfile()
  const role = profile?.courses.find((e) => e.course.id === Number(cid))?.role
  const { course, mutateCourse } = useCourse(Number(cid))
  const [createQueueModalVisible, setCreateQueueModalVisible] = useState(false)

  const courseFeatures = useCourseFeatures(Number(cid))

  const onlyChatBotEnabled =
    courseFeatures?.chatBotEnabled &&
    !courseFeatures?.queueEnabled &&
    !courseFeatures?.asyncQueueEnabled

  const sortByProfOrder = role == Role.PROFESSOR ? 'desc' : 'asc'
  const sortedQueues =
    course?.queues &&
    orderBy(
      course?.queues,
      ['isOpen', 'isProfessorQueue'],
      ['desc', sortByProfOrder],
    )

  const updateQueueNotes = async (
    queue: QueuePartial,
    notes: string,
  ): Promise<void> => {
    const newQueues =
      course &&
      course.queues.map((q) => (q.id === queue.id ? { ...q, notes } : q))

    mutateCourse({ ...course, queues: newQueues }, false)
    await API.queues.update(queue.id, {
      notes,
      allowQuestions: queue.allowQuestions,
    })
    mutateCourse()
  }

  const submitCreateQueue = async (submittedForm) => {
    const queueRequest = await submittedForm.validateFields()
    try {
      await API.queues.createQueue(
        Number(cid),
        queueRequest.officeHourName,
        !queueRequest.allowTA,
        queueRequest.notes,
        JSON.parse(queueRequest.config),
      )
      message.success(`Created a new queue ${queueRequest.officeHourName}`)
      mutateCourse()

      setCreateQueueModalVisible(false)
    } catch (err) {
      message.error(err.response?.data?.message)
    }
  }

  const firstContentItemId = courseFeatures?.queueEnabled
    ? 'first-queue'
    : courseFeatures?.asyncQueueEnabled
    ? 'async-centre'
    : courseFeatures?.chatBotEnabled
    ? 'chatbot-input'
    : ''

  if (!course || !courseFeatures) {
    return <Spin tip="Loading..." size="large" />
  } else {
    return (
      <StandardPageContainer>
        <Head>
          <title>{course?.name} | UBC Office Hours</title>
        </Head>

        {firstContentItemId && (
          //accessiblity thing that lets users skip tabbing through the navbar
          <a href={`#${firstContentItemId}`} className="skip-link">
            Skip to main content
          </a>
        )}

        <NavBar courseId={Number(cid)} />
        {(!onlyChatBotEnabled && (
          <Container>
            <Row gutter={64}>
              <TodayCol md={12} xs={24}>
                <Row justify="space-between">
                  <Title>{course?.name} Help Centre</Title>
                  {courseFeatures.queueEnabled && <TodayPageCheckinButton />}
                </Row>
                <Row>
                  <div>
                    <i>
                      You are a{' '}
                      <RoleColorSpan>{roleToString(role)}</RoleColorSpan> for
                      this course
                    </i>
                  </div>
                </Row>
                {courseFeatures.queueEnabled &&
                  (course?.queues?.length === 0 ? (
                    <>
                      <h1 style={{ paddingTop: '100px' }}>
                        There are no queues for this course, try asking async
                        questions
                      </h1>
                    </>
                  ) : (
                    sortedQueues?.map((q) => (
                      <QueueCard
                        linkId={
                          q.id === sortedQueues[0].id ? 'first-queue' : ''
                        }
                        key={q.id}
                        queue={q}
                        isTA={role === Role.TA || role === Role.PROFESSOR}
                        updateQueueNotes={updateQueueNotes}
                      />
                    ))
                  ))}

                {!course && <QueueCardSkeleton />}

                {courseFeatures.asyncQueueEnabled && (
                  <AsyncQuestionCard></AsyncQuestionCard>
                )}

                {role !== Role.STUDENT && courseFeatures.queueEnabled && (
                  <Row>
                    <CreateQueueButton
                      onClick={() => setCreateQueueModalVisible(true)}
                    >
                      + Create Queue
                    </CreateQueueButton>
                  </Row>
                )}

                {createQueueModalVisible && role !== Role.STUDENT && (
                  <QueueCreateModal
                    visible={createQueueModalVisible}
                    onSubmit={submitCreateQueue}
                    onCancel={() => setCreateQueueModalVisible(false)}
                    role={role}
                    lastName={profile?.lastName}
                  />
                )}
                {
                  // This only works with UTC offsets in the form N:00, to help with other offsets, the size of the array might have to change to a size of 24*7*4 (for every 15 min interval)
                  course && course.heatmap && courseFeatures.queueEnabled && (
                    <PopularTimes
                      heatmap={collapseHeatmap(
                        arrayRotate(
                          course.heatmap,
                          -Math.floor(moment().utcOffset() / 15),
                        ),
                      )}
                    />
                  )
                }
              </TodayCol>
              <TodayCol md={12} sm={24} className="h-[100vh]">
                {courseFeatures.chatBotEnabled && <ChatbotToday />}
              </TodayCol>
            </Row>
          </Container>
        )) || (
          // only show if only the chatbot is enabled
          <div className="mt-3 flex h-[100vh] flex-col items-center justify-items-end">
            <ChatbotToday />
          </div>
        )}
      </StandardPageContainer>
    )
  }
}
