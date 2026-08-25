import React, { useEffect, useEffectEvent } from 'react'
import { ExternalToast, toast, Toaster, ToastT, useSonner } from 'sonner'
import { useAlerts } from '../contexts/AlertsContext'
import {
  Alert,
  AlertPayloadToast,
  AlertType,
  ChatbotDocumentProcessedPayload,
  CloneCoursePayload,
  ToastType,
} from '@koh/common'
import Link from 'next/link'
import { useUserInfo } from '../contexts/userContext'

const commonToastProps: ExternalToast = {
  richColors: true,
  dismissible: true,
  closeButton: true,
}

/** Fulfils two purposes:
  - Handles all TOAST alerts (from AlertsContext) and converts them into sonner toasts (similar idea with ModalAlertsContainer)
    - Also has some custom logic for handling different events:
      - SUCCESS CHATBOT DOCUMENT PROCESSED toasts will merge into one
      - SUCCESS COURSE_CLONED will update userInfo context of the newly cloned course
  - Has a <Toaster> component, meaning you can import sonner `toast` from 'sonner' and use `toast.info/error/success/etc.` (if you wanted something different instead of antd's `message`)
*/
export const ToastAlertsContainer: React.FC = () => {
  const { setUserInfo } = useUserInfo()

  const { toasts } = useSonner()
  const { toastAlerts, markAlertRead } = useAlerts()

  // We create/update/delete the toasts whenever toastAlerts changes
  const handleToastAlertsChange = useEffectEvent(
    (updatedToastAlerts: Alert[]) => {
      /* For handling the single merged Document Processed toast, this is the logic:
      1. Determine if we even need a merged DPSuccess toast. If not, we just create the toast like normal.
      2. If there are multiple DPSuccess alerts, we run toast.success() only once where the description
          contains all filenames and the event handlers dismisses all alerts.
      3. If there's already an existing DPSuccess alert with a toast, we make sure to re-use that one,
          since toast.success({id: existingId}) will update the existing toast rather than create a new one.
      */
      const { mainDPSuccessAlert, extraDPSuccessAlerts } = getDPSuccessAlerts(
        updatedToastAlerts,
        toasts,
      )

      /* Assuming I got my logic right,
       *   extraDPSuccessAlerts, newAlertsToMakeToast, and toastsToDismiss should have absolutely NO overlap.
       */
      const newAlertsToMakeToast = updatedToastAlerts.filter((alert) => {
        const alreadyHasToast = toasts.some((t) => t.id === alert.id)
        const isThereOnlyOneDPSuccessToast = extraDPSuccessAlerts.length === 0
        const isDPSuccessToast =
          alert.alertType === AlertType.CHATBOT_DOCUMENT_PROCESSED &&
          (alert.payload as ChatbotDocumentProcessedPayload).toastType ===
            ToastType.SUCCESS
        return (
          !alreadyHasToast &&
          (!isDPSuccessToast || isThereOnlyOneDPSuccessToast) &&
          !alert.readAt
        )
      })
      // If there's a toast who doesn't have a corresponding alert, the alert was either deleted or read, so we can dismiss it here
      const toastsToDismiss = toasts.filter((t) => {
        const hasCorrespondingAlert = updatedToastAlerts.some(
          (alert) => alert.id === t.id,
        )
        return !hasCorrespondingAlert
      })

      //
      // UPSERT DPSuccess TOAST
      //
      if (mainDPSuccessAlert && extraDPSuccessAlerts.length > 0) {
        upsertDPSuccessToast({
          mainAlert: mainDPSuccessAlert,
          extraAlerts: extraDPSuccessAlerts,
          markAlertRead,
        })
      }
      //
      // DISMISS TOASTS
      //
      for (const t of toastsToDismiss) {
        // Since the alert doesn't exist in the state anymore, we want to remove the onDismiss() handler
        // since otherwise it's going to activate and try markRead an alert that's already read.
        toast(t.title, {
          ...t,
          onDismiss: () => {},
          onAutoClose: () => {},
        })
        toast.dismiss(t.id)
      }
      //
      // CREATE TOASTS
      //
      for (const alert of newAlertsToMakeToast) {
        const payload = alert.payload as AlertPayloadToast

        const toastOptions: ExternalToast = {
          ...commonToastProps,
          description: (
            <>
              {/*
              I decided against putting the course name Tag here since it looks kinda bad
              due to how the toasts being coloured already. But maybe I'll leave it here (since it *does* work)
              in case there's another idea for it.
              {alert.courseName && alert.courseId && <Tag
                color={stringToAntdTagColor(alert.courseName)}
                bordered={false}
                className={`text-xs transition-opacity hover:opacity-80 focus:opacity-80 active:opacity-80`}
              >
                <Link href={`/course/${alert.courseId}`}>
                  {alert.courseName}
                </Link>
              </Tag>} */}
              <p>{payload.description}</p>
            </>
          ),
          id: alert.id,
          onDismiss: () => {
            console.log('onDismiss()', alert)
            markAlertRead(alert.id)
          },
          onAutoClose: () => {
            console.log('onAutoClose()', alert)
            markAlertRead(alert.id)
          },
          position: payload.position || 'bottom-left',
          duration: payload.durationMs || Infinity,
          action:
            alert.alertType === AlertType.CHATBOT_DOCUMENT_PROCESSED ? (
              // If you update this, don't forget to also update the `action` inside successToastToUpdate down below
              <Link
                href={`/course/${alert.courseId}/settings/chatbot_knowledge_base`}
                onClick={() => markAlertRead(alert.id)}
                className="ml-auto text-nowrap"
              >
                View
              </Link>
            ) : alert.alertType === AlertType.COURSE_CLONED &&
              (alert.payload as CloneCoursePayload).toastType ===
                ToastType.SUCCESS ? (
              <Link
                href={`/course/${(alert.payload as CloneCoursePayload).newCourseId}`}
                onClick={() => markAlertRead(alert.id)}
                className="ml-auto text-nowrap"
              >
                View
              </Link>
            ) : undefined,
        }
        switch (payload.toastType) {
          case ToastType.ERROR:
            toast.error(payload.title, toastOptions)
            break
          case ToastType.INFO:
            toast.info(payload.title, toastOptions)
            break
          case ToastType.SUCCESS:
            toast.success(payload.title, toastOptions)
            break
          case ToastType.WARNING:
            toast.warning(payload.title, toastOptions)
            break
          default:
            toast(payload.title, toastOptions)
            break
        }

        // whenever a new TOAST notification is created notifying about a new cloned course, add it to the UserInfo context
        if (
          alert.alertType === AlertType.COURSE_CLONED &&
          (payload as AlertPayloadToast).toastType === ToastType.SUCCESS
        ) {
          const newUserCourse = (payload as CloneCoursePayload).newUserCourse
          if (newUserCourse) {
            setUserInfo((prev) => {
              const alreadyExists = prev.courses.some(
                (c) => c.course.id === newUserCourse.course.id,
              )
              if (alreadyExists) return prev
              return {
                ...prev,
                courses: [...prev.courses, newUserCourse],
              }
            })
          }
        }
      }
    },
  )
  useEffect(() => {
    // Needed to put inside useEffectEvent since we want this useEffect to run whenever toastAlerts
    // changes but not when useSonner's `toasts` changes, but we still need updated `toasts` values.
    handleToastAlertsChange(toastAlerts)
  }, [toastAlerts])

  return (
    <Toaster
      position="bottom-left"
      toastOptions={{
        className: 'rounded p-4 text-md font-semibold min-h-18 w-96',
      }}
    />
  )
}

