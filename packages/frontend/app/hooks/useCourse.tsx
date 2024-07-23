import { API } from '@koh/api-client'
import { GetCourseResponse } from '@koh/common'
import useSWR from 'swr'

export function useCourse(cid: number | null): {
  course: GetCourseResponse | undefined
  mutateCourse: () => void
} {
  const key = cid ? `/api/v1/courses/${cid}` : null
  const { data: course, mutate: mutateCourse } = useSWR(key, async () => {
    if (cid === null) {
      // this should never throw since the key will be null
      throw new Error('cid is somehow null')
    }
    return API.course.get(cid)
  })
  return {
    course,
    mutateCourse,
  }
}
