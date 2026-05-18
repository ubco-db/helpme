'use client'

import { use, useEffect, useMemo } from 'react'
import {
  useEmbeddableAssignment,
} from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/context/embeddableAssignmentContext'
import AnswersPageLayoutSkeleton
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/AnswersPageLayoutSkeleton'

export default function Layout(props: {
  params: Promise<{ cid: string }>
  children: React.ReactNode
}) {
  const { children } = props
  const params = use(props.params)
  const courseId = useMemo(() => Number(params.cid), [params.cid])
  
  const { assignment, assignments, setCourseId } = useEmbeddableAssignment()
  useEffect(() => {
    setCourseId(courseId)
  }, [courseId, setCourseId])

  return (
    <AnswersPageLayoutSkeleton
      mode={'assignment'}
      item={assignment}
      courseId={courseId}
      assignments={assignments}
    >
      {children}
    </AnswersPageLayoutSkeleton>
  )
}
