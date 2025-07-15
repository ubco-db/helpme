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
          className="ml-4"
          defaultChecked={courseFeatures.scheduleOnFrontPage}
          title="Schedule on Front/Home Course Page"
          description="By default, a chatbot is displayed on the home course page. Enabling this will replace that chatbot with a preview of today's schedule and show a little 'chat now!' widget for the chatbot like other pages. Choose this option if you think it is more valuable for students to see today's event schedule over a large chatbot component."
          courseId={courseId}
        />

        {/* <CourseFeatureSwitch
          featureName="adsEnabled"
          defaultChecked={courseFeatures.adsEnabled}
          disabled={true}
          title="Advertisements (Not currently implemented)"
          description="Displays non-intrusive advertisements to help keep the servers running"
          courseId={courseId}
        /> */}

        <CourseFeatureSwitch
          featureName="asyncQueueEnabled"
          defaultChecked={courseFeatures.asyncQueueEnabled}
          title="Anytime Question Hub"
          description="This feature allows students to ask questions asynchronously (e.g. outside of office hours or labs) that can then be answered by the professor. It also features automatic AI-generated answers based on uploaded course content."
          courseId={courseId}
        />

        <CourseFeatureSwitch
          featureName="asyncCentreAIAnswers"
          className="ml-4"
          defaultChecked={courseFeatures.asyncCentreAIAnswers}
          title="Anytime Question Hub AI Answers"
          description="This feature will enable students question's to immediately get an AI answer when they ask it (on the Anytime Question Hub). From there, students can ask if they are satisfied or still need help with it, in which staff can then edit the answer or verify it."
          courseId={courseId}
        />

        <CourseFeatureSwitch
          featureName="asyncCentreDefaultAnonymous"
          className="ml-4"
          defaultChecked={courseFeatures.asyncCentreDefaultAnonymous}
          title="Anytime Questions Anonymous by Default"
          description="By default, Anytime Question authors are anonymous when viewed by students. Toggling this will make new Anytime Questions be anonymous or non-anonymous by default. It will not change the anonymity of previously posted questions. Question authors decide whether their profile will be visible or not when editing or creating the question."
          courseId={courseId}
        />

        <CourseFeatureSwitch
          featureName="asyncCentreAuthorPublic"
          className="ml-4"
          defaultChecked={courseFeatures.asyncCentreAuthorPublic}
          title="Allow Anytime Question Authors to make their Questions Public"
          description="By default, staff members have to make anytime questions public themselves. This allows authors of anytime questions to make their own questions visible to all members of the course. Staff can override this."
          courseId={courseId}
        />
      </Form>
    )
  )
}

export default CourseFeaturesForm
