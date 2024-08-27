import { fetchAuthToken } from './cookieApi'

/**
 * Organization "API".
 * Note: our main "API" is in index.ts
 * TODO: This should be merged into the main API file and all calls to these methods should be changed.
 */
export const organizationApi = {
  getOrganizations: async () => {
    const response = await fetch(`/api/v1/organization`)
    return response.json()
  },

  getOrganization: async (organizationId: number) => {
    const authToken = await fetchAuthToken()

    const response = await fetch(`/api/v1/organization/${organizationId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authToken,
        Cookie: authToken,
      },
      credentials: 'include',
    })
    return response.json()
  },

  getOrganizationStats: async (organizationId: number) => {
    const response = await fetch(`/api/v1/organization/${organizationId}/stats`)
    return response.json()
  },
}
