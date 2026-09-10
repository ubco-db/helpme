'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card } from 'antd'
import axios from 'axios'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import type { StudentEmbeddableQuestion } from '@koh/common'
import { API } from '@/app/api'
import EmbeddableQuestionFeedback from '@/app/lti/embeddable/[cid]/components/EmbeddableQuestionFeedback'

type QuestionState =
  | { status: 'loading'; routeKey: string }
  | { status: 'error'; routeKey: string; error: string }
  | {
      status: 'ready'
      routeKey: string
      question: StudentEmbeddableQuestion
    }

function EmbeddableQuestionView() {
  const routeParams = useParams<{ cid: string; qid: string }>()
  const [questionState, setQuestionState] = useState<QuestionState>({
    status: 'loading',
    routeKey: '',
  })
  const contentRef = useRef<HTMLDivElement>(null)

  const courseId = Number(routeParams.cid)
  const questionId = Number(routeParams.qid)
  const hasInvalidRoute = !questionId || !courseId
  const routeKey = `${courseId}:${questionId}`

  useEffect(() => {
    if (hasInvalidRoute) return

    let cancelled = false
    API.lti.embeddableQuestion
      .getOne(courseId, questionId)
      .then((question) => {
        if (!cancelled) {
          setQuestionState({ status: 'ready', routeKey, question })
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          setQuestionState({
            status: 'error',
            routeKey,
            error:
              'Your HelpMe session has expired. Reopen this quiz in Canvas to continue.',
          })
          return
        }
        setQuestionState({
          status: 'error',
          routeKey,
          error:
            'Could not load question. It may have been deleted. Please let your professor know.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [courseId, hasInvalidRoute, questionId, routeKey])

  useEffect(() => {
    const content = contentRef.current
    if (!content || window.parent === window) return

    const parentOrigin = document.referrer
      ? new URL(document.referrer).origin
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
  }, [questionState.routeKey, questionState.status])

  const errorMessage = hasInvalidRoute
    ? 'Invalid course or question ID. Please let your professor know.'
    : questionState.status === 'error' && questionState.routeKey === routeKey
      ? questionState.error
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

  if (questionState.status !== 'ready' || questionState.routeKey !== routeKey) {
    return <CenteredSpinner tip="Loading..." />
  }

  const { question } = questionState
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

export default function EmbeddableQuestionPage() {
  return (
    <Suspense fallback={<CenteredSpinner tip="Loading..." />}>
      <EmbeddableQuestionView />
    </Suspense>
  )
}
