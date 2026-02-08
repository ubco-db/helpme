import { API } from '../api'
import { GetCourseResponse } from '@koh/common'
import useSWR from 'swr'

export type GetCourseError = Error & {
  response?: {
    status: number
    statusText?: string
    data: {
      message: string
    }
  }
}

export function useCourse(cid: number | null): {
  course: GetCourseResponse | undefined
  mutateCourse: () => void
  error?: GetCourseError
} {
  const key = cid ? `/api/v1/courses/${cid}` : null
  const { data: course, mutate: mutateCourse, error } = useSWR(key, async () => {
    if (cid === null) {
      // this should never throw since the key will be null
      throw new Error('cid is somehow null in useCourse')
    }
    return API.course.get(cid)
  })
  return {
    course,
    mutateCourse,
    error,
  }
}
