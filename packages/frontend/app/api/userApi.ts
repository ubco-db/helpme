import { LoginData, RegisterData } from '../typings/user'
import { fetchAuthToken } from './cookieApi'

export const userApi = {
  /**
   * Register a new account using email and password
   * @param registerData {RegisterData} - The data to register the account with
   * @returns {Promise<Response>} - The response from the server
   */
  registerAccount: async (registerData: RegisterData): Promise<Response> => {
    const response = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registerData),
    })

    return response
  },

  /**
   * Login with Google option
   * @param organizationId {number} - The organization ID to login with
   * @returns {Promise<Response>} - The response from the server
   */
  loginWithGoogle: async (organizationId: number): Promise<Response> => {
    const response = await fetch(`/api/v1/auth/link/google/${organizationId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return response
  },

  /**
   * Get user information from server
   * @returns {Promise<Response>} - The response from the server
   */
  getUser: async (): Promise<Response> => {
    const authToken = await fetchAuthToken()
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

    const response = await fetch(`${baseUrl}/api/v1/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authToken,
        Cookie: authToken,
      },
      credentials: 'include',
    })

    return response
  },

  /**
   * Login with email and password
   * @param username {string} - The email to login with
   * @param password {string} - The password to login with
   * @param token {string} - The reCAPTCHA token
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
}
