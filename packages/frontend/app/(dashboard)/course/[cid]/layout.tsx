'use client'
import { use, useEffect } from 'react'
import useSWR from 'swr'

import AlertsContainer from '@/app/components/AlertsContainer'
import { useAlertsContext } from '@/app/contexts/alertsContext'
import { API } from '@/app/api'

type Params = Promise<{ cid: string }>

export default function Layout(props: {
  children: React.ReactNode
  params: Params
}) {
  const params = use(props.params)

  const { children } = props

  const { cid } = params

  const { setThisCourseAlerts, clearThisCourseAlerts } = useAlertsContext()

  const { data } = useSWR(
    `/api/v1/alerts/course/${cid}`,
    async () => API.alerts.get(Number(cid)),
    { refreshInterval: 60000 },
  )

  useEffect(() => {
    setThisCourseAlerts(data?.alerts ?? [])
  }, [data?.alerts])

  useEffect(() => {
    return () => {
      clearThisCourseAlerts()
    }
  }, [])

  return (
    <>
      <AlertsContainer courseId={Number(cid)} />
      {children}
    </>
  )
}
