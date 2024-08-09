'use client'

import { courseApi } from '@/app/api/courseApi'
import { CourseSettingsResponse, OrganizationCourseResponse } from '@koh/common'
import { Form } from 'antd'
import { useEffect, useState } from 'react'
import CourseFeatureSwitch from './CourseFeatureSwitch'

type CourseFeaturesFormProps = {
  courseData: OrganizationCourseResponse
}

const CourseFeaturesForm: React.FC<CourseFeaturesFormProps> = ({
  courseData,
}) => {
  const [courseFeatures, setCourseFeatures] = useState<CourseSettingsResponse>()

  useEffect(() => {
    const fetchFeatures = async () => {
      const courseFeatures = await courseApi.getCourseFeatures(
        Number(courseData.course?.id),
      )
      setCourseFeatures(courseFeatures)
    }
    fetchFeatures()
  }, [courseData.course?.id])

  return (
    courseFeatures && (
      <Form className="space-y-3">
        <CourseFeatureSwitch
          featureName="asyncQueueEnabled"
          defaultChecked={courseFeatures.asyncQueueEnabled}
          title="Anytime Question Hub"
          description="This feature allows students to ask questions asynchronously (e.g. outside of office hours or labs) that can then be answered by the professor. It also features automatic AI-generated answers based on uploaded course content."
          courseId={Number(courseData.course?.id)}
        />

        <CourseFeatureSwitch
          featureName="chatBotEnabled"
          defaultChecked={courseFeatures.chatBotEnabled}
          title="ChatBot"
          description="This feature allows students to ask an AI chatbot questions that will answer their questions based on uploaded course content (located in course admin settings)"
          courseId={Number(courseData.course?.id)}
        />

        <CourseFeatureSwitch
          featureName="queueEnabled"
          defaultChecked={courseFeatures.queueEnabled}
          title="Queues"
          description="This feature allows students to ask questions in a queue that can then be answered by the professor or a TA. Suitable for online, hybrid, and in-person office hours and labs."
          courseId={Number(courseData.course?.id)}
        />

        <CourseFeatureSwitch
          featureName="adsEnabled"
          defaultChecked={courseFeatures.adsEnabled}
          disabled={true}
          title="Advertisements (Not currently implemented)"
          description="Displays non-intrusive advertisements to help keep the servers running"
          courseId={Number(courseData.course?.id)}
        />
      </Form>
    )
  )
}

export default CourseFeaturesForm
