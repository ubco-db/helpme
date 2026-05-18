'use client'

import { EmbeddableFeedback, UserPartial } from '@koh/common'
import { ReactElement, use, useCallback, useEffect, useMemo, useState } from 'react'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import EmbeddableFeedbackTable
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/EmbeddableFeedbackTable'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import {
  useEmbeddableQuestion,
} from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/context/embeddableQuestionContext'
import EmbeddableFeedbackListSkeleton
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/EmbeddableFeedbackListSkeleton'
import { message } from 'antd'

interface EmbeddableQuestionsAnswersPageProps {
  params: Promise<{ cid: string, qid: string }>
}

export default function EmbeddableQuestionAnswersPage(
  props: EmbeddableQuestionsAnswersPageProps,
): ReactElement {
  const params = use(props.params)
  const courseId = useMemo(() => Number(params.cid), [params.cid])
  const questionId = useMemo(() => Number(params.qid), [params.qid])

  const { question, setQuestionId } = useEmbeddableQuestion()
  useEffect(() => {
    setQuestionId(questionId)
  }, [questionId, setQuestionId])

  const [answers, setAnswers] = useState<EmbeddableFeedback[]>([])
  const [loading, setLoading] = useState(false)

  const [students, setStudents] = useState<UserPartial[]>([])
  const [totalStudents, setTotalStudents] = useState<number>(0)
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])

  const [editingAnswer, setEditingAnswer] = useState<EmbeddableFeedback | undefined>()

  const retrieveAnswers = useCallback(async () => {
    if (!questionId) return
    setLoading(true)
    await API.lti.embeddableQuestion.getAnswers(courseId, questionId, selectedStudents)
      .then(setAnswers)
      .catch(err => message.error(`Failed to retrieve answers: ${getErrorMessage(err)}`))
      .finally(() => setLoading(false))
  }, [courseId, questionId, selectedStudents])

  useEffect(() => {
    retrieveAnswers().then()
  }, [retrieveAnswers])

  async function handleDelete(feedback: EmbeddableFeedback) {
    try {
      await API.lti.embeddableQuestion.deleteAnswer(courseId, feedback.id)
      await retrieveAnswers()
    } catch (err) {
      message.error(`Failed to delete submission: ${getErrorMessage(err)}`)
    }
  }

  if (!question)
    return (
      <CenteredSpinner tip={'Loading question...'}/>
    )

  return (
    <EmbeddableFeedbackListSkeleton
      courseId={courseId}
      mode={'question'}
      students={students}
      setStudents={setStudents}
      totalStudents={totalStudents}
      setTotalStudents={setTotalStudents}
      editingAnswer={editingAnswer}
      setEditingAnswer={setEditingAnswer}
      selectedStudents={selectedStudents}
      setSelectedStudents={setSelectedStudents}
      retrieveAnswers={retrieveAnswers}
    >
      <EmbeddableFeedbackTable
        feedback={answers}
        handleDelete={handleDelete}
        loading={loading}
        selectFeedback={setEditingAnswer}
      />
    </EmbeddableFeedbackListSkeleton>
  )
}