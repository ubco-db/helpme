'use server'

import { cookies } from 'next/headers'

/**
 * Fetches the 'auth_token' (or 'lti_auth_token') from the cookies.
 *
 * @async
 * @function fetchAuthToken
 * @returns {Promise<string>} - A promise that resolves to a string containing the 'auth_token'.
 * @throws Will log an error message to the console if fetching the 'auth_token' fails.
 */
export async function fetchAuthToken(): Promise<string> {
  try {
    const cookieStore = await cookies()
    const lti_auth_token = cookieStore.get('lti_auth_token')

    if (lti_auth_token) {
      return `lti_auth_token=${lti_auth_token.value}`
    }

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
