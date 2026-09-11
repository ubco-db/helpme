'use client'

import { useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Card } from 'antd'
import axios from 'axios'
import useSWR from 'swr'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { API } from '@/app/api'
import EmbeddableQuestionFeedback from '@/app/lti/embeddable/[cid]/components/EmbeddableQuestionFeedback'

export default function EmbeddableQuestionPage() {
  const routeParams = useParams<{ cid: string; qid: string }>()
  const contentRef = useRef<HTMLDivElement>(null)

  const courseId = Number(routeParams.cid)
  const questionId = Number(routeParams.qid)
  const hasInvalidRoute = !questionId || !courseId

  const { data: question, error } = useSWR(
    hasInvalidRoute
      ? null
      : `lti/embeddable-question/${courseId}/${questionId}`,
    () => API.lti.embeddableQuestion.getOne(courseId, questionId),
    { shouldRetryOnError: false, revalidateOnFocus: false },
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

  const errorMessage = hasInvalidRoute
    ? 'Invalid course or question ID. Please let your professor know.'
    : error
      ? axios.isAxiosError(error) && error.response?.status === 401
        ? 'Your HelpMe session has expired. Reopen this quiz in Canvas to continue.'
        : 'Could not load question. It may have been deleted. Please let your professor know.'
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
