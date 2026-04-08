'use client'

import { ReactElement, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useLtiCourse } from '@/app/contexts/LtiCourseContext'
import IframeQuestionFeedback from '../components/IframeQuestionFeedback'
import { IframeQuestion } from '@koh/common'
import { API } from '@/app/api'

// this page gets loaded in the canvas iframe
// it reads the question id from the url (like ?q=3)
// fetches the question + criteria from the backend
// then shows the form widget

export default function IframePage(): ReactElement {
  const { courseId, course, courseFeatures } = useLtiCourse()
  const searchParams = useSearchParams()

  const questionId = searchParams.get('q')

  const [question, setQuestion] = useState<IframeQuestion | null>(null)
  const [loadingQuestion, setLoadingQuestion] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!questionId) {
      setLoadingQuestion(false)
      return
    }
    const qId = Number(questionId)
    if (isNaN(qId)) {
      setError('Invalid question ID')
      setLoadingQuestion(false)
      return
    }
    API.iframeQuestion
      .getOne(courseId, qId)
      .then((q) => setQuestion(q))
      .catch(() =>
        setError('Could not load question. It may have been deleted.'),
      )
      .finally(() => setLoadingQuestion(false))
  }, [courseId, questionId])

  // wait for course data to load
  if (!course || !courseFeatures || loadingQuestion) {
    return <CenteredSpinner tip="Loading..." />
  }

  if (!questionId) {
    return (
      <div className="mt-3 flex h-[50vh] flex-col items-center justify-center">
        <p className="text-zinc-600">
          No question specified. The iframe URL should include a question ID
          (e.g. ?q=3).
        </p>
      </div>
    )
  }

  if (error || !question) {
    return (
      <div className="mt-3 flex h-[50vh] flex-col items-center justify-center">
        <p className="text-zinc-600">{error || 'Question not found.'}</p>
      </div>
    )
  }

  // chatbot needs to be enabled for ai feedback to work
  if (!courseFeatures.chatBotEnabled) {
    return (
      <div className="mt-3 flex h-[50vh] flex-col items-center justify-center">
        <p className="text-zinc-600">
          AI feedback is not available for this course. The chatbot must be
          enabled by your instructor.
        </p>
      </div>
    )
  }

  return (
    <>
      <title>{`HelpMe | ${course.name} - Self-Assessment`}</title>
      <div className="mt-3 flex flex-col items-center px-4 py-4">
        <IframeQuestionFeedback
          courseId={courseId}
          questionText={question.questionText}
          criteriaText={question.criteriaText}
        />
      </div>
    </>
  )
}
