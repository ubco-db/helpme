'use client'

import { EmbeddableFeedback, UserPartial } from '@koh/common'
import { ReactElement, use, useCallback, useEffect, useMemo, useState } from 'react'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { message, Tabs } from 'antd'
import EmbeddableFeedbackTable
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/EmbeddableFeedbackTable'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import {
  useEmbeddableAssignment,
} from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/context/embeddableAssignmentContext'
import EmbeddableFeedbackListSkeleton
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/EmbeddableFeedbackListSkeleton'

interface EmbeddableQuestionsAnswersPageProps {
  params: Promise<{ cid: string, aid: string }>
}

export default function EmbeddableAssignmentAnswersPage(
  props: EmbeddableQuestionsAnswersPageProps,
): ReactElement {
  const params = use(props.params)
  const courseId = useMemo(() => Number(params.cid), [params.cid])
  const assignmentId = useMemo(() => Number(params.aid), [params.aid])

  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState<Record<number,EmbeddableFeedback[]>>({})
  const [editingAnswer, setEditingAnswer] = useState<EmbeddableFeedback | undefined>()

  const [students, setStudents] = useState<UserPartial[]>([])
  const [totalStudents, setTotalStudents] = useState<number>(0)
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])

  const { assignment, setAssignmentId } = useEmbeddableAssignment()
  useEffect(() => {
    setAssignmentId(assignmentId)
  }, [assignmentId, setAssignmentId])

  const retrieveAnswers = useCallback(async () => {
    if (!assignmentId || !assignment) return
    setLoading(true)
    await API.lti.embeddableQuestion.assignment.getAnswers(courseId, assignmentId, selectedStudents)
      .then((ans) => {
        const set: Record<number,EmbeddableFeedback[]> = {}
        assignment!.questions.forEach((q) => set[q.questionId] = ans.filter(a => a.questionId == q.questionId))
        setAnswers(set)
      })
      .catch(err => message.error(`Failed to retrieve answers: ${getErrorMessage(err)}`))
      .finally(() => setLoading(false))
  }, [assignmentId, assignment, courseId, selectedStudents])

  useEffect(() => {
    retrieveAnswers().then()
  }, [retrieveAnswers])

  async function handleDelete(feedback: EmbeddableFeedback) {
    try {
      await API.lti.embeddableQuestion.assignment.deleteAnswer(courseId, feedback.id)
      await retrieveAnswers()
    } catch (err) {
      message.error(`Failed to delete submission: ${getErrorMessage(err)}`)
    }
  }

  if (!assignment)
    return (
      <CenteredSpinner tip={'Loading assessment...'}/>
    )

  return (
    <EmbeddableFeedbackListSkeleton
      courseId={courseId}
      mode={'assignment'}
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
      <Tabs
        tabPosition={'left'}
        destroyOnHidden
        items={assignment.questions.map((question) => ({
          key: String(question.questionId),
          label: question.question.name,
          children: (
            <EmbeddableFeedbackTable
              feedback={answers[question.questionId] ?? []}
              handleDelete={handleDelete}
              loading={loading}
              selectFeedback={setEditingAnswer}
            />
          )
        }))}
      />
    </EmbeddableFeedbackListSkeleton>
  )
}