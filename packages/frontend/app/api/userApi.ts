import { User } from '@/middlewareType'
import { LoginData, PasswordResetData, RegisterData } from '../typings/user'
import { fetchAuthToken } from './cookieApi'
import * as Sentry from '@sentry/nextjs'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { SetStateAction } from 'react'
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

/**
 * User "API".
 * Note: our main "API" is in index.ts
 * TODO: This should be merged into the main API file and all calls to these methods should be changed.
 */
export const userApi = {
  /**
   * Register a new account using email and password
   * @param registerData {RegisterData} - The data to register the account with
   * @returns {Promise<Response>} - The response from the server
   */
  registerAccount: async (registerData: RegisterData): Promise<Response> => {
    return await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registerData),
    })
  },

  /**
   * Login with Google option
   * @param organizationId {number} - The organization ID to login with
   * @returns {Promise<Response>} - The response from the server
   */
  loginWithGoogle: async (organizationId: number): Promise<Response> => {
    return await fetch(`/api/v1/auth/link/google/${organizationId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
  },

  /**
   * Get user information from server
   * @param provideBaseResponse - Whether to return the raw Response object
   * @returns The user information or the raw Response based on the parameter
   */
  getUser: async <T extends boolean = false>(
    provideBaseResponse?: T,
  ): Promise<T extends true ? Response : User> => {
    const authToken = await fetchAuthToken()
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

    if (!baseUrl) {
      throw new Error(
        'NEXT_PUBLIC_API_BASE_URL is not set. Please properly create a .env in your frontend based on dev.env',
      )
    }

    const response = await fetch(`${baseUrl}/api/v1/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authToken,
        Cookie: authToken,
      },
      credentials: 'include',
    })
    if (provideBaseResponse) {
      return response as any // Type assertion needed due to conditional return type
    }

    if (response.headers.get('content-type')?.includes('application/json')) {
      if (response.status >= 400) {
        const body = await response.json()
        return Promise.reject(body)
      }
      return response.json() as any // Type assertion needed due to conditional return type
    } else if (response.headers.get('content-type')?.includes('text/html')) {
      const text = await response.text()
      Sentry.captureEvent({
        message: `Unknown error in getUser ${response.status}: ${response.statusText}`,
        level: 'error',
        extra: {
          text,
          response,
        },
      })
      return Promise.reject(text)
    } else {
      return Promise.reject(
        'Unknown error in getUser' + JSON.stringify(response),
      )
    }
  },

  /**
   * Login with email and password
   * @param loginData {LoginData} - The data for the login request (email, password, recaptchaToken)
   * @returns {Promise<Response>} - The response from the server
   */
  login: async (loginData: LoginData): Promise<Response> => {
    const loginRequest = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData),
    }
    return fetch(`/api/v1/ubc_login`, loginRequest)
  },

  resetPassword: async (
    passwordResetData: PasswordResetData,
  ): Promise<Response> => {
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(passwordResetData),
    }

    return fetch('/api/v1/auth/password/reset', request)
  },
}

export async function fetchUserDetails(
  setProfile: React.Dispatch<SetStateAction<any | undefined>>,
  setErrorGettingUser: React.Dispatch<SetStateAction<string | undefined>>,
  router: AppRouterInstance,
  pathname: string,
) {
  await userApi
    .getUser()
    .then((userDetails) => {
      setProfile(userDetails)
    })
    .catch((error) => {
      if (error.status === 401) {
        router.push(`/api/v1/logout?redirect=${pathname}`)
      } else {
        setErrorGettingUser(getErrorMessage(error))
      }
    })
}
