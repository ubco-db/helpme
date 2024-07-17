import useSWR from 'swr'
import { API } from '@koh/api-client'

export function useCourseFeatures(courseId: number) {
  const key = courseId && !isNaN(courseId) ? `${courseId}/features` : null

  const { data: courseFeatures } = useSWR(
    key,
    async () => await API.course.getCourseFeatures(courseId),
    {
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        // if the API responded with 404, stop retrying
        if (error.response && error.response.status === 404) return

        // for other errors, retry with a delay
        if (retryCount <= 5) setTimeout(() => revalidate({ retryCount }), 1000)
      },
    },
  )

  return courseFeatures
}
