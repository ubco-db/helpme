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
    const cookieStore = cookies()
    const auth_token = cookieStore.get('auth_token')

    const result = `auth_token=${auth_token?.value || ''}`

    return result
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
    const cookieStore = cookies()
    cookieStore.set(
      'queueInviteInfo',
      `${courseId},${queueId},${orgId},${courseInviteCode ?? ''}`,
      {
        httpOnly: true,
        secure: true,
        maxAge: 3600, // 1 hour
        path: '/',
        sameSite: 'strict', // Helps mitigate CSRF attacks
      },
    )
  } catch (error) {
    console.error('Failed to set queue invite cookie: ' + error)
  }
}
