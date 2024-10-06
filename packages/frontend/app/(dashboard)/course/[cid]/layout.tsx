'use client'

import AlertsContainer from '@/app/components/AlertsContainer'
import { LayoutProps } from '@/app/typings/types'

type CoursePageProps = {
  params: { cid: string }
}

const Layout: React.FC<LayoutProps & CoursePageProps> = ({
  children,
  params,
}) => {
  const { cid } = params

  return (
    <>
      <AlertsContainer courseId={Number(cid)} />
      {children}
    </>
  )
}

export default Layout
