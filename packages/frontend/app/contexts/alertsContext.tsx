'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import useSWRInfinite, { SWRInfiniteKeyedMutator } from 'swr/infinite'
import { API } from '@/app/api'
import {
  Alert,
  AlertDeliveryMode,
  AlertServerSentEvent,
  AlertServerSentEventType,
} from '@koh/common'
import { useEventSource } from '../hooks/useEventSource'
import { getErrorMessage } from '../utils/generalUtils'
import { plainToInstance } from 'class-transformer'

type AlertsContextValue = {
  pages: GetAlertsResponse[]
  totalAlerts: number
  totalAlertsUnread: number
  isLoading: boolean
  isValidating: boolean
  mutateAlertPages: SWRInfiniteKeyedMutator<GetAlertsResponse[]> // it's an array because each element corresponds to a page (so, an array of responses)
  currentPage: number
  setCurrentPage: (p: number) => void
  currentPageAlerts: Alert[]
  markAlertRead: (alertId: number) => Promise<void>
  markAllAlertsRead: () => Promise<void>
  pageSize: number
  // populated by course layout to select a different courseId
  setCurrentCourseId: (courseId: number) => void
}

const FEED_PAGE_SIZE = 5

const AlertsContext = createContext<AlertsContextValue | undefined>(undefined)

