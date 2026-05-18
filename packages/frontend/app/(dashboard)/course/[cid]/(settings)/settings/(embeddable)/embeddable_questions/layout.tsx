'use client'

import {
  EmbeddableQuestionProvider,
} from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/context/embeddableQuestionContext'

export default function Layout(props: {
  params: Promise<{ cid: string }>
  children: React.ReactNode
}) {
  const { children} = props
  return (
    <EmbeddableQuestionProvider>
      {children}
    </EmbeddableQuestionProvider>
  )
}