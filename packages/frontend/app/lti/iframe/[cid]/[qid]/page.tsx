'use client'

import { ReactElement, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import IFrameQuestionFeedback from '@/app/lti/iframe/[cid]/[qid]/components/IFrameQuestionFeedback'
import { IFrameQuestion } from '@koh/common'
import { API } from '@/app/api'

export default function IFrameQuestionPage(): ReactElement {
  const routeParams = useParams<{ cid: string, qid: string }>()
  const [question, setQuestion] = useState<IFrameQuestion | null>(null)
  const [loadingQuestion, setLoadingQuestion] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState<boolean>(false)

  const courseId = useMemo(
    () => Number(routeParams?.cid ?? NaN),
    [routeParams?.cid],
  )

  const questionId = useMemo(
    () => Number(routeParams?.qid ?? NaN),
    [routeParams?.qid],
  )

  useEffect(() => {
    let interval: any, checking = false;
    interval = setInterval(async () => {
      try {
        if (checking) return;
        checking = true;
        setIsChecking(checking);
        const result = await API.lti.auth.check();
        setIsAuthorized(result);
        if (result) {
          clearInterval(interval);
          interval = undefined;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_err) {
        setIsAuthorized(false);
      } finally {
        checking = false;
        setIsChecking(checking);
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!isAuthorized) {
      return;
    }

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

    API.lti.iframeQuestion
      .getOne(courseId, qId)
      .then((q) => setQuestion(q))
      .catch(() =>
        setError('Could not load question. It may have been deleted.'),
      )
      .finally(() => setLoadingQuestion(false))
  }, [courseId, isAuthorized, questionId])

  if (!isAuthorized) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center px-3 py-2">
        <p className='text-bold text-center'>Authentication Required</p>
        <p className="text-zinc-600">
          You cannot access this resource at this time. Try launching the HelpMe LTI tool - a
          link to launch the tool should be visible in your Canvas course&#39;s navigation bar.
          Contact your professor if this keeps happening after launching HelpMe.
        </p>
        {isChecking && (
          <CenteredSpinner tip="Checking authentication state..." />
        )}
      </div>
    )
  }

  if (loadingQuestion) {
    return <CenteredSpinner tip="Loading..." />
  }

  if (!questionId) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center px-3 py-2">
        <p className="text-zinc-600">
          No question specified. The iframe URL should include a question ID.
          If possible, try refreshing the page after copying any
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
      <title>{`HelpMe | IFrame Question`}</title>
      <div className="flex w-full flex-col items-stretch px-2 py-1">
        <IFrameQuestionFeedback
          courseId={courseId}
          questionId={question.id}
          questionText={question.questionText}
        />
      </div>
    </>
  )
}