/* 
  This is the one source of truth that obtains all FEED alerts from the backend.
  It will filter based on what course the user is currently on.
*/
export const AlertsProvider: React.FC<{
  children: React.ReactNode
  pageSize?: number
}> = ({ children, pageSize = 5 }) => {
  const [currentCourseId, setCurrentCourseId] = useState<number>()

  // These will swap out depending on what course the user is currently in (logic for filtering on the backend).
  // So, I decided to split out the states like this to reduce the amount of sorting and filtering needed on the frontend by sorta doing it on the backend.
  // I realise that because of this, it creates a bunch of illegal states :(
  // For example:
  // I can have unreadFeedAlerts with readAt != null (should be in readAtAlerts)
  // Or I could have MODAL alerts inside undreadFeedAlerts, or vise-versa.
  //
  // So, I could see a pretty strong case for merging readAtFeedAlerts with unreadFeedAlerts and modalAlerts to reduce illegal states,
  // but that would come with a slight performance cost on the frontend here, which could add up to a LOT if lots of re-renderings are happening in this component (probably shouldn't happen actually but meh).
  //
  const [unreadFeedAlerts, setUnreadFeedAlerts] = useState<Alert[]>([])
  const [modalAlerts, setModalAlerts] = useState<Alert[]>([])
  const [readAtFeedAlerts, setReadAtFeedAlerts] = useState<Alert[]>([])
  const [totalUnreadFeedAlerts, setTotalUnreadFeedAlerts] = useState<number>(0)
  const [totalReadAtFeedAlerts, setTotalReadAtFeedAlerts] = useState<number>(0)
  const [initialFetchLoading, setInitialFetchLoading] = useState<boolean>(true)

  const [currentPage, setCurrentPage] = useState(0)
  const pages = data || []
  const totalAlerts = pages[0]?.totalAlerts || 0
  const totalAlertsUnread = pages[0]?.totalAlertsUnread || 0
  const currentPageAlerts: Alert[] =
    currentPage >= 0 && currentPage < pages.length
      ? pages[currentPage].alerts
      : []

  // some helper functions
  const updateAlertState = useCallback(
    (alert: Alert) => {
      const matchingUnreadAlert = unreadFeedAlerts.find(
        (a) => a.id === alert.id && !a.readAt,
      )
      const matchingReadAtAlert = readAtFeedAlerts.find(
        (a) => a.id === alert.id && a.readAt,
      )
      if (matchingUnreadAlert) {
        if (alert.readAt) {
          setUnreadFeedAlerts((prev) => prev.filter((a) => a.id !== alert.id))
          setReadAtFeedAlerts((prev) => [alert, ...prev])
          setTotalUnreadFeedAlerts((prev) => prev - 1)
          setTotalReadAtFeedAlerts((prev) => prev + 1)
        } else {
          setUnreadFeedAlerts((prev) =>
            prev.map((a) => (a.id === alert.id ? alert : a)),
          )
        }
      } else if (matchingReadAtAlert) {
        setReadAtFeedAlerts((prev) =>
          prev.map((a) => (a.id === alert.id ? alert : a)),
        )
      } else if (matchingUnreadAlert && matchingReadAtAlert) {
        setUnreadFeedAlerts((prev) => prev.filter((a) => a.id !== alert.id))
        setReadAtFeedAlerts((prev) => [alert, ...prev])
        setTotalUnreadFeedAlerts((prev) => prev - 1)
        setTotalReadAtFeedAlerts((prev) => prev + 1)
      }
    },
    [unreadFeedAlerts, readAtFeedAlerts],
  )

  // Initial fetch (ALL modal alerts (limit 20), ALL unread feed alerts (limit 100), 20 readAt alerts)
  useEffect(() => {
    setInitialFetchLoading(true)
    API.alerts
      .getMyInitialAlerts(currentCourseId)
      .then((data) => {
        // Note that this is COURSE-SPECIFIC and will reset and refetch everything when courseId changes
        setModalAlerts(data.unreadModalAlerts)
        setUnreadFeedAlerts(data.unreadFeedAlerts)
        setReadAtFeedAlerts(data.someReadAtFeedAlerts)
        setTotalUnreadFeedAlerts(data.totalUnreadFeedAlerts)
        setTotalReadAtFeedAlerts(data.totalReadAtFeedAlerts)
      })
      .catch((err) => {
        console.error(
          `Error fetching initial alerts for course ${currentCourseId}: ${getErrorMessage(err)}`,
        )
      })
      .finally(() => {
        setInitialFetchLoading(false)
      })
    return () => {
      setModalAlerts([])
      setUnreadFeedAlerts([])
      setReadAtFeedAlerts([])
      setTotalUnreadFeedAlerts(0)
      setTotalReadAtFeedAlerts(0)
      setCurrentPage(0) // make sure to reset the page back to 0
      setInitialFetchLoading(true)
    }
  }, [currentCourseId])

  // Subscribe to sse
  const isLive = useEventSource(
    `/api/v1/alerts/sse`, // subscribe to alerts across ALL courses -> Then filter here
    `alerts`,
    useCallback(
      (data: AlertServerSentEvent) => {
        if (initialFetchLoading) {
          // This is a weird case to think about, but I could see a weird scenario where
          // an SSE event is sent *before* initial alerts is retrieved, where it causes a modal popup to show up,
          // then the user closes it, just for a second popup modal to show up (result of the getInitialAlerts).
          // Thus, I think the best way is to just ignore any SSE events while initialFetch is loading.
          return
        }
        switch (data.eventType) {
          case AlertServerSentEventType.NEW_ALERT: // like 95% of events
            if (data.alert.readAt) {
              // We are assuming NEW_ALERTs are always unread to make things easier for ourselves (because something wack would've happened otherwise).
              console.warn(
                'NEW_ALERT: Alert ' +
                  data.alert.id +
                  ' was found with the readAt state inside NEW_ALERT case',
              )
              return
            }
            if (readAtFeedAlerts.find((a) => a.id === data.alert.id)) return // Likewise, if some other part of the frontend added an already readAt alert to the state, then some bad piece of code set the wrong state.

            // First, try to find if the alert already exists in frontend state (like from a pre-emptive update). If so, update the existing (just to make sure the state matches EXACTLY as the backend)
            const matchingUnreadAlert = unreadFeedAlerts.find(
              (a) => a.id === data.alert.id,
            )
            if (matchingUnreadAlert) {
              setUnreadFeedAlerts((prev) =>
                prev.map((a) =>
                  a.id === data.alert.id
                    ? plainToInstance(Alert, data.alert)
                    : a,
                ),
              ) // Making sure to use plainToInstance otherwise readAt will remain a string instead of a proper Date object
            } else {
              // Doesn't yet exist on the frontend state
              if (currentCourseId) {
                // if course is selected, only add alerts that are null courseId or the same courseId
                if (
                  data.alert.courseId === currentCourseId ||
                  !data.alert.courseId
                ) {
                  switch (data.alert.deliveryMode) {
                    case AlertDeliveryMode.MODAL:
                      setModalAlerts((prev) => [data.alert, ...prev])
                      break
                    case AlertDeliveryMode.FEED:
                      if (data.alert.readAt) {
                        setReadAtFeedAlerts((prev) => [data.alert, ...prev]) // should never happen but just in case
                        setTotalReadAtFeedAlerts((prev) => prev + 1)
                      } else {
                        setUnreadFeedAlerts((prev) => [data.alert, ...prev])
                        setTotalUnreadFeedAlerts((prev) => prev + 1)
                      }
                      break
                  }
                }
              } else {
                // if no course is selected (like in /courses page)
                switch (data.alert.deliveryMode) {
                  case AlertDeliveryMode.MODAL: // For modal, ONLY allow alerts with null courseId (so you don't get like 5 different popups about rephrase question or something)
                    if (!data.alert.courseId) {
                      setModalAlerts((prev) => [data.alert, ...prev])
                    }
                    break
                  case AlertDeliveryMode.FEED: // For feed, just allow alerts from ALL courses (or null)
                    if (data.alert.readAt) {
                      setReadAtFeedAlerts((prev) => [data.alert, ...prev]) // should never happen but just in case
                      setTotalReadAtFeedAlerts((prev) => prev + 1)
                    } else {
                      setUnreadFeedAlerts((prev) => [data.alert, ...prev])
                      setTotalUnreadFeedAlerts((prev) => prev + 1)
                    }
                    break
                }
              }
            }
            break
          case AlertServerSentEventType.MARK_READ: // The other 5% of events.
            switch (data.alert.deliveryMode) {
              case AlertDeliveryMode.MODAL:
                setModalAlerts((prev) =>
                  prev.map((a) =>
                    a.id === data.alert.id ? { ...a, readAt: new Date() } : a,
                  ),
                )
                break
              case AlertDeliveryMode.FEED:
                const matchingUnreadAlert = unreadFeedAlerts.find(
                  (a) => a.id === data.alert.id && !a.readAt,
                )
                const matchingReadAtAlert = readAtFeedAlerts.find(
                  (a) => a.id === data.alert.id && a.readAt,
                ) // Shouldn't happen unless the frontend preemptively updated the state here
                if (matchingUnreadAlert) {
                  // okay great, let's just update the state
                  // remove from unread alerts
                  setUnreadFeedAlerts((prev) =>
                    prev.filter((a) => a.id !== data.alert.id),
                  )
                  setTotalUnreadFeedAlerts((prev) => prev - 1)
                  // add to readAt alerts
                  setReadAtFeedAlerts((prev) => [
                    ...prev,
                    {
                      ...matchingUnreadAlert,
                      readAt: new Date(data.alert.readAt || Date.now()),
                    },
                  ])
                  setTotalReadAtFeedAlerts((prev) => prev + 1)
                } else if (matchingReadAtAlert) {
                  // Means that frontend state was already updated
                  // just update the readAt to be the same as what it is on the backend
                  setReadAtFeedAlerts((prev) =>
                    prev.map((a) =>
                      a.id === data.alert.id
                        ? {
                            ...a,
                            readAt: new Date(data.alert.readAt || Date.now()),
                          }
                        : a,
                    ),
                  )
                  setTotalReadAtFeedAlerts((prev) => prev + 1)
                } else if (matchingUnreadAlert && matchingReadAtAlert) {
                  console.warn(
                    "Same alert found in both unreadAlerts and readAlerts. This means that there's a setState messing something up somewhere! Resetting the state to what it should be.",
                  )
                  setUnreadFeedAlerts((prev) =>
                    prev.filter((a) => a.id !== data.alert.id),
                  )
                  setTotalUnreadFeedAlerts((prev) => prev - 1)
                  setReadAtFeedAlerts((prev) =>
                    prev.map((a) =>
                      a.id === data.alert.id
                        ? {
                            ...a,
                            readAt: new Date(data.alert.readAt || Date.now()),
                          }
                        : a,
                    ),
                  )
                  setTotalReadAtFeedAlerts((prev) => prev + 1)
                }
                // If the alert isn't found, then that means the selected course is probably different
                break
            }
            break
          // We don't really delete alerts unless via admin
          case AlertServerSentEventType.DELETE_ALERT: // if it's DELETE, alert entity not guaranteed so we filter by alertId here
            const unreadFeedAlertToBeRemoved = unreadFeedAlerts.find(
              (a) => a.id === data.alertId,
            )
            const readAtFeedAlertToBeRemoved = readAtFeedAlerts.find(
              (a) => a.id === data.alertId,
            )
            const modalAlertToBeRemoved = modalAlerts.find(
              (a) => a.id === data.alertId,
            )
            if (unreadFeedAlertToBeRemoved) {
              setUnreadFeedAlerts((prev) =>
                prev.filter((a) => a.id !== data.alertId),
              )
            }
            if (readAtFeedAlertToBeRemoved) {
              setReadAtFeedAlerts((prev) =>
                prev.filter((a) => a.id !== data.alertId),
              )
            }
            if (modalAlertToBeRemoved) {
              setModalAlerts((prev) =>
                prev.filter((a) => a.id !== data.alertId),
              )
            }
            // if not found in the frontend state, it means either:
            // - The user's currentCourseId isn't the same course as the deleted alert (most-likely)
            // - The alert to be removed wasn't fetched yet (like if it was a readAt FEED alert that's on like page 10)
            break
        }
      },
      [
        initialFetchLoading,
        currentCourseId,
        unreadFeedAlerts,
        readAtFeedAlerts,
        modalAlerts,
      ],
    ),
  )

  const pagesOfAlerts = useMemo(() => {
    const sortedAlerts: Alert[] = unreadFeedAlerts
      .concat(readAtFeedAlerts)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime()) // sort by sentAt DESC

    const totalPages = Math.ceil(sortedAlerts.length / FEED_PAGE_SIZE)
    const pages: Alert[][] = new Array(totalPages)

    for (
      let i = 0, pageIndex = 0;
      i < sortedAlerts.length;
      i += FEED_PAGE_SIZE, pageIndex++
    ) {
      pages[pageIndex] = sortedAlerts.slice(i, i + FEED_PAGE_SIZE) // put into chunks/pages
    }
    return pages
  }, [unreadFeedAlerts, readAtFeedAlerts])

  const markAlertRead = async (alertId: number) => {
    // optimistic: mark read for current page and decrement from totalAlertsUnread
    mutate(
      (currentPages) =>
        currentPages
          ? currentPages.map((page, idx) => ({
              ...page,
              alerts:
                idx === currentPage
                  ? page.alerts.map((a) =>
                      a.id === alertId && !a.readAt
                        ? { ...a, readAt: new Date() }
                        : a,
                    )
                  : page.alerts,
              totalAlertsUnread:
                idx === 0 // only update page 0 since that's the one we use to display totalAlertsUnread
                  ? Math.max(0, page.totalAlertsUnread - 1)
                  : page.totalAlertsUnread,
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

  const markAllAlertsRead = async () => {
    // optimistic: mark read for all unread alerts in the feed, and set totalAlertsUnread to 0
    mutate(
      (currentPages) =>
        currentPages
          ? currentPages.map((page, idx) => ({
              ...page,
              alerts: page.alerts.map((a) =>
                !a.readAt ? { ...a, readAt: new Date() } : a,
              ),
              totalAlertsUnread: idx === 0 ? 0 : page.totalAlertsUnread, // only update page 0 since that's the one we use to display totalAlertsUnread
            }))
          : currentPages,
      { revalidate: false },
    )
    try {
      await API.alerts.markReadAllFeed()
    } finally {
      await mutate(undefined, { revalidate: true })
    }
  }

  const value: AlertsContextValue = {
    pages,
    totalAlerts,
    totalAlertsUnread,
    isLoading,
    isValidating, // probably not needed but i'll keep it here anyway
    mutateAlertPages: mutate,
    currentPage,
    setCurrentPage,
    currentPageAlerts,
    markAlertRead,
    markAllAlertsRead,
    pageSize,
    setCurrentCourseId,
  }

  return (
    <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
  )
}

export const useAlerts = (): AlertsContextValue => {
  const ctx = useContext(AlertsContext)
  if (!ctx) throw new Error('useAlerts must be used within AlertsProvider')
  return ctx
}
