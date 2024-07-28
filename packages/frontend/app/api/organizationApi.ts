import { fetchAuthToken } from './cookieApi'

export const organizationApi = {
  getOrganizations: async () => {
    const response = await fetch(`http://localhost:3000/api/v1/organization`)
    return response.json()
  },

  getOrganization: async (organizationId: number) => {
    const authToken = await fetchAuthToken()

    const response = await fetch(
      `http://localhost:3000/api/v1/organization/${organizationId}`,
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

  getOrganizationStats: async (organizationId: number) => {
    const response = await fetch(
      `http://localhost:3000/api/v1/organization/${organizationId}/stats`,
    )
    return response.json()
  },
}
