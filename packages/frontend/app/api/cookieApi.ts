'use server'

import { cookies } from 'next/headers'

/**
 * Cookie "API".
 * Note: our main "API" is in index.ts
 * TODO: This should be merged into the main API file and all calls to these methods should be changed.
 * Though maybe this one should just be a regular function and moved to a utils file
 */

/**
 * Fetches the 'auth_token' from the cookies.
 *
 * @async
 * @function fetchAuthToken
 * @returns {Promise<string>} - A promise that resolves to a string containing the 'auth_token'.
 * @throws Will log an error message to the console if fetching the 'auth_token' fails.
 */
export async function fetchAuthToken(): Promise<string> {
  try {
    const cookieStore = await cookies()
    const auth_token = cookieStore.get('auth_token')

    return `auth_token=${auth_token?.value || ''}`
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
