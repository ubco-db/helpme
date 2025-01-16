import { useEffect, useState } from 'react'
import {
  LMSAnnouncement,
  LMSAssignment,
  LMSCourseAPIResponse,
  LMSCourseIntegrationPartial,
} from '@koh/common'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { message } from 'antd'

export type CourseLmsIntegration = {
  integration?: LMSCourseIntegrationPartial
  course?: LMSCourseAPIResponse
  assignments: LMSAssignment[]
  setAssignments: React.Dispatch<React.SetStateAction<LMSAssignment[]>>
  announcements: LMSAnnouncement[]
  setAnnouncements: React.Dispatch<React.SetStateAction<LMSAnnouncement[]>>
  students: string[]
  isLoading: boolean
}

export function useCourseLmsIntegration(
  courseId?: number,
  updateFlag?: boolean,
): CourseLmsIntegration {
  const [integration, setIntegration] = useState<LMSCourseIntegrationPartial>()
  const [course, setCourse] = useState<LMSCourseAPIResponse>()
  const [assignments, setAssignments] = useState<LMSAssignment[]>([])
  const [announcements, setAnnouncements] = useState<LMSAnnouncement[]>([])
  const [students, setStudents] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const errorFx = (error: any) => {
    message.error(getErrorMessage(error))
  }

  useEffect(() => {
    if (courseId != undefined) {
      API.lmsIntegration
        .getCourseIntegration(courseId)
        .then((response) => {
          if (response) {
            setIntegration(response)
            if (!response.isExpired) {
              API.lmsIntegration
                .getCourse(courseId)
                .then((response) => {
                  if (response) {
                    setCourse(response)
                  }
                })
                .catch(errorFx)
              API.lmsIntegration
                .getAssignments(courseId)
                .then((response) => {
                  if (response) {
                    setAssignments(response)
                  }
                })
                .catch(errorFx)
              API.lmsIntegration
                .getAnnouncements(courseId)
                .then((response) => {
                  if (response) {
                    setAnnouncements(response)
                  }
                })
                .catch(errorFx)
              API.lmsIntegration
                .getStudents(courseId)
                .then((response) => {
                  if (response) {
                    setStudents(response)
                  }
                })
                .catch(errorFx)
            }
            setIsLoading(false)
          }
        })
        .catch(errorFx)
    } else {
      setIntegration(undefined)
      setCourse(undefined)
      setAssignments([])
      setAnnouncements([])
      setStudents([])
      setIsLoading(true)
    }
  }, [courseId, updateFlag])

  return {
    integration,
    course,
    assignments,
    setAssignments,
    announcements,
    setAnnouncements,
    students,
    isLoading,
  }
}
