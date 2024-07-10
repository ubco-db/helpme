import { RegisterData } from '../typings/user'
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

    const response = await fetch('/api/v1/profile', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authToken,
      },
    })

    return response
  },
}
