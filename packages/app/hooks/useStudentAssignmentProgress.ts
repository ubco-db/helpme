import useSWR from 'swr'
import { API } from '@koh/api-client'
import { StudentAssignmentProgress } from '@koh/common'

// needed to make this use useSWR so that the student's client gets updated with the new tasks they finished
// could also use websockets, but that's a bit overkill
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
    `/api/studentTaskProgress/student/${userId}/${cid}/${assignmentId}`
  const { data: studentAssignmentProgress } = useSWR(key, async () => {
    if (isDemoQueue && !isStaff) {
      return await API.studentTaskProgress.getAssignmentProgress(
        userId,
        cid,
        assignmentId,
      )
    } else {
      return null
    }
  })
  return studentAssignmentProgress
}
