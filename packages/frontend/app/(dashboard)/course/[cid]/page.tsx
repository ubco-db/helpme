'use client'

// import { API } from '@koh/api-client'
// import { Heatmap, Role } from '@koh/common'
import { Role } from '@koh/common'
import { Col, Row, Spin, Button } from 'antd'
// import { chunk, mean } from 'lodash'
// import moment from 'moment'
import React, { ReactElement, useMemo, useState } from 'react'
// import TodayPageCheckinButton from '../../../components/Today/QueueCheckInButton'
// import QueueCreateModal from '../../../components/Today/QueueCreateModal'
// import PopularTimes from '../../../components/Today/PopularTimes/PopularTimes'
// import AsyncQuestionCard from '../../../components/Questions/AsyncQuestions/AsyncQuestionCard'
import { orderBy } from 'lodash'
// import { ChatbotToday } from '../../../components/Today/ChatbotToday'
import QueueCard from './components/QueueCard'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import { useUserInfo } from '@/app/contexts/userContext'
import { getRoleInCourse } from '@/app/utils/generalUtils'
import { useCourse } from '@/app/hooks/useCourse'
import CreateQueueModal from './components/CreateQueueModal'
import AsyncCentreCard from './components/AsyncCentreCard'

// function arrayRotate<T>(arr: T[], count: number): T[] {
//   const adjustedCount = (arr.length + count) % arr.length;
//   return arr
//     .slice(adjustedCount, arr.length)
//     .concat(arr.slice(0, adjustedCount));
// }

// const collapseHeatmap = (heatmap: Heatmap): Heatmap =>
//   chunk(heatmap, 4).map((hours) => {
//     const filteredOfficeHours = hours.filter((v) => v !== -1)
//     return filteredOfficeHours.length > 0 ? mean(filteredOfficeHours) : -1
//   })

type CoursePageProps = {
  params: { cid: string }
}

export default function CoursePage({ params }: CoursePageProps): ReactElement {
  const cid = Number(params.cid)
  const { userInfo } = useUserInfo()
  const role = getRoleInCourse(userInfo, cid)
  const { course } = useCourse(cid)
  const [createQueueModalVisible, setCreateQueueModalVisible] = useState(false)

  const courseFeatures = useCourseFeatures(cid)
  const onlyChatBotEnabled = useMemo(
    () =>
      courseFeatures?.chatBotEnabled &&
      !courseFeatures?.queueEnabled &&
      !courseFeatures?.asyncQueueEnabled,
    [courseFeatures],
  )

  const sortedQueues = useMemo(() => {
    if (!course?.queues) return []

    return orderBy(
      course.queues,
      ['isOpen', 'staffList.length', 'room'],
      ['desc', 'desc', 'asc'],
    )
  }, [course?.queues])

  const skipLinkTarget: 'first-queue' | 'async-centre' | 'chatbot-input' | '' =
    useMemo(() => {
      if (courseFeatures?.queueEnabled) {
        return 'first-queue'
      } else if (courseFeatures?.asyncQueueEnabled) {
        return 'async-centre'
      } else if (courseFeatures?.chatBotEnabled) {
        return 'chatbot-input'
      }
      return ''
    }, [courseFeatures])

  if (!course || !courseFeatures) {
    return <Spin tip="Loading..." size="large" />
  } else {
    return (
      <>
        {(!onlyChatBotEnabled && (
          <div className="mt-8">
            <Row gutter={64}>
              <Col className="mb-4" md={12} xs={24}>
                <Row justify="space-between">
                  <div className="overflow-hidden whitespace-nowrap text-2xl font-semibold text-[#212934] md:text-3xl">
                    {course?.name} Help Centre
                  </div>
                  {/* {courseFeatures.queueEnabled && <TodayPageCheckinButton />} */}
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
                        cid={cid}
                        linkId={
                          skipLinkTarget == 'first-queue' &&
                          q.id === sortedQueues[0].id
                            ? 'skip-link-target'
                            : ''
                        }
                        key={q.id}
                        queue={q}
                        isTA={role === Role.TA || role === Role.PROFESSOR}
                      />
                    ))
                  ))}

                {courseFeatures.asyncQueueEnabled && (
                  <AsyncCentreCard
                    cid={cid}
                    linkId={
                      skipLinkTarget == 'async-centre' ? 'skip-link-target' : ''
                    }
                  />
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
                  <CreateQueueModal
                    cid={cid}
                    visible={createQueueModalVisible}
                    onSuccessfulSubmit={() => setCreateQueueModalVisible(false)}
                    onCancel={() => setCreateQueueModalVisible(false)}
                    role={role}
                    lastName={userInfo?.lastName ?? 'Professor'}
                  />
                )}
                {
                  // This only works with UTC offsets in the form N:00, to help with other offsets, the size of the array might have to change to a size of 24*7*4 (for every 15 min interval)
                  // course && course.heatmap && courseFeatures.queueEnabled && (
                  //   <PopularTimes
                  //     heatmap={collapseHeatmap(
                  //       arrayRotate(
                  //         course.heatmap,
                  //         -Math.floor(moment().utcOffset() / 15),
                  //       ),
                  //     )}
                  //   />
                  // )
                }
              </Col>
              <Col className="mb-4 h-[100vh]" md={12} sm={24}>
                {/* {courseFeatures.chatBotEnabled && <ChatbotToday />} */}
              </Col>
            </Row>
          </div>
        )) || (
          // only show if only the chatbot is enabled
          <div className="mt-3 flex h-[100vh] flex-col items-center justify-items-end">
            {/* <ChatbotToday /> */}
          </div>
        )}
      </>
    )
  }
}
