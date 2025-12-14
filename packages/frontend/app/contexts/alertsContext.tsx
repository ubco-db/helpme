'use client'

import React, { createContext, useContext, useMemo, useState } from 'react'
import useSWRInfinite from 'swr/infinite'
import { API } from '@/app/api'
import { Alert, AlertDeliveryMode, GetAlertsResponse } from '@koh/common'

type AlertsContextValue = {
  pages: GetAlertsResponse[]
  total: number
  isLoading: boolean
  isValidating: boolean
  size: number
  setSize: (s: number) => void
  mutate: (data?: any, opts?: any) => Promise<any>
  currentPage: number
  setCurrentPage: (p: number) => void
  currentPageAlerts: Alert[]
  markRead: (alertId: number) => Promise<void>
  markAllRead: () => Promise<void>
  pageSize: number
  // course-level alerts state (populated by course layout)
  thisCourseAlerts: Alert[]
  setThisCourseAlerts: (alerts: Alert[]) => void
  clearThisCourseAlerts: () => void
  closeCourseAlert: (alertId: number) => Promise<void>
}

const AlertsContext = createContext<AlertsContextValue | undefined>(undefined)

export const AlertsProvider: React.FC<{
  children: React.ReactNode
  pageSize?: number
}> = ({ children, pageSize = 5 }) => {
  const { data, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite(
      (index) => ['alerts-feed', index, pageSize],
      async ([, indexKey, ps]) =>
        API.alerts.getAll(
          AlertDeliveryMode.FEED,
          false,
          ps as number,
          (indexKey as number) * (ps as number),
        ),
      { revalidateOnFocus: true },
    )

  const [currentPage, setCurrentPage] = useState(0)
  const pages = data ?? []
  const total = pages[0]?.total ?? 0
  const currentPageAlerts: Alert[] = pages[currentPage]?.alerts ?? []

  // course-level alerts
  const [thisCourseAlerts, setThisCourseAlertsState] = useState<Alert[]>([])
  const setThisCourseAlerts = (alerts: Alert[]) =>
    setThisCourseAlertsState(alerts)
  const clearThisCourseAlerts = () => setThisCourseAlertsState([])

  const markRead = async (alertId: number) => {
    // optimistic: remove from current page and decrement total
    mutate(
      (currentPages: GetAlertsResponse[] | undefined) =>
        currentPages
          ? currentPages.map((page, idx) => ({
              ...page,
              alerts:
                idx === currentPage && Array.isArray(page.alerts)
                  ? page.alerts.filter((a) => a.id !== alertId)
                  : page.alerts,
              total:
                idx === 0 && typeof page.total === 'number'
                  ? Math.max(0, (page.total ?? 0) - 1)
                  : page.total,
            }))
          : currentPages,
      { revalidate: false },
    )
    try {
      await API.alerts.close(alertId)
    } finally {
      await mutate(undefined, { revalidate: true })
    }
  }

  const markAllRead = async () => {
    // optimistic: clear all and set total 0
    mutate(
      (currentPages: GetAlertsResponse[] | undefined) =>
        currentPages
          ? currentPages.map((p, idx) => ({
              ...p,
              alerts: [],
              total: idx === 0 ? 0 : p.total,
            }))
          : currentPages,
      { revalidate: false },
    )
    try {
      await API.alerts.markReadAll()
    } finally {
      await mutate(undefined, { revalidate: true })
    }
  }

  const closeCourseAlert = async (alertId: number) => {
    // optimistic removal from course-level alerts, and refresh feed afterwards
    setThisCourseAlertsState((prev) => prev.filter((a) => a.id !== alertId))
    try {
      await API.alerts.close(alertId)
    } finally {
      await mutate(undefined, { revalidate: true })
    }
  }

  const value = useMemo<AlertsContextValue>(
    () => ({
      pages,
      total,
      isLoading,
      isValidating,
      size,
      setSize,
      mutate,
      currentPage,
      setCurrentPage,
      currentPageAlerts,
      markRead,
      markAllRead,
      pageSize,
      thisCourseAlerts,
      setThisCourseAlerts,
      clearThisCourseAlerts,
      closeCourseAlert,
    }),
    [
      pages,
      total,
      isLoading,
      isValidating,
      size,
      setSize,
      mutate,
      currentPage,
      currentPageAlerts,
      pageSize,
      thisCourseAlerts,
    ],
  )

  return (
    <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
  )
}

export const useAlertsContext = (): AlertsContextValue => {
  const ctx = useContext(AlertsContext)
  if (!ctx)
    throw new Error('useAlertsContext must be used within AlertsProvider')
  return ctx
}
