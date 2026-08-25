'use client'
import { use, useEffect } from 'react'

import { useAlerts } from '@/app/contexts/AlertsContext'

type Params = Promise<{ cid: string }>

export default function Layout(props: {
  children: React.ReactNode
  params: Params
}) {
  const params = use(props.params)
  const { children } = props
  const { cid } = params
  const courseId = Number(cid)

  const { setCurrentCourseId } = useAlerts()

  useEffect(() => {
    setCurrentCourseId(courseId)
    return () => {
      setCurrentCourseId(-1)
    }
  }, [courseId, setCurrentCourseId])

  return <>{children}</>
}
