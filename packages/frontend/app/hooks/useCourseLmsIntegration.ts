import { useEffect, useState } from 'react'
import {
  LMSAnnouncement,
  LMSAssignment,
  LMSCourseAPIResponse,
  LMSCourseIntegrationPartial,
  LMSFile,
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
  files: LMSFile[]
  students: string[]
  isLoading: boolean
  isLoadingIntegration: boolean
  isLoadingPages: boolean
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
  const [files, setFiles] = useState<LMSFile[]>([])
  const [students, setStudents] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingIntegration, setIsLoadingIntegration] =
    useState<boolean>(true)
  const [isLoadingPages, setIsLoadingPages] = useState<boolean>(false)

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
            .getFiles(courseId)
            .then((response) => {
              if (response) {
                setFiles(response)
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

          setIsLoading(false)

          setIsLoadingPages(true)
          API.lmsIntegration
            .getPages(courseId)
            .then((response) => {
              if (response) {
                setPages(response)
              }
            })
            .catch(errorFx)
            .finally(() => {
              setIsLoadingPages(false)
            })
        }
      } else {
        setIsLoading(true)
        setIsLoadingPages(false)
      }
    })()
  }, [courseId, integration])

  const resetIntegration = () => {
    setIntegration(undefined)
    setCourse(undefined)
    setAssignments([])
    setAnnouncements([])
    setPages([])
    setFiles([])
    setStudents([])
    setIsLoading(true)
    setIsLoadingIntegration(true)
    setIsLoadingPages(false)
  }

  useEffect(() => {
    if (courseId != undefined) {
      if (integration == undefined) {
        setIsLoadingIntegration(true)
      }
      API.lmsIntegration
        .getCourseIntegration(courseId)
        .then((response) => {
          if (response) {
            setIntegration(response)
          } else {
            resetIntegration()
          }
          setIsLoadingIntegration(false)
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
    files,
    students,
    isLoading,
    isLoadingIntegration,
    isLoadingPages,
  }
}
