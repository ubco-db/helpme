import useSWR from 'swr'
import { API } from '../api'
import { OrganizationSettingsResponse } from '@koh/common'

export function useOrganizationSettings(
  organizationId: number | undefined | null,
): OrganizationSettingsResponse | undefined {
  const key =
    organizationId === undefined || organizationId === null
      ? null
      : `${organizationId}/settings`

  const { data: organizationSettings } = useSWR(
    key,
    async () => {
      if (
        organizationId === undefined ||
        organizationId === null ||
        organizationId === -1 ||
        organizationId === 0
      )
        return undefined
      return await API.organizations.getOrganizationSettings(organizationId)
    },
    {
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        // if the API responded with 404, stop retrying
        if (error.response && error.response.status === 404) return

        // for other errors, retry with a delay
        if (retryCount <= 5) setTimeout(() => revalidate({ retryCount }), 1000)
      },
    },
  )

  return organizationSettings
}
