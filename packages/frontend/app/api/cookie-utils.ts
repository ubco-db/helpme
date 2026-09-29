'use server'

import { cookies } from 'next/headers'

/** Forward both sessions so the backend can choose the valid cookie for the route. */
export async function getAuthTokenString(): Promise<string> {
  try {
    const cookieStore = await cookies()
    return ['auth_token', 'lti_auth_token']
      .map((name) => cookieStore.get(name))
      .filter((cookie) => cookie !== undefined)
      .map(({ name, value }) => `${name}=${value}`)
      .join('; ')
  } catch (error) {
    console.error('Failed to fetch auth token: ' + error)
    return ''
  }
}

export async function setQueueInviteCookie(
  queueId: number,
  courseId: number,
  orgId: number,
  courseInviteCode?: string,
): Promise<void> {
  try {
    const cookieStore = await cookies()
    cookieStore.set(
      'queueInviteInfo',
      `${courseId},${queueId},${orgId},${courseInviteCode ? Buffer.from(courseInviteCode).toString('base64') : ''}`,
      {
        httpOnly: true,
        secure: true,
        maxAge: 3600, // 1 hour
        path: '/',
        sameSite: 'none', // setting it to Strict helps mitigate CSRF attacks, but we need it as none to allow for third-party authentication (login with google)
      },
    )
  } catch (error) {
    console.error('Failed to set queue invite cookie: ' + error)
  }
}

export async function setProfInviteCookie(
  profInviteId: number,
  orgId: number,
  courseId: number,
  profInviteCode: string,
): Promise<void> {
  try {
    const cookieStore = await cookies()
    cookieStore.set(
      'profInviteInfo',
      `${profInviteId},${orgId},${courseId},${profInviteCode}`,
      {
        httpOnly: true,
        secure: true,
        maxAge: 3600, // 1 hour
        path: '/',
        sameSite: 'none',
      },
    )
  } catch (error) {
    console.error('Failed to set prof invite cookie: ' + error)
  }
}
