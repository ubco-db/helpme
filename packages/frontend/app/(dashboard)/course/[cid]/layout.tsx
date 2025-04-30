'use client'
import { use } from 'react'

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
    <>
      <AlertsContainer courseId={Number(cid)} />
      {children}
    </>
  )
}

export default Layout
