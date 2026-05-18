'use client'

import { use, useEffect, useMemo } from 'react'
import { useEmbeddableQuestion } from '../../context/embeddableQuestionContext'
import AnswersPageLayoutSkeleton
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/AnswersPageLayoutSkeleton'

export default function Layout(props: {
  params: Promise<{ cid: string }>
  children: React.ReactNode
}) {
  const { children } = props
  const params = use(props.params)
  const courseId = useMemo(() => Number(params.cid), [params.cid])

  const { question, questions, setCourseId } = useEmbeddableQuestion()
  useEffect(() => {
    setCourseId(courseId)
  }, [courseId, setCourseId])

  return (
    <AnswersPageLayoutSkeleton
      mode={'question'}
      item={question}
      courseId={courseId}
      questions={questions}
    >
      {children}
    </AnswersPageLayoutSkeleton>
  )
}
