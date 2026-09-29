'use client'

import { useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Card } from 'antd'
import { getErrorMessage } from '@/app/utils/generalUtils'
import useSWRImmutable from 'swr/immutable'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { API } from '@/app/api'
import EmbeddableQuestionFeedback from '@/app/lti/embeddable/[cid]/components/EmbeddableQuestionFeedback'

export default function EmbeddableQuestionPage() {
  const routeParams = useParams<{ cid: string; questionid: string }>()
  const contentRef = useRef<HTMLDivElement>(null)

  const courseId = Number(routeParams.cid)
  const questionId = Number(routeParams.questionid)
  const hasInvalidRoute = !questionId || !courseId

  const { data: question, error } = useSWRImmutable(
    hasInvalidRoute
      ? null
      : `lti/embeddable-question/${courseId}/${questionId}`,
    () => API.lti.embeddableQuestion.getOne(courseId, questionId),
    { shouldRetryOnError: false },
  )

  useEffect(() => {
    const content = contentRef.current
    if (!content || window.parent === window) return

    const referrerOrigin = document.referrer
      ? new URL(document.referrer).origin
      : undefined
    const parentOrigin =
      referrerOrigin && referrerOrigin !== window.location.origin
        ? referrerOrigin
        : '*'
    const resize = () =>
      window.parent.postMessage(
        { subject: 'lti.frameResize', height: content.scrollHeight },
        parentOrigin,
      )
    const observer = new ResizeObserver(resize)
    observer.observe(content)
    resize()
    return () => observer.disconnect()
  }, [question])

  const backendMessage: unknown = error ? getErrorMessage(error) : undefined
  const errorMessage = hasInvalidRoute
    ? 'Invalid course or question ID. Please let your professor know.'
    : error
      ? typeof backendMessage === 'string' && backendMessage.trim()
        ? backendMessage
        : 'Could not load question. Please let your professor know.'
      : undefined

  if (errorMessage) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center px-3 py-2">
        <Card title="Error loading Question">
          <p className="text-zinc-600">{errorMessage}</p>
        </Card>
      </div>
    )
  }

  if (!question) {
    return <CenteredSpinner tip="Loading..." />
  }

  return (
    <>
      <title>HelpMe | Embeddable Question</title>
      <div
        ref={contentRef}
        className="flex w-full flex-col items-stretch px-2 py-1"
      >
        <EmbeddableQuestionFeedback
          courseId={courseId}
          questionId={question.id}
          questionText={question.questionText}
        />
      </div>
    </>
  )
}
