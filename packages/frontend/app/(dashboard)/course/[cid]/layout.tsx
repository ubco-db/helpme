'use client'
import { use } from 'react'
import { App } from 'antd'

import AlertsContainer from '@/app/components/AlertsContainer'
import { LayoutProps } from '@/app/typings/types'

type CoursePageProps = {
  params: { cid: string }
}

const Layout: React.FC<LayoutProps & CoursePageProps> = (props) => {
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

export default Layout
