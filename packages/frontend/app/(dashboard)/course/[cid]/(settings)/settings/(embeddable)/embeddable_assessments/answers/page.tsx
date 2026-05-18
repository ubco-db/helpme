'use client'

import { ReactElement } from 'react'
import { Divider } from 'antd'
import { usePathname, useRouter } from 'next/navigation'
import {
  useEmbeddableAssignment,
} from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/context/embeddableAssignmentContext'
import SelectEmbeddableAssignment
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/SelectEmbeddableAssignment'

export default function EmbeddableAssignmentAnswersPage(): ReactElement {
  const router = useRouter()
  const pathname = usePathname()

  const { assignments } = useEmbeddableAssignment()

  function onSelect(val: number) {
    router.push(pathname+`/${val}`)
  }

  return (
    <>
      <div className={'flex w-full items-center justify-between'}>
        <h4>No assessment selected. {assignments.length > 0 ? 'Choose one to view results for from the list below.' : 'There are no available assessments to select in the course.'}</h4>
      </div>
      <Divider className="my-3" />
      <SelectEmbeddableAssignment
        assignments={assignments}
        onSelect={onSelect}
      />
    </>
  )
}