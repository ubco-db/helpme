/**
 * mail "API".
 * Note: our main "API" is in index.ts
 * TODO: This should be merged into the main API file and all calls to these methods should be changed.
 */
export const mailApi = {
  resendVerificationCode: async () => {
    const response = fetch(`/api/v1/mail/registration/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    return response
  },
}
