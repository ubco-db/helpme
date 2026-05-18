'use client'

import React, { ReactElement, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { EmbeddableAssignment } from '@koh/common'
import { API } from '@/app/api'
import { Badge, Divider } from 'antd'
import EmbeddableQuestionFeedback from '@/app/lti/embeddable/[cid]/components/EmbeddableQuestionFeedback'
import { DateIssue, ErrorMessage } from '@/app/lti/embeddable/[cid]/components/general'

export default function EmbeddableAssessmentPage(): ReactElement {
  const routeParams = useParams<{ cid: string, aid: string }>()
  const [assignment, setAssignment] = useState<EmbeddableAssignment | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const courseId = Number(routeParams.cid)
  const assignmentId = Number(routeParams.aid)

  const [isOpen,isClosed] = useMemo(() => {
    if (!assignment) return [ false, false ]
    let open = true, closed = false
    if (assignment.availableFrom && (new Date(assignment.availableFrom).getTime() > Date.now()))
      open = false
    if (assignment.availableUntil && (new Date(assignment.availableUntil).getTime() < Date.now()))
      closed = true
    return [open,closed]
  }, [assignment])


  useEffect(() => {
    if (!assignmentId) {
      setLoading(false)
      return
    }

    const aId = Number(assignmentId)
    if (isNaN(aId) || isNaN(courseId)) {
      setError('Invalid course or question ID')
      setLoading(false)
      return
    }

    API.lti.embeddableQuestion
      .assignment
      .getOne(courseId, aId)
      .then((q) => setAssignment(q))
      .catch(() =>
        setError('Could not load assignment. It may have been deleted.'),
      )
      .finally(() => setLoading(false))
  }, [courseId, assignmentId])

  if (loading) {
    return <CenteredSpinner tip="Loading..." />
  }

  if (error || !assignment) {
    return (
      <ErrorMessage mode={'assignment'} error={error} item={assignment} />
    )
  }

  if (!isOpen) {
    return (
      <DateIssue type={'early'} mode={'assignment'} item={assignment}/>
    )
  }


  if (isClosed) {
    return (
      <DateIssue type={'late'} mode={'assignment'} item={assignment}/>
    )
  }

  return (
    <>
      <title>{`HelpMe | Embeddable Assessment`}</title>
      <div className={'flex w-full justify-between'}>
        <h3 className={'font-bold'}>{assignment.name}</h3>
        <div className={'flex justify-end gap-2'}>
          {assignment.availableFrom && (
            <Badge color={'blue'} count={`Available from ${new Date(assignment.availableFrom).toDateString()}`} />
          )}
          {assignment.availableUntil && (
            <Badge color={'blue'} count={`Due by ${new Date(assignment.availableUntil).toDateString()}`} />
          )}
        </div>
      </div>
      <div className="flex w-full flex-col items-stretch px-2 py-1">
        {assignment.questions.map((question) => question.question).map((question, index) => (
          <div key={`question-${index}`}>
            <Divider orientation={'left'}>
              Question {index + 1} | {question.name}
            </Divider>
            <EmbeddableQuestionFeedback
              courseId={courseId}
              questionId={question.id}
              questionText={question.questionText}
              assignmentId={assignmentId}
            />
          </div>
        ))}
      </div>
    </>
  )
}
