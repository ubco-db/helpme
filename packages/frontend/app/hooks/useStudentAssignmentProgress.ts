import useSWR from 'swr'
import { API } from '../api'
import { StudentAssignmentProgress } from '@koh/common'

// needed to make this use useSWR so that the student's client gets updated with the new tasks they finished
// could also use websockets, but that's a bit overkill
export function useStudentAssignmentProgress(
  cid: number,
  userId: number,
  assignmentId: string | undefined,
  isDemoQueue: boolean,
  isStaff: boolean,
): StudentAssignmentProgress | undefined {
  const key =
    cid && userId && assignmentId
      ? `/api/studentTaskProgress/student/${userId}/${cid}/${assignmentId}`
      : null
  const { data: studentAssignmentProgress } = useSWR(key, async () => {
    if (isDemoQueue && assignmentId && !isStaff) {
      return await API.studentTaskProgress.getAssignmentProgress(
        userId,
        cid,
        assignmentId,
      )
    } else {
      return undefined
    }
  })
  return studentAssignmentProgress
}
