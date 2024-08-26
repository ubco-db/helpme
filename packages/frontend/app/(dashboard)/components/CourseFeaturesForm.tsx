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
  const courseId = Number(courseData.course?.id)

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
          courseId={courseId}
        />

        <CourseFeatureSwitch
          featureName="asyncCentreAIAnswers"
          defaultChecked={courseFeatures.asyncCentreAIAnswers}
          title="Anytime Question Hub AI Answers"
          description="This feature will enable students question's to immediately get an AI answer when they ask it (on the Anytime Question Hub). From there, students can ask if they are satisfied or still need help with it, in which staff can then edit the answer or verify it."
          courseId={courseId}
        />

        <CourseFeatureSwitch
          featureName="chatBotEnabled"
          defaultChecked={courseFeatures.chatBotEnabled}
          title="ChatBot"
          description="This feature allows students to ask an AI chatbot questions that will answer their questions based on uploaded course content (located in course admin settings)"
          courseId={courseId}
        />

        <CourseFeatureSwitch
          featureName="queueEnabled"
          defaultChecked={courseFeatures.queueEnabled}
          title="Queues"
          description="This feature allows students to ask questions in a queue that can then be answered by the professor or a TA. Suitable for online, hybrid, and in-person office hours and labs."
          courseId={courseId}
        />

        <CourseFeatureSwitch
          featureName="scheduleOnFrontPage"
          defaultChecked={courseFeatures.scheduleOnFrontPage}
          title="Schedule on Front/Home Course Page"
          description="By default, a chatbot is displayed on the home course page. Enabling this will replace that chatbot with a preview of today's schedule and show a little 'chat now!' widget for the chatbot like other pages. Choose this option if you think it is more valuable for students to see today's event schedule over a large chatbot component."
          courseId={courseId}
        />

        <CourseFeatureSwitch
          featureName="adsEnabled"
          defaultChecked={courseFeatures.adsEnabled}
          disabled={true}
          title="Advertisements (Not currently implemented)"
          description="Displays non-intrusive advertisements to help keep the servers running"
          courseId={courseId}
        />
      </Form>
    )
  )
}

export default CourseFeaturesForm
