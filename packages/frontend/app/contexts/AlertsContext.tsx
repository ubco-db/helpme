'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react'
import { API } from '@/app/api'
import {
  Alert,
  AlertDeliveryMode,
  AlertServerSentEvent,
  AlertServerSentEventType,
  AlertType,
} from '@koh/common'
import { useEventSource } from '../hooks/useEventSource'
import { getErrorMessage } from '../utils/generalUtils'
import { plainToInstance } from 'class-transformer'
import useSWRImmutable from 'swr/immutable'
import { message } from 'antd'

type AlertsContextValue = {
  /** List of all Modal alerts for currentCourseId (modal alerts with `null` courseId will also be included).
  If currentCourseId is null, it will ONLY include modal alerts with `null` courseId.

  When first loading a page (or currentCourseId changes), all modal alerts (limit 20) will be fetched and put here. Then any subsequent
  modal alerts made by the backend will appear here automatically (via EventSource/SSE).
  */
  modalAlerts: Alert[]
  /** List of all Toast alerts (does not care about currentCourseId).
   *
   * When first loading a page (or currentCourseId changes), all toast alerts (limit 20) will be fetched and put here. Then any subsequent
   * toast alerts made by the backend will appear here automatically (via EventSource/SSE).
   */
  toastAlerts: Alert[]
  /** List of all Feed alerts (does not care about currentCourseId)

  When first loading a page (or currentCourseId changes), *most* feed alerts are fetched (limit 100) and put here. Then any subsequent
  feed alerts made by the backend will appear here automatically (via EventSource/SSE).
  Additionally, feed alerts are paginated, where once the currentPageIdx gets close to the end (and that there's more feed alerts to fetch),
  it will auto-fetch the next handful of pages.  
   */
  feedAlerts: Alert[]
  totalFeedAlerts: number
  totalPagesShown: number
  totalUnreadFeedAlerts: number
  feedPaginationLoading: boolean
  initialFetchLoading: boolean
  initialFetchError: any
  currentCourseId: number | undefined
  setCurrentCourseId: (courseId: number | undefined) => void
  /**
   * Used for determining which page of **FEED** alerts to show.
   */
  currentPageIdx: number
  /**
   * Set which page of **FEED** alerts to show. If getting close to the end and there's more feed alerts to fetch, it will fetch more pages.
   */
  setCurrentPageIdx: (pageIdx: number) => void
  /**
   * Used for determining if read at **FEED** alerts should be shown (default = false)
   */
  showReadAtAlerts: boolean
  /**
   * Determines if read at **FEED** alerts should be shown (default = false)
   */
  setShowReadAtAlerts: (showReadAtAlerts: boolean) => void
  markAllFeedAlertsRead: () => Promise<void>
  markAlertRead: (alertId: number) => Promise<void>
  totalFetchedFeedPages: number
  isEventSourceLive: boolean
  /** Registers a callback function that will get ran whenever there is a NEW ALERT. 
    The `key` is just a string used to identify the callback function so that it can be removed later (e.g. "course-clone-handler").
    Make sure to have a `useEffect` with a return statement that runs unregisterNewAlertHandler(key) so that the handler gets removed on unmount!

    Can optionally specify a`deliveryMode` if you only want your handler to run for specific events.
  */
  registerNewAlertHandler: (
    key: string,
    handler: (alert: Alert) => void,
    deliveryMode?: AlertDeliveryMode,
    alertType?: AlertType,
  ) => void
  /** Unregisters a callback function that was previously registered with registerNewAlertHandler.
   *
   * Please put this function in the return cleanup function of a useEffect in your component so
   * that the handler gets removed on unmount!
   */
  unregisterNewAlertHandler: (key: string) => void
}

export const FEED_PAGE_SIZE = 5
const NUM_PAGES_FETCHED = 4

const AlertsContext = createContext<AlertsContextValue | undefined>(undefined)

