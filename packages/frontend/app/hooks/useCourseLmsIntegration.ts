import { useEffect, useState } from 'react'
import {
  LMSAnnouncement,
  LMSAssignment,
  LMSCourseAPIResponse,
  LMSCourseIntegrationPartial,
  LMSPage,
} from '@koh/common'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { message } from 'antd'

export type CourseLmsIntegration = {
  integration?: LMSCourseIntegrationPartial
  course?: LMSCourseAPIResponse
  assignments: LMSAssignment[]
  announcements: LMSAnnouncement[]
  pages: LMSPage[]
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
  const [pages, setPages] = useState<LMSPage[]>([])
  const [students, setStudents] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const errorFx = (error: any) => {
    message.error(getErrorMessage(error))
  }

  useEffect(() => {
    ;(async () => {
      if (integration != undefined && courseId != undefined) {
        if (!integration.isExpired) {
          await API.lmsIntegration
            .getCourse(courseId)
            .then((response) => {
              if (response) {
                setCourse(response)
              }
            })
            .catch(errorFx)
          await API.lmsIntegration
            .getAssignments(courseId)
            .then((response) => {
              if (response) {
                setAssignments(response)
              }
            })
            .catch(errorFx)
          await API.lmsIntegration
            .getAnnouncements(courseId)
            .then((response) => {
              if (response) {
                setAnnouncements(response)
              }
            })
            .catch(errorFx)
          await API.lmsIntegration
            .getPages(courseId)
            .then((response) => {
              if (response) {
                setPages(response)
              }
            })
            .catch(errorFx)
          await API.lmsIntegration
            .getStudents(courseId)
            .then((response) => {
              if (response) {
                setStudents(response)
              }
            })
            .catch(errorFx)
        }
        setIsLoading(false)
      } else setIsLoading(true)
    })()
  }, [courseId, integration])

  const resetIntegration = () => {
    setIntegration(undefined)
    setCourse(undefined)
    setAssignments([])
    setAnnouncements([])
    setPages([])
    setStudents([])
    setIsLoading(true)
  }

  useEffect(() => {
    if (courseId != undefined) {
      if (integration == undefined) {
        setIsLoading(true)
      }
      API.lmsIntegration
        .getCourseIntegration(courseId)
        .then((response) => {
          if (response) {
            setIntegration(response)
          } else {
            resetIntegration()
            setIsLoading(false)
          }
        })
        .catch(errorFx)
    } else {
      resetIntegration()
    }
  }, [courseId, updateFlag])

  return {
    integration,
    course,
    assignments,
    announcements,
    pages,
    students,
    isLoading,
  }
}
