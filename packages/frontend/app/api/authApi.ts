import { PasswordConfirmationData } from '../typings/user'

/**
 * Authentication "API".
 * Note: our main "API" is in index.ts
 * TODO: This should be merged into the main API file and all calls to these methods should be changed.
 */
export const authApi = {
  /**
   * Validation of the reset password token
   * @param token {string} - The token to validate
   * @returns {Promise<Response>} - The response from the server
   */
  validateResetPasswordToken: async (token: string): Promise<Response> => {
    const response = await fetch(
      `/api/v1/auth/password/reset/validate/${token}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )

    return response
  },

  /**
   * Reset the password
   * @param token {string} - The token to reset the password
   * @param passwordConfirmationData {PasswordConfirmationData} - The password confirmation data
   * @returns {Promise<Response>} - The response from the server
   */
  resetPassword: async (
    token: string,
    passwordConfirmationData: PasswordConfirmationData,
  ): Promise<Response> => {
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(passwordConfirmationData),
    }

    const response = await fetch(
      `/api/v1/auth/password/reset/${token}`,
      request,
    )

    return response
  },

  /**
   * Verify the email
   * @param verificationCode {string} - The verification code
   * @returns {Promise<Response>} - The response from the server
   */
  verifyEmail: async (verificationCode: string): Promise<Response> => {
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: verificationCode,
      }),
    }

    const response = await fetch('/api/v1/auth/registration/verify', request)

    return response
  },
}
