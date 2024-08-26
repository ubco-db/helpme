import { DesktopNotifBody } from '@koh/common'
import platform from 'platform'
import { API } from '../api'

const doesBrowserSupportNotifications = (): boolean =>
  'serviceWorker' in window.navigator && 'PushManager' in window

export enum NotificationStates {
  granted,
  notAllowed,
  browserUnsupported,
}

export function getNotificationState(): NotificationStates {
  if (!doesBrowserSupportNotifications()) {
    return NotificationStates.browserUnsupported
  } else if (Notification.permission === 'granted') {
    return NotificationStates.granted
  } else {
    return NotificationStates.notAllowed
  }
}

export async function requestNotificationPermission(): Promise<NotificationStates> {
  let state = getNotificationState()
  if (state === NotificationStates.notAllowed) {
    await window.Notification.requestPermission()
    state = getNotificationState()
  }
  return state
}

const getRegistration = async (): Promise<
  ServiceWorkerRegistration | undefined
> => await window.navigator.serviceWorker?.getRegistration()

export const registerNotificationSubscription = async (): Promise<void> => {
  if (doesBrowserSupportNotifications()) {
    const subscription = await ensureSubscription()
    if (subscription) {
      const subData = subscription.toJSON() as DesktopNotifBody
      await API.notif.desktop.register({
        ...subData,
        name: `${platform.name} on ${platform.os}`,
      })
    }
  }
}

async function ensureSubscription(): Promise<PushSubscription | null> {
  const registration = await getRegistration()
  if (!registration) return null

  let subscription = await registration.pushManager.getSubscription()
  if (subscription === null) {
    const PUBLICKEY = await API.notif.desktop.credentials()
    console.log(PUBLICKEY)
    const applicationServerKey = urlB64ToUint8Array(PUBLICKEY)
    const options = { applicationServerKey, userVisibleOnly: true }
    subscription = await registration.pushManager.subscribe(options)
  }
  return subscription
}

export async function getEndpoint(): Promise<
  string | NotificationStates | undefined
> {
  const registration = await getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return subscription?.endpoint
}

export const urlB64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
