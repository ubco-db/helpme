'use client'

import { ReactElement, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import IframeQuestionFeedback from '@/app/lti/(embed)/(pages)/[cid]/components/IframeQuestionFeedback'
import { IframeQuestion } from '@koh/common'
import { API } from '@/app/api'

export default function IframePage(): ReactElement {
  const searchParams = useSearchParams()
  const routeParams = useParams<{ cid: string }>()
  const [question, setQuestion] = useState<IframeQuestion | null>(null)
  const [loadingQuestion, setLoadingQuestion] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const courseId = useMemo(
    () => Number(routeParams?.cid ?? NaN),
    [routeParams?.cid],
  )

  const questionId = searchParams.get('q')

  useEffect(() => {
    if (!questionId) {
      setLoadingQuestion(false)
      return
    }

    const qId = Number(questionId)
    if (isNaN(qId) || isNaN(courseId)) {
      setError('Invalid course or question ID')
      setLoadingQuestion(false)
      return
    }

    API.iframeQuestion
      .getOnePublic(courseId, qId)
      .then((q) => setQuestion(q))
      .catch(() =>
        setError('Could not load question. It may have been deleted.'),
      )
      .finally(() => setLoadingQuestion(false))
  }, [courseId, questionId])

  if (loadingQuestion) {
    return <CenteredSpinner tip="Loading..." />
  }

  if (!questionId) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center px-3 py-2">
        <p className="text-zinc-600">
          No question specified. The iframe URL should include a question ID
          (e.g. ?q=3). If possible, try refreshing the page after copying any
          important work elsewhere, and let your professor know if this keeps
          happening.
        </p>
      </div>
    )
  }

  if (error || !question) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center px-3 py-2">
        <p className="text-zinc-600">
          {error || 'Question not found.'} Please let your professor know.
        </p>
      </div>
    )
  }

  return (
    <>
      <title>{`HelpMe | Iframe Question`}</title>
      <div className="flex w-full flex-col items-stretch px-2 py-1">
        <IframeQuestionFeedback
          courseId={courseId}
          questionId={question.id}
          questionText={question.questionText}
        />
      </div>
    </>
  )
}
