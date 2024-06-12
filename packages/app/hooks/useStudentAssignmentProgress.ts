import useSWR from 'swr'
import { API } from '@koh/api-client'
import { StudentAssignmentProgress } from '@koh/common'

// needed to make this use useSWR so that the student's client gets updated with the new tasks they finished
export function useStudentAssignmentProgress(
  cid: number,
  userId: number,
  assignmentId: string,
  isDemoQueue: boolean,
  isStaff: boolean,
): StudentAssignmentProgress {
  const key =
    cid &&
    userId &&
    assignmentId &&
    `/api/course/${cid}/studentTaskProgress/${userId}/${assignmentId}`
  const { data: studentAssignmentProgress } = useSWR(key, async () => {
    if (isDemoQueue && !isStaff) {
      return await API.course.getAssignmentProgress(cid, userId, assignmentId)
    } else {
      return null
    }
  })
  return studentAssignmentProgress
}
