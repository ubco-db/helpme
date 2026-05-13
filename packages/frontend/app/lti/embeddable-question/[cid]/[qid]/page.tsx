'use client'

import React, { ReactElement, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import EmbeddableQuestionFeedback from '@/app/lti/embeddable-question/[cid]/[qid]/components/EmbeddableQuestionFeedback'
import { EmbeddableQuestion, isProd } from '@koh/common'
import { API } from '@/app/api'
import { Button, Card, Image } from 'antd'

export default function EmbeddableQuestionPage(): ReactElement {
  const dateFormat: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: 'numeric',
    minute: 'numeric',
    timeZoneName: 'short',
  }

  const routeParams = useParams<{ cid: string, qid: string }>()
  const [question, setQuestion] = useState<EmbeddableQuestion | null>(null)
  const [loadingQuestion, setLoadingQuestion] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState<boolean>(false)

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

  async function authCheck() {
    const result = await API.lti.auth.check();
    setIsAuthorized(result);
    return result;
  }

  useEffect(() => {
    (async () => authCheck())();
    let interval: any, checking = false;
    interval = setInterval(async () => {
      if (isAuthorized) {
        clearInterval(interval)
        interval = undefined;
      }
      try {
        if (checking) return;
        checking = true;
        setIsChecking(checking);
        const result = await authCheck();
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
    }, 1000)
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

    API.lti.embeddableQuestion
      .getOne(courseId, qId)
      .then((q) => setQuestion(q))
      .catch(() =>
        setError('Could not load question. It may have been deleted.'),
      )
      .finally(() => setLoadingQuestion(false))
  }, [courseId, isAuthorized, questionId])

  if (!isAuthorized) {
    return (
      <div className={'flex min-h-32 flex-col items-center justify-center px-3 py-2'}>
        <Card
          title={'Authentication Required!'}
        >
          <p className="text-zinc-600">
            You cannot access this resource at this time. Try launching the HelpMe LTI tool - a
            link to launch the tool should be visible in your Canvas course&#39;s navigation bar.
            Contact your professor if this keeps happening after launching HelpMe.
          </p>
          <p className="text-zinc-600">
            Alternatively, launch HelpMe in a new tab via the button below and log in:
          </p>
          <Button
            type={'default'}
            target={'_blank'}
            icon={
              <span className={'flex justify-center items-center'}>
              <Image
                src={'/helpme_logo_small.png'}
                width={16}
                height={16}
                alt={'LTI'}
                preview={false}
              />
            </span>
            }
            href={`${process.env.NEXT_PUBLIC_HOST_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}${isProd() ? '' : `:${process.env.NEXT_PUBLIC_DEV_PORT}`}/login`}
          >
            Launch HelpMe
          </Button>
          {isChecking && (
            <CenteredSpinner tip="Checking authentication state..." />
          )}
        </Card>
      </div>
    )
  }

  if (loadingQuestion) {
    return <CenteredSpinner tip="Loading..." />
  }

  if (error || !question) {
    return (
      <div className={'flex min-h-32 flex-col items-center justify-center px-3 py-2'}>
        <Card title={'Error loading Question'}>
          <p className="text-zinc-600">
            {error || 'Question not found.'} Please let your professor know.
          </p>
        </Card>
      </div>
    )
  }

  if (!isOpen) {
    return (
      <div className={'flex min-h-32 flex-col items-center justify-center px-3 py-2'}>
        <Card title={'Question has not opened yet!'}>
          <p className={'font-bold text-zinc-400'}>
            This question is not available yet. It will become available
            after {new Date(question.availableFrom ?? Date.now()).toLocaleDateString('en-US', dateFormat)}.
          </p>
        </Card>
      </div>
    )
  }


  if (isClosed) {
    return (
      <div className={'flex min-h-32 flex-col items-center justify-center px-3 py-2'}>
        <Card title={'Question is closed.'}>
          <p className={'font-bold text-zinc-400'}>
            This question is no longer available. It closed
            after {new Date(question.availableUntil ?? Date.now()).toLocaleDateString('en-US', dateFormat)}.
          </p>
        </Card>
      </div>
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
