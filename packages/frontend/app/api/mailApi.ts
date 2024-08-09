export const mailApi = {
  resendVerificationCode: async () => {
    const response = fetch(`/api/v1/mail/registration/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    return response
  },
}