/** 
  This is the one source of truth that obtains ALL alerts from the backend (both FEED and MODAL and TOAST).
  It will filter based on what course the user is currently on (Need to set with setCurrentCourseId).
*/
export const AlertsProvider: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const [currentCourseId, setCurrentCourseId] = useState<number>()

  const [currentPageIdx, setCurrentPageIdx] = useState(0)
  const [showReadAtAlerts, setShowReadAtAlerts] = useState(false)

  // Allows components to register their own handler functions that run when this receives a NEW_ALERT
  // Note as an idea, you could easily modify this to allow you to specify different event types (new vs update vs delete), but meh I'm lazy and don't want to deal with the different return values of the different event types (e.g. Alert vs Alert[])
  const [newAlertHandlers, setNewAlertHandlers] = useState<
    {
      key: string
      handler: (alert: Alert) => void
      deliveryMode?: AlertDeliveryMode
      alertType?: AlertType
    }[]
  >([])
  const registerNewAlertHandler = useCallback(
    (
      key: string,
      handler: (alert: Alert) => void,
      deliveryMode?: AlertDeliveryMode,
      alertType?: AlertType,
    ) => {
      setNewAlertHandlers((prev) => [
        ...prev,
        { key, handler, deliveryMode, alertType },
      ])
    },
    [setNewAlertHandlers],
  )
  const unregisterNewAlertHandler = useCallback(
    (key: string) => {
      setNewAlertHandlers((prev) => prev.filter((h) => h.key !== key))
    },
    [setNewAlertHandlers],
  )

  // At one point in time I had 3 different state variables: modalAlerts, unreadFeedAlerts, and readAtFeedAlerts.
  // I did this thinking it would reduce the amount of calculations and therefore speed up the frontend.
  // But, most of these calculations are like for loops of less than 100 items, so it's all really fast.
  // And, more importantly, having 3 different state variables opened up A LOT of illegal states, which means the frontend code
  // is A LOT more fragile, and would result in a lot of extra complexity to try to handle the edge cases,
  // like for example if an unreadFeedAlert had a readAt != null alert (should be in readAtAlerts),
  // or if there is a MODAL alert inside unreadFeedAlerts, or vise-versa.

  // Initial fetch (ALL modal alerts (limit 20),MOST feed alerts (limit 100, with unread first))
  // Note that this is COURSE-SPECIFIC and will reset and refetch everything when courseId changes
  const {
    data: alertsData,
    error: initialFetchError,
    isLoading: initialFetchLoading,
    mutate: mutateAlerts,
  } = useSWRImmutable(
    `/api/v1/alerts/initial?courseId=${currentCourseId || -1}`,
    async () => await API.alerts.getMyInitialAlerts(currentCourseId),
  )
  const fetchedAlerts = useMemo(
    () => alertsData?.mostAlerts || [],
    [alertsData],
  )
  const totalFeedAlerts = useMemo(
    () => alertsData?.totalFeedAlerts || 0,
    [alertsData],
  ) // used for finding total number of pages

  useEffect(() => {
    setCurrentPageIdx(0) // make sure to reset the page back to 0 since the total number of pages might've changed
  }, [currentCourseId])

  // Subscribe to sse - note that if the user is using an old browser that doesn't have EventSource, this won't work
  // and they will need to resort to manually refreshing the page to get their alerts.
  const isEventSourceLive = useEventSource(
    `/api/v1/alerts/alerts-sse`, // subscribe to alerts across ALL courses -> Then filter here
    `alerts`,
    useCallback(
      (data: AlertServerSentEvent) => {
        console.log('NEW ALERT DATA:', data)
        console.log('CURRENT COURSE', currentCourseId)
        if (initialFetchLoading) {
          // This is a weird case to think about, but I could see a weird scenario where
          // an SSE event is sent *before* initial alerts is retrieved, where it causes a modal popup to show up,
          // then the user closes it, just for a second popup modal to show up (result of the getInitialAlerts).
          // Thus, I think the best way is to just ignore any SSE events while initialFetch is loading.
          return
        }
        switch (data.eventType) {
          case AlertServerSentEventType.NEW_ALERT: // like 50% of events
            // First, try to find if the alert already exists in frontend state (like from a pre-emptive update). If so, update the existing (just to make sure the state matches EXACTLY as the backend)
            const matchingAlert = fetchedAlerts.find(
              (a) => a.id === data.alert.id,
            )
            if (matchingAlert) {
              mutateAlerts(
                (prev) =>
                  prev
                    ? {
                        ...prev,
                        mostAlerts: prev.mostAlerts.map((a) =>
                          a.id === data.alert.id
                            ? plainToInstance(Alert, data.alert) // Making sure to use plainToInstance otherwise readAt will remain a string instead of a proper Date object
                            : a,
                        ),
                      }
                    : prev,
                { revalidate: false },
              )
            } else {
              console.log('no matching alert found')
              // Doesn't yet exist on the frontend state (most cases)
              if (
                data.alert.deliveryMode === AlertDeliveryMode.TOAST ||
                data.alert.deliveryMode === AlertDeliveryMode.FEED
              ) {
                // toast and feed alerts will always be added regardless of currentCourseId
                mutateAlerts(
                  (prev) =>
                    prev
                      ? {
                          ...prev,
                          mostAlerts: [
                            plainToInstance(Alert, data.alert),
                            ...prev.mostAlerts,
                          ],
                          totalFeedAlerts:
                            data.alert.deliveryMode === AlertDeliveryMode.FEED
                              ? prev.totalFeedAlerts + 1
                              : prev.totalFeedAlerts,
                        }
                      : prev,
                  { revalidate: false },
                )
              } else if (currentCourseId) {
                // if course is selected, only add alerts that are null courseId or the same courseId (only MODAL alerts atm)
                console.log('alertbefore', data.alert)
                console.log('alertafter', plainToInstance(Alert, data.alert))
                if (
                  data.alert.courseId === currentCourseId ||
                  !data.alert.courseId
                ) {
                  mutateAlerts(
                    (prev) =>
                      prev
                        ? {
                            ...prev,
                            mostAlerts: [
                              plainToInstance(Alert, data.alert),
                              ...prev.mostAlerts,
                            ],
                          }
                        : prev,
                    { revalidate: false },
                  )
                }
              } else {
                console.log('not in currentCourseId', data.alert.deliveryMode)
                // if no course is selected (like in /courses page)
                // For modal, ONLY allow alerts with null courseId (so you don't get like 5 different popups about rephrase question or something)
                console.log('MODAL delivery mofde')
                if (!data.alert.courseId) {
                  console.log('Adding new alert:', data)
                  mutateAlerts(
                    (prev) =>
                      prev
                        ? {
                            ...prev,
                            mostAlerts: [
                              plainToInstance(Alert, data.alert),
                              ...prev.mostAlerts,
                            ],
                          }
                        : prev,
                    { revalidate: false },
                  )
                }
              }
            }

            // run any registered handler functions (other components would register them to be ran here)
            newAlertHandlers.forEach(({ handler, deliveryMode, alertType }) => {
              if (deliveryMode && data.alert.deliveryMode !== deliveryMode)
                return
              if (alertType && data.alert.alertType !== alertType) return
              handler(data.alert)
            })
            break
          case AlertServerSentEventType.UPDATE_ALERTS: // The other 50% of events (like for marking an alert as read).
            mutateAlerts(
              (prev) =>
                prev
                  ? {
                      ...prev,
                      mostAlerts: prev.mostAlerts
                        .map((a) => {
                          const matchingUpdatedAlert = data.alerts.find(
                            (updatedAlert) => updatedAlert.id === a.id,
                          )
                          if (matchingUpdatedAlert) {
                            console.log(
                              'Found matching alert:',
                              matchingUpdatedAlert,
                            )
                            // For MODAL or TOAST alerts that became readAt, we remove them from the state
                            // Otherwise (if a modal alert attribute was update that's not readAt, or if a FEED alert became readAt, etc.) we update the local state
                            return (matchingUpdatedAlert.deliveryMode ===
                              AlertDeliveryMode.MODAL ||
                              matchingUpdatedAlert.deliveryMode ===
                                AlertDeliveryMode.TOAST) &&
                              matchingUpdatedAlert.readAt
                              ? null
                              : plainToInstance(Alert, matchingUpdatedAlert)
                          } else {
                            return a
                          }
                        })
                        .filter((alert) => alert !== null),
                    }
                  : prev,
              { revalidate: false },
            )
            // If the event doesn't exist on the frontend state, it probably just currentCourseId isn't the same as the updatedAlert
            break
          // We don't really delete alerts unless via admin
          case AlertServerSentEventType.DELETE_ALERT: // if it's DELETE, alert entity not guaranteed so we filter by alertId here
            mutateAlerts(
              (prev) =>
                prev
                  ? {
                      ...prev,
                      mostAlerts: prev.mostAlerts.filter(
                        (a) => a.id !== data.alertId,
                      ),
                    }
                  : prev,
              { revalidate: false },
            )
            // if not found in the frontend state, it means either:
            // - The user's currentCourseId isn't the same course as the deleted alert (most-likely)
            // - The alert to be removed wasn't fetched yet (like if it was a readAt FEED alert that's on like page 10)
            break
        }
      },
      [initialFetchLoading, fetchedAlerts, mutateAlerts, currentCourseId],
    ),
  )

  const markAlertRead = useCallback(
    async (alertId: number) => {
      // optimistic update
      mutateAlerts(
        (prev) =>
          prev
            ? {
                ...prev,
                mostAlerts: prev.mostAlerts.map(
                  (a) =>
                    a.id === alertId && !a.readAt
                      ? { ...a, readAt: new Date() }
                      : a, // will get updated with the real value from the SSE
                ),
              }
            : prev,
        { revalidate: false },
      )
      await API.alerts.close(alertId).catch((e) => {
        console.error('Failed to mark alert as read: ', e)
        message.error(
          'Failed to mark alert as read: ' +
            getErrorMessage(e) +
            '. Please try again.',
        )
        mutateAlerts(undefined, { revalidate: true }) // reset the state
      })
    },
    [mutateAlerts],
  )

  const markAllFeedAlertsRead = useCallback(async () => {
    // optimistic: mark read for all unread alerts in the feed
    mutateAlerts(
      (prev) =>
        prev
          ? {
              ...prev,
              mostAlerts: prev.mostAlerts.map((a) =>
                !a.readAt ? { ...a, readAt: new Date() } : a,
              ),
            }
          : prev,
      { revalidate: false },
    )
    await API.alerts.markReadAllFeed().catch((e) => {
      console.error('Failed to mark all alerts as read: ', e)
      message.error(
        'Failed to mark all alerts as read: ' +
          getErrorMessage(e) +
          '. Please try again.',
      )
      mutateAlerts(undefined, { revalidate: true }) // reset the state
    })
  }, [mutateAlerts])

  // Yes, I technically don't need useCallback or useMemo anymore now with React 19, but I think I like the explictness of keeping it.
  const feedAlerts = useMemo(() => {
    return fetchedAlerts.filter(
      (a) => a.deliveryMode === AlertDeliveryMode.FEED,
    )
  }, [fetchedAlerts])

  const unreadFeedAlerts = useMemo(() => {
    return feedAlerts.filter((a) => !a.readAt)
  }, [feedAlerts])

  const totalUnreadFeedAlerts = useMemo(() => {
    return unreadFeedAlerts.length
  }, [unreadFeedAlerts.length])

  // const readAtFeedAlerts = useMemo(() => { // not needed I guess. Since we just use the pages in pagesOfFeedAlerts
  //   return feedAlerts.filter((a) => a.readAt)
  // }, [feedAlerts])

  const modalAlerts = useMemo(() => {
    // these modal alerts will always be unread
    return fetchedAlerts.filter(
      (a) => a.deliveryMode === AlertDeliveryMode.MODAL,
    )
  }, [fetchedAlerts])

  const toastAlerts = useMemo(() => {
    // these toast alerts will always be unread
    return fetchedAlerts.filter(
      (a) => a.deliveryMode === AlertDeliveryMode.TOAST,
    )
  }, [fetchedAlerts])

  const totalFetchedFeedPages = useMemo(() => {
    return Math.ceil(feedAlerts.length / FEED_PAGE_SIZE)
  }, [feedAlerts])

  const totalPagesShown = useMemo(() => {
    if (!showReadAtAlerts) {
      // Note that this won't be *entirely* accurate.
      // If the user has more than 100 unreadFeedAlerts, it will show there being 20 pages,
      // but as they get closer to the end, the pagination will automatically fetch more,
      // which ends up increasing the pagination *as they're clicking next page*
      // But this is hyper specific (who has that many alerts??) and it still will work fine, just a little unexpected for the user.
      return Math.ceil(unreadFeedAlerts.length / FEED_PAGE_SIZE)
    } else {
      return Math.ceil(totalFeedAlerts / FEED_PAGE_SIZE)
    }
  }, [showReadAtAlerts, unreadFeedAlerts.length, totalFeedAlerts])

  // Pagination fetcher for FEED alerts (modal alerts don't need pagination, but they are included in the initial fetch)
  const [feedPaginationLoading, setFeedPaginationLoading] = useState(false)
  const handleFetchNextPagesOfFeedAlerts = useEffectEvent(
    (currentPageIdx: number) => {
      if (initialFetchLoading) return // IMPORTANT otherwise this could run during the initial fetch.
      if (feedPaginationLoading) return // prevents concurrent fetches. Technically could be an issue for someone with a slow network spamming the next page button.

      // If on second-to-last page (and there's more alerts left to fetch), eager-fetch the next NUM_PAGES_FETCHED (4) pages
      if (
        currentPageIdx + 1 >= totalFetchedFeedPages - 2 &&
        totalFeedAlerts > fetchedAlerts.length // Don't fetch if we've already fetched everything
      ) {
        setFeedPaginationLoading(true)
        // So getInitialAlerts gets the first 100 alerts, order by readAt NULLS FIRST.
        // And then we use getMyFeedAlerts for subsequent pages (we do 4 pages at a time, so we fetch 20).
        // When a new event is created, SSE will send it here, meaning we will have the first 101 alerts.
        // So our offset for getting the next page will simply be fetchedAlerts.length.
        // However, if for whatever reason an event gets created in the backend but the SSE fails here,
        // the offset will be off: we will have the first 100 alerts so length = 100 = offset, but the newly created alert
        // on the backend becomes the FIRST one (because we do readAt NULLS FIRST), meaning we will end up retrieving
        // an alert we already have.
        // All this is to say that we should not blindly add on the new page of alerts and first verify that it doesn't
        // already exist (you'd want to do that anyway due to duplicate or overlap requests).
        // There's also probably some other edge consequences like this that I haven't yet thought of due to
        // how I architected the initialFetch + SSE + pagination solution.
        // EDIT: oh like if an alert was deleted... though I think I'm still fine, it should work.
        const nextFetchOffset = fetchedAlerts.length
        const limit = FEED_PAGE_SIZE * NUM_PAGES_FETCHED // how many alerts we want to fetch

        API.alerts
          .getMyFeedAlerts(currentCourseId, limit, nextFetchOffset)
          .then((newData) => {
            mutateAlerts(
              (prev) => {
                if (!prev) return prev
                const existingIds = new Set(prev.mostAlerts.map((a) => a.id))
                return {
                  totalFeedAlerts: newData.totalFeedAlerts,
                  mostAlerts: [
                    ...prev.mostAlerts,
                    ...newData.pageOfFeedAlerts.filter(
                      (a) => !existingIds.has(a.id),
                    ),
                  ],
                }
              },
              { revalidate: false },
            )
          })
          .catch((e) => {
            console.error(
              `Failed to fetch pages ${nextFetchOffset / FEED_PAGE_SIZE + 1}-${nextFetchOffset / FEED_PAGE_SIZE + NUM_PAGES_FETCHED} of feed alerts: `,
              e,
            )
            // I would rather *not* need to notify the user, but I don't want to lead to some scenario
            // where the user can't go to the next page because it's erroring and they don't know that it's erroring.
            message.error(
              `Failed to fetch pages ${nextFetchOffset / FEED_PAGE_SIZE + 1}-${nextFetchOffset / FEED_PAGE_SIZE + NUM_PAGES_FETCHED} of feed alerts: ${getErrorMessage(e)}.`,
            )
          })
          .finally(() => {
            setFeedPaginationLoading(false)
          })
      }
    },
  )
  useEffect(() => {
    handleFetchNextPagesOfFeedAlerts(currentPageIdx)
  }, [
    // We ONLY want this handler function running when the currentPageIdx changes.
    // Not even if currentCourseId changes (since when that changes, a separate useEffect hook resets stuff anyways).
    // Thus, we use a useEffectEvent.
    currentPageIdx,
  ])

  const value: AlertsContextValue = {
    modalAlerts,
    toastAlerts,
    feedAlerts,
    totalFeedAlerts,
    totalPagesShown,
    totalUnreadFeedAlerts,
    feedPaginationLoading,
    initialFetchLoading,
    initialFetchError,
    currentCourseId,
    setCurrentCourseId,
    currentPageIdx,
    setCurrentPageIdx,
    showReadAtAlerts,
    setShowReadAtAlerts,
    markAllFeedAlertsRead,
    markAlertRead,
    registerNewAlertHandler,
    unregisterNewAlertHandler,

    // stuff I don't think will be used other than for debugging maybe?
    totalFetchedFeedPages,
    isEventSourceLive,
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

/* Use this if you want to use useAlerts in a component that might be used outside of AlertsContext, such as the HeaderBar */
export const useAlertsOptional = (): AlertsContextValue | undefined => {
  const ctx = useContext(AlertsContext)
  return ctx
}