/** Adds or updates existing Document Processed Success toast.
 *
 * Note: When modifying updating existing Document Processed Success alerts, we NEED the full list of alerts
 * to add to the description. We cannot simply directly append more HTML to the existing description (without a lot of jank).
 * This is one of the reasons why merging Document Processed Success toasts was done this way.
 * Other reasons:
 * - When loading the page for the first time where there's a bunch of new alerts to turn into toasts, we NEED
 * to do a **single** toast.success() call with the correct configurations.
 * We cannot loop through newAlertsToCreate and then check if there's an existing DPSuccess toast to add to
 * since all `toast()` calls seem to be batched together (i.e. the `toasts` state doesn't update until all toast() calls are done).
 * There's ways around this but it's jank and I'm pretty confident will result in even buggier behaviour.
 * - updatedToastAlerts can have several DPSuccess alerts at the same time (e.g. from refreshing the page - which fetches a list of all alerts)
 * But it could also be just adding one DPSuccess alert to the already-existing toast.
 * I figured out this latter case first before realising it didn't work when refreshing the page.
 *
 * There's more reasons but I was stuck working through this for a while (to come up with something that isn't entirely spaghetti).
 *
 *
 * Look at the top of handleToastAlertsChange for an overview of what's going on.
 */
function upsertDPSuccessToast({
  mainAlert,
  extraAlerts,
  markAlertRead,
}: {
  mainAlert: Alert
  extraAlerts: Alert[]
  markAlertRead: (alertId: number) => void
}) {
  const payload = mainAlert.payload as ChatbotDocumentProcessedPayload
  const markAllTheseAlertsRead = () => {
    markAlertRead(mainAlert.id)
    extraAlerts.forEach((alert) => {
      markAlertRead(alert.id)
    })
  }
  toast.success(payload.title, {
    ...commonToastProps,
    id: mainAlert.id, // if the ID matches an existing toast, it updates it instead of creating a new one.
    onDismiss: markAllTheseAlertsRead,
    onAutoClose: markAllTheseAlertsRead,
    action: (
      <Link
        href={`/course/${mainAlert.courseId}/settings/chatbot_knowledge_base`}
        onClick={() => markAllTheseAlertsRead()}
        className="ml-auto text-nowrap"
      >
        View
      </Link>
    ),
    description: (
      <>
        <p>{extraAlerts.length + 1} documents were successfully processed:</p>
        <ul className="max-h-32 list-inside list-disc overflow-y-auto">
          <li key={mainAlert.id}>{payload.documentName}</li>
          {extraAlerts.map((alert) => {
            const payload = alert.payload as ChatbotDocumentProcessedPayload
            return <li key={alert.id}>{payload.documentName}</li>
          })}
        </ul>
      </>
    ),
    position: payload.position || 'bottom-left',
    duration: payload.durationMs || Infinity,
  })
}

