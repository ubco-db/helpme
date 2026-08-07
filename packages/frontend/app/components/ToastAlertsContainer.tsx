import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useEffectEvent,
} from 'react'
import { ExternalToast, toast, Toaster, useSonner } from 'sonner'
import { getErrorMessage } from '../utils/generalUtils'
import { useAlerts } from '../contexts/AlertsContext'
import {
  Alert,
  AlertPayloadToast,
  AlertType,
  CloneCoursePayload,
  TOAST_ALERT_TYPES,
  ToastType,
} from '@koh/common'
import Link from 'next/link'
import { useUserInfo } from '../contexts/userContext'

/**
 * This file contains a context that allows for running async api calls with a callback
 * so that the callback can be used to update the UI with the result of the api call
 * regardless of the page the user is on.
 */

type AsyncCallback = (result: any, error?: any) => void
type NotifyOptions = {
  successMsg: string
  errorMsg: string
  appendApiError: boolean
  successDuration?: number
  errorDuration?: number
}

interface ToasterContextProps {
  // Lets you run some apiCall() in the background that will activate callback() on success.
  // Though if the apiCall needs a long time to run (> 1min), it's better to just create a Alert (TOAST type)
  // in the backend (mostly so that if the user refreshes the page they will still receive the toast).
  // TODO: actually, just delete runAsyncToast
  runAsyncToast: (
    apiCall: () => Promise<any>,
    callback: AsyncCallback,
    notifyOptions?: NotifyOptions,
  ) => void
}

const ToasterContext = createContext<ToasterContextProps>({
  runAsyncToast: () => {
    throw new Error(
      'runAsyncToast() not implemented. Did you forget to wrap your component in AsyncToasterProvider?',
    )
  },
})

export const useToaster = () => useContext(ToasterContext)

const standardDefaultToastOptions: ExternalToast = {
  richColors: true,
  dismissible: true,
  duration: Infinity,
  closeButton: true,
}

/* Fulfils two purposes:
  - Handles all TOAST alerts (from AlertsContext) and converts them into sonner toasts (similar idea with ModalAlertsContainer)
  - Has a <Toaster> component, meaning you can import sonner `toast` from 'sonner' and use `toast.info/error/success/etc.` (if you wanted something different instead of antd's `message`)
*/
export const ToastAlertsContainer: React.FC = () => {
  const { setUserInfo } = useUserInfo()

  const runAsyncToast = (
    apiCall: () => Promise<any>,
    callback: AsyncCallback,
    notifyOptions?: NotifyOptions,
  ) => {
    apiCall()
      .then((result) => {
        if (notifyOptions) {
          toast.success(notifyOptions.successMsg, {
            ...standardDefaultToastOptions,
            duration: notifyOptions.successDuration ?? Infinity,
          })
        }
        callback(result)
      })
      .catch((error) => {
        if (!notifyOptions) {
          callback(null, error)
          return
        }

        if (notifyOptions.appendApiError) {
          toast.error(
            <div>
              <b>{`${notifyOptions.errorMsg}:`}</b>
              <br />
              <br />
              {getErrorMessage(error)}
            </div>,
            standardDefaultToastOptions,
          )
        } else {
          toast.error(notifyOptions.errorMsg, {
            ...standardDefaultToastOptions,
            duration: notifyOptions.errorDuration ?? Infinity,
          })
        }
        callback(null, error)
      })
  }

  const { toasts } = useSonner()
  const { toastAlerts, markAlertRead } = useAlerts()

  // We create toast alerts whenever toastAlerts changes
  const handleToastAlertsChange = useEffectEvent(
    (updatedToastAlerts: Alert[]) => {
      console.log('updatedToastAlerts', updatedToastAlerts)
      console.log('current toasts', toasts)
      // we only create toasts for alerts that don't already have one
      const newAlertsToMakeToast = updatedToastAlerts.filter((alert) => {
        return !toasts.some((t) => t.id === alert.id) && !alert.readAt
      })
      // If there's a toast who doesn't have a corresponding alert, the alert was either deleted or read, so we can dismiss it here
      const toastsToDismiss = toasts.filter((t) => {
        return !updatedToastAlerts.some((alert) => alert.id === t.id)
      })
      console.log('toastsToDismiss', toastsToDismiss)
      console.log('newAlertsToMakeToast', newAlertsToMakeToast)

      toastsToDismiss.forEach((t) => {
        console.log('dismissing toast', t)
        // Since the alert doesn't exist in the state anymore, we want to remove the onDismiss() handler
        // since otherwise it's going to activate and try markRead an alert that's already read.
        toast(t.title, {
          ...t,
          onDismiss: () => {},
          onAutoClose: () => {},
        })
        toast.dismiss(t.id)
      })
      newAlertsToMakeToast.forEach((alert) => {
        console.log('creating new toast', alert)

        const payload = alert.payload as AlertPayloadToast
        const toastOptions: ExternalToast = {
          richColors: true,
          dismissible: true,
          closeButton: true,
          description: payload.description,
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
              <Link
                href={`/course/${alert.courseId}/settings/chatbot_knowledge_base`}
                onClick={() => markAlertRead(alert.id)}
                className="text-nowrap"
              >
                View
              </Link>
            ) : alert.alertType === AlertType.COURSE_CLONED &&
              (alert.payload as CloneCoursePayload).toastType ===
                ToastType.SUCCESS ? (
              <Link
                href={`/course/${(alert.payload as CloneCoursePayload).newCourseId}`}
                onClick={() => markAlertRead(alert.id)}
                className="text-nowrap"
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
      })
    },
  )
  useEffect(() => {
    console.log('toastAlerts changed', toastAlerts)
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
