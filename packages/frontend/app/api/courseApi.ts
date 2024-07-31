import { fetchAuthToken } from './cookieApi'

export const courseApi = {
  getCourseFeatures: async (courseId: number) => {
    const authToken = await fetchAuthToken()
    const response = await fetch(
      `http://localhost:3000/api/v1/courses/${courseId}/features`,
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

  getCourse: async (courseId: number) => {
    const authToken = await fetchAuthToken()
    const response = await fetch(
      `http://localhost:3000/api/v1/courses/${courseId}`,
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
