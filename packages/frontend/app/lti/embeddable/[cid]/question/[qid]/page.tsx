'use client'

import React, { ReactElement, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { EmbeddableQuestion } from '@koh/common'
import { API } from '@/app/api'
import EmbeddableQuestionFeedback from '@/app/lti/embeddable/[cid]/components/EmbeddableQuestionFeedback'
import { DateIssue, ErrorMessage } from '@/app/lti/embeddable/[cid]/components/general'

export default function EmbeddableQuestionPage(): ReactElement {
  const routeParams = useParams<{ cid: string, qid: string }>()
  const [question, setQuestion] = useState<EmbeddableQuestion>()
  const [loadingQuestion, setLoadingQuestion] = useState(true)
  const [error, setError] = useState<string>()

  const courseId = Number(routeParams.cid)
  const questionId = Number(routeParams.qid)

  const [isOpen,isClosed] = useMemo(() => {
    if (!question) return [ false, false ]
    let open = true, closed = false
    if (question.availableFrom && (new Date(question.availableFrom).getTime() > Date.now()))
      open = false
    if (question.availableUntil && (new Date(question.availableUntil).getTime() < Date.now()))
      closed = true
    return [open,closed]
  }, [question])

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

    API.lti.embeddableQuestion
      .getOne(courseId, qId)
      .then((q) => setQuestion(q))
      .catch(() =>
        setError('Could not load question. It may have been deleted.'),
      )
      .finally(() => setLoadingQuestion(false))
  }, [courseId, questionId])

  if (loadingQuestion) {
    return <CenteredSpinner tip="Loading..." />
  }

  if (error || !question) {
    return (
      <ErrorMessage mode={'question'} error={error} item={question} />
    )
  }

  if (!isOpen) {
    return (
      <DateIssue type={'early'} mode={'question'} item={question}/>
    )
  }


  if (isClosed) {
    return (
      <DateIssue type={'late'} mode={'question'} item={question}/>
    )
  }


  return (
    <>
      <title>{`HelpMe | Embeddable Question`}</title>
      <div className="flex w-full flex-col items-stretch px-2 py-1">
        <EmbeddableQuestionFeedback
          courseId={courseId}
          questionId={question.id}
          questionText={question.questionText}
        />
      </div>
    </>
  )
}
