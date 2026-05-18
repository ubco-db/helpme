'use client'

import { ReactElement } from 'react'
import { Divider } from 'antd'
import SelectEmbeddableQuestion
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/SelectEmbeddableQuestion'
import { usePathname, useRouter } from 'next/navigation'
import {
  useEmbeddableQuestion,
} from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/context/embeddableQuestionContext'

export default function EmbeddableQuestionAnswersPage(): ReactElement {
  const router = useRouter()
  const pathname = usePathname()

  const { questions } = useEmbeddableQuestion()

  function onSelect(val: number) {
    router.push(pathname+`/${val}`)
  }

  return (
    <>
      <div className={'flex w-full items-center justify-between'}>
        <h4>No question selected. {questions.length > 0 ? 'Choose one to view results for from the list below.' : 'There are no available questions to select in the course.'}</h4>
      </div>
      <Divider className="my-3" />
      <SelectEmbeddableQuestion
        questions={questions}
        onSelect={onSelect}
      />
    </>
  )
}