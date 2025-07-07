'use client'
import { use } from 'react'
import { App } from 'antd'

import AlertsContainer from '@/app/components/AlertsContainer'

type Params = Promise<{ cid: string }>

export default function Layout(props: {
  children: React.ReactNode
  params: Params
}) {
  const params = use(props.params)

  const { children } = props

  const { cid } = params

  return (
    <App>
      <AlertsContainer courseId={Number(cid)} />
      {children}
    </App>
  )
}
