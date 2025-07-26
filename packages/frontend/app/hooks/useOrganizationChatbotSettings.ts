import useSWR from 'swr'
import { API } from '../api'

export function useCourseFeatures(organizationId: number | undefined | null) {
  const key =
    organizationId === undefined || organizationId === null
      ? null
      : `${organizationId}/chatbot_settings`

  const { data: chatbotSettings } = useSWR(
    key,
    async () =>
      await API.chatbot.adminOnly.getOrganizationSettings(
        organizationId === undefined || organizationId === null
          ? 0
          : organizationId,
      ),
    {
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        // if the API responded with 404, stop retrying
        if (error.response && error.response.status === 404) return

        // for other errors, retry with a delay
        if (retryCount <= 5) setTimeout(() => revalidate({ retryCount }), 1000)
      },
    },
  )

  const { data: providers } = useSWR(
    key,
    async () =>
      await API.chatbot.adminOnly.getOrganizationProviders(
        organizationId === undefined || organizationId === null
          ? 0
          : organizationId,
      ),
    {
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        // if the API responded with 404, stop retrying
        if (error.response && error.response.status === 404) return

        // for other errors, retry with a delay
        if (retryCount <= 5) setTimeout(() => revalidate({ retryCount }), 1000)
      },
    },
  )

  return {
    chatbotSettings,
    providers,
  }
}
