export const organizationApi = {
  getOrganizations: async () => {
    const response = await fetch(`http://localhost:3000/api/v1/organization`)
    return response.json()
  },

  getOrganization: async (organizationId: number) => {
    const response = await fetch(
      `http://localhost:3000/api/v1/organization/${organizationId}`,
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
