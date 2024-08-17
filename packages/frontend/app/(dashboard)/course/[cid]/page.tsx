'use client'

import { Role } from '@koh/common'
import { Col, Row, Button } from 'antd'
import { ReactElement, useMemo, useState } from 'react'
// import { ChatbotToday } from '../../../components/Today/ChatbotToday'
import QueueCard from './components/QueueCard'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import { useUserInfo } from '@/app/contexts/userContext'
import { getRoleInCourse } from '@/app/utils/generalUtils'
import { useCourse } from '@/app/hooks/useCourse'
import CreateQueueModal from './components/CreateQueueModal'
import AsyncCentreCard from './components/AsyncCentreCard'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import CoursePageCheckInButton from './components/CoursePageCheckInButton'
import PopularTimes from './components/popularTimes/PopularTimes'
import { arrayRotate, collapseHeatmap } from './utils/popularTimesFunctions'
import moment from 'moment'
import { sortQueues } from './utils/commonCourseFunctions'

type CoursePageProps = {
  params: { cid: string }
}

export default function CoursePage({ params }: CoursePageProps): ReactElement {
  const cid = Number(params.cid)
  const { userInfo } = useUserInfo()
  const role = getRoleInCourse(userInfo, cid)
  const { course } = useCourse(cid)
  const [createQueueModalOpen, setCreateQueueModalOpen] = useState(false)

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
    return sortQueues(course.queues)
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
    return <CenteredSpinner tip="Loading Course Data..." />
  } else {
    return (
      <>
        <title>{`HelpMe | ${course.name}`}</title>
        {(!onlyChatBotEnabled && (
          <div className="mt-8">
            <Row gutter={64}>
              <Col className="mb-4" md={12} xs={24}>
                <Row justify="space-between">
                  <h1 className="overflow-hidden whitespace-nowrap text-2xl font-semibold text-[#212934] md:text-3xl">
                    {course?.name} Help Centre
                  </h1>
                  {courseFeatures.queueEnabled && (
                    <CoursePageCheckInButton courseId={cid} />
                  )}
                </Row>
                <Row>
                  <div>
                    <i>
                      You are a{' '}
                      <span className="text-helpmeblue font-bold">
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </span>{' '}
                      for this course
                    </i>
                  </div>
                </Row>
                {courseFeatures.queueEnabled &&
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
                  ))}

                {courseFeatures.asyncQueueEnabled && (
                  <AsyncCentreCard
                    cid={cid}
                    linkId={
                      skipLinkTarget == 'async-centre' ? 'skip-link-target' : ''
                    }
                  />
                )}

                {role === Role.TA ||
                  (role === Role.PROFESSOR && courseFeatures.queueEnabled && (
                    <Row>
                      <Button
                        type="primary"
                        className="mx-auto rounded-md px-4 py-1 font-semibold"
                        onClick={() => setCreateQueueModalOpen(true)}
                      >
                        + Create Queue
                      </Button>
                    </Row>
                  ))}

                {role === Role.TA ||
                  (role === Role.PROFESSOR && (
                    <CreateQueueModal
                      cid={cid}
                      open={createQueueModalOpen}
                      onSuccessfulSubmit={() => setCreateQueueModalOpen(false)}
                      onCancel={() => setCreateQueueModalOpen(false)}
                      role={role}
                    />
                  ))}
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
