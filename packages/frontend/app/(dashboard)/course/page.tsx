'use client'

import { API } from '@koh/api-client'
import { Heatmap, Role } from '@koh/common'
import { Col, Row, Spin, Button, message } from 'antd'
import { chunk, mean } from 'lodash'
import moment from 'moment'
import { useRouter } from 'next/router'
import React, { ReactElement, useCallback, useMemo, useState } from 'react'
import TodayPageCheckinButton from '../../../components/Today/QueueCheckInButton'
import QueueCreateModal from '../../../components/Today/QueueCreateModal'
import PopularTimes from '../../../components/Today/PopularTimes/PopularTimes'
import AsyncQuestionCard from '../../../components/Questions/AsyncQuestions/AsyncQuestionCard'
import { orderBy } from 'lodash'
import { ChatbotToday } from '../../../components/Today/ChatbotToday'
import QueueCard from './components/QueueCard'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import { useUserInfo } from '@/app/contexts/userContext'
import { getRoleInCourse } from '@/app/utils/generalUtils'
import { useCourse } from '@/app/hooks/useCourse'
import Navbar from '@/app/components/navbar'
import StandardPageContainer from '@/app/components/StandardPageContainer'

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

export default function CoursePage(): ReactElement {
  const router = useRouter()
  const { cid: cidString } = router.query
  const cid = useMemo(() => Number(cidString), [cidString])

  const { userInfo } = useUserInfo()
  const role = getRoleInCourse(userInfo, cid)
  const { course, mutateCourse } = useCourse(cid)
  const [createQueueModalVisible, setCreateQueueModalVisible] = useState(false)

  const courseFeatures = useCourseFeatures(cid)

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

  const submitCreateQueue = useCallback(
    async (submittedForm) => {
      const queueRequest = await submittedForm.validateFields()
      try {
        await API.queues.createQueue(
          cid,
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
    },
    [cid, mutateCourse],
  )

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
        {firstContentItemId && (
          //accessiblity thing that lets users skip tabbing through the navbar
          <a href={`#${firstContentItemId}`} className="skip-link">
            Skip to main content
          </a>
        )}

        <Navbar />
        {(!onlyChatBotEnabled && (
          <div className="mt-8">
            <Row gutter={64}>
              <Col className="mb-4" md={12} xs={24}>
                <Row justify="space-between">
                  <div className="overflow-hidden whitespace-nowrap text-2xl font-semibold text-[#212934] md:text-3xl">
                    {course?.name} Help Centre
                  </div>
                  {courseFeatures.queueEnabled && <TodayPageCheckinButton />}
                </Row>
                <Row>
                  <div>
                    <i>
                      You are a{' '}
                      <span className="font-bold text-[#3684c6]">
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </span>{' '}
                      for this course
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

                {courseFeatures.asyncQueueEnabled && (
                  <AsyncQuestionCard></AsyncQuestionCard>
                )}

                {role !== Role.STUDENT && courseFeatures.queueEnabled && (
                  <Row>
                    <Button
                      className="mx-auto rounded-md bg-[#1890ff] px-4 py-1 text-sm font-semibold text-white"
                      onClick={() => setCreateQueueModalVisible(true)}
                    >
                      + Create Queue
                    </Button>
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
              </Col>
              <Col className="mb-4 h-[100vh]" md={12} sm={24}>
                {courseFeatures.chatBotEnabled && <ChatbotToday />}
              </Col>
            </Row>
          </div>
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
