'use client'

import {
  EmbeddableAssignmentProvider,
} from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/context/embeddableAssignmentContext'

export default function Layout(props: {
  params: Promise<{ cid: string }>
  children: React.ReactNode
}) {
  const { children} = props
  return (
    <EmbeddableAssignmentProvider>
      {children}
    </EmbeddableAssignmentProvider>
  )
}