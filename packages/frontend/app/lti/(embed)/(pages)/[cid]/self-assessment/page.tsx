'use client'

import { ReactElement } from 'react'
import { useSearchParams } from 'next/navigation'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useLtiCourse } from '@/app/contexts/LtiCourseContext'
import SelfAssessmentQuestionFeedback from '../components/SelfAssessmentQuestionFeedback'

export default function SelfAssessmentPage(): ReactElement {
  const { courseId, course, courseFeatures } = useLtiCourse()
  const searchParams = useSearchParams()

  // Question text can come from URL (e.g. ?question=...) or LTI custom params later
  const questionText =
    searchParams.get('question') ??
    searchParams.get('question_text') ??
    undefined

  if (!course || !courseFeatures) {
    return <CenteredSpinner tip="Loading Course Data..." />
  }

  if (!courseFeatures.chatBotEnabled) {
    return (
      <div className="mt-3 flex h-[50vh] flex-col items-center justify-center">
        <p className="text-zinc-600">
          The self-assessment tool is not available for this course. The chatbot
          must be enabled by your instructor.
        </p>
      </div>
    )
  }

  return (
    <>
      <title>{`HelpMe | ${course.name} - Self-Assessment`}</title>
      <div className="mt-3 flex flex-col items-center px-4 py-4">
        <SelfAssessmentQuestionFeedback
          courseId={courseId}
          questionText={questionText}
        />
      </div>
    </>
  )
}