/** Helper function that gets the main SUCCESS CHATBOT_DOCUMENT_PROCESSED alert and a list of extra
 * alerts to append onto it (that way, we ensure there's only 1 toast instead of spamming the user with a 
 * million toasts when doing a bulk upload).
 * 
 * Important: *Because* we don't store the alert ids of all the toast alerts within the toast itself, the toast
 * is going to get updated every time the toastAlerts changes (some unnecessary re-runs). 
 * Though luckily this shouldn't be too bad, since the only case I could actually see this being an issue is if
 * someone uploaded some chatbot documents and then got a toast alert from someplace else (admin alert, clone course).
 * But again, it'd just be re-running Sonner's update toast method with the same attributes, so it shouldn't really be an issue.
 * 
  
Look at the top of handleToastAlertsChange for an overview of what's going on.
*/
function getDPSuccessAlerts(
  updatedToastAlerts: Alert[],
  toasts: ToastT[],
): {
  mainDPSuccessAlert: Alert | undefined
  extraDPSuccessAlerts: Alert[]
} {
  const DPSuccessAlerts = updatedToastAlerts.filter(
    (a) =>
      a.alertType === AlertType.CHATBOT_DOCUMENT_PROCESSED &&
      (a.payload as ChatbotDocumentProcessedPayload).toastType ===
        ToastType.SUCCESS &&
      !a.readAt,
  )

  if (DPSuccessAlerts.length === 0) {
    return {
      mainDPSuccessAlert: undefined,
      extraDPSuccessAlerts: [],
    }
  } else if (DPSuccessAlerts.length === 1) {
    return {
      mainDPSuccessAlert: DPSuccessAlerts[0],
      extraDPSuccessAlerts: [],
    }
  } else {
    // before deciding the mainAlert, first look through toasts.
    // If there's already a DPSuccess toast, then that's the main one and we should just add on to that one.
    const existingMainDPSuccessAlert = DPSuccessAlerts.find((alert) => {
      return toasts.some((t) => t.id === alert.id)
    })

    if (existingMainDPSuccessAlert) {
      return {
        mainDPSuccessAlert: existingMainDPSuccessAlert,
        extraDPSuccessAlerts: DPSuccessAlerts.filter(
          (alert) => alert.id !== existingMainDPSuccessAlert.id,
        ),
      }
    } else {
      return {
        mainDPSuccessAlert: DPSuccessAlerts[0],
        extraDPSuccessAlerts: DPSuccessAlerts.slice(1),
      }
    }
  }
}
