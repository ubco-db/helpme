import useSWR from 'swr'
import { API } from '../api'

export function useCourseFeatures(courseId: number | undefined | null) {
  const key =
    courseId === undefined || courseId === null ? null : `${courseId}/features`

  const { data: courseFeatures } = useSWR(
    key,
    async () =>
      await API.course.getCourseFeatures(
        courseId === undefined || courseId === null ? 0 : courseId,
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

  return courseFeatures
}
