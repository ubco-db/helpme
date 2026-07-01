'use client'

import { CourseSettingsResponse, OrganizationCourseResponse } from '@koh/common'
import { Divider, Form } from 'antd'
import { useEffect, useState } from 'react'
import CourseFeatureSwitch from './CourseFeatureSwitch'
import { API } from '@/app/api'

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
      await API.course
        .getCourseFeatures(Number(courseData.course?.id))
        .then((features) => {
          setCourseFeatures(features)
        })
        .catch(() => undefined)
    }
    fetchFeatures()
  }, [courseData.course?.id])

  return (
    courseFeatures && (
      <Form className="flex min-w-full flex-col gap-2 md:min-w-[34rem]">
        <div>
          <CourseFeatureSwitch
            featureName="chatBotEnabled"
            defaultChecked={courseFeatures.chatBotEnabled}
            title="ChatBot"
            description="This feature allows students to ask an AI chatbot questions that will answer their questions based on uploaded course content (located in Chatbot Settings)"
            courseId={courseId}
          />
          <Divider
            className="mx-auto w-1/2 min-w-40 border-gray-300 "
            size="small"
            variant="dashed"
          />
        </div>

        <div>
          <CourseFeatureSwitch
            featureName="queueEnabled"
            defaultChecked={courseFeatures.queueEnabled}
            title="Queues"
            description="This feature allows students to ask questions in a queue that can then be answered by the professor or a TA. Suitable for online, hybrid, and in-person office hours and labs."
            courseId={courseId}
          />

          <CourseFeatureSwitch
            featureName="scheduleOnFrontPage"
            className="ml-4 md:ml-6"
            defaultChecked={courseFeatures.scheduleOnFrontPage}
            title="Schedule on Front/Home Course Page"
            description="By default, a chatbot is displayed on the home course page. Enabling this will replace that chatbot with a preview of today's schedule and show a little 'Chatbot' widget for the chatbot like other pages. Choose this option if you think it is more valuable for students to see today's event schedule over a large chatbot component."
            courseId={courseId}
          />
          <Divider
            className="mx-auto w-1/2 min-w-40 border-gray-300 "
            size="small"
            variant="dashed"
          />
        </div>

        {/* <CourseFeatureSwitch
          featureName="adsEnabled"
          defaultChecked={courseFeatures.adsEnabled}
          disabled={true}
          title="Advertisements (Not currently implemented)"
          description="Displays non-intrusive advertisements to help keep the servers running"
          courseId={courseId}
        /> */}
        <div>
          <CourseFeatureSwitch
            featureName="asyncQueueEnabled"
            defaultChecked={courseFeatures.asyncQueueEnabled}
            title="Anytime Question Hub"
            description="This feature allows students to ask questions asynchronously (e.g. outside of office hours or labs) that can then be answered by the professor. It also features automatic AI-generated answers based on uploaded course content."
            courseId={courseId}
          />

          <CourseFeatureSwitch
            featureName="asyncCentreAIAnswers"
            className="ml-4 md:ml-6"
            defaultChecked={courseFeatures.asyncCentreAIAnswers}
            title="AI Answers"
            description="This feature will enable students question's to immediately get an AI answer when they ask it (on the Anytime Question Hub). From there, students can ask if they are satisfied or still need help with it, in which staff can then edit the answer or verify it."
            courseId={courseId}
          />

          <CourseFeatureSwitch
            featureName="asyncCentreDefaultAnonymous"
            className="ml-4 md:ml-6"
            defaultChecked={courseFeatures.asyncCentreDefaultAnonymous}
            title="Questions Anonymous by Default"
            description="By default, Anytime Question authors are anonymous when viewed by students. Toggling this will make new Anytime Questions be anonymous or non-anonymous by default. It will not change the anonymity of previously posted questions. Question authors decide whether their profile will be visible or not when editing or creating the question."
            courseId={courseId}
          />

          <CourseFeatureSwitch
            featureName="asyncCentreAuthorPublic"
            className="ml-4 md:ml-6"
            defaultChecked={courseFeatures.asyncCentreAuthorPublic}
            title="Allow Students to make their Questions Public"
            description="By default, staff members have to make anytime questions public themselves (public = all students in course can see it). Enabling this allows students to make their own questions public, giving a more traditional discussion board experience rather than a curated list of questions."
            courseId={courseId}
          />
        </div>
      </Form>
    )
  )
}

export default CourseFeaturesForm
