import { fetchAuthToken } from './cookie-utils'

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''
/**
 * Organization "API".
 * Note: our main "API" is in index.ts
 * TODO: This should be merged into the main API file and all calls to these methods should be changed.
 */
export const organizationApi = {
  getOrganizations: async () => {
    const response = await fetch(`${baseUrl}/api/v1/organization`)
    if (!response.ok) {
      throw new Error('Failed to fetch organizations' + response.statusText)
    }
    return response.json()
  },

  getOrganization: async (organizationId: number) => {
    const authToken = await fetchAuthToken()

    const response = await fetch(
      `${baseUrl}/api/v1/organization/${organizationId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authToken,
          Cookie: authToken,
        },
        credentials: 'include',
      },
    )
    return response.json()
  },
}
