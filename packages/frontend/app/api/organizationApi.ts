export const organizationApi = {
  getOrganizations: async () => {
    const response = await fetch(`http://localhost:3000/api/v1/organization`)
    return response.json()
  },
}
