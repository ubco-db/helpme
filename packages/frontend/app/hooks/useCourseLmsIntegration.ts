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
  isLoadingCourse: boolean
  isLoadingStudents: boolean
  isLoadingAssignments: boolean
  isLoadingAnnouncements: boolean
  isLoadingFiles: boolean
  isLoadingPages: boolean
}

export function useCourseLmsIntegration(
  courseId?: number,
  updateFlag?: boolean,
): CourseLmsIntegration {
  const [prevIntegration, setPrevIntegration] =
    useState<LMSCourseIntegrationPartial>()
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

  const [isLoadingCourse, setIsLoadingCourse] = useState<boolean>(false)
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false)
  const [isLoadingPages, setIsLoadingPages] = useState<boolean>(false)
  const [isLoadingAssignments, setIsLoadingAssignments] =
    useState<boolean>(false)
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] =
    useState<boolean>(false)
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false)

  const errorFx = (error: any) => {
    message.error(getErrorMessage(error))
  }

  useEffect(() => {
    const getResource = async (
      fx: Promise<any>,
      setValue: React.Dispatch<React.SetStateAction<any>>,
      setLoading?: React.Dispatch<React.SetStateAction<boolean>>,
    ) => {
      if (setLoading) {
        setLoading(true)
      }
      await fx
        .then((response) => {
          if (response) {
            setValue(response)
          }
        })
        .catch(errorFx)
        .finally(() => {
          if (setLoading) {
            setLoading(false)
          }
        })
    }

    const getResources = async () => {
      if (integration != undefined && courseId != undefined) {
        if (!integration.isExpired) {
          await getResource(
            API.lmsIntegration.getCourse(courseId),
            setCourse,
            setIsLoadingCourse,
          )
          await getResource(
            API.lmsIntegration.getStudents(courseId),
            setStudents,
          )
          await getResource(
            API.lmsIntegration.getAssignments(courseId),
            setAssignments,
            setIsLoadingAssignments,
          )
          await getResource(
            API.lmsIntegration.getAnnouncements(courseId),
            setAnnouncements,
            setIsLoadingAnnouncements,
          )
          await getResource(
            API.lmsIntegration.getFiles(courseId),
            setFiles,
            setIsLoadingFiles,
          )
          await getResource(
            API.lmsIntegration.getPages(courseId),
            setPages,
            setIsLoadingPages,
          )
          setIsLoading(false)
        }
      } else {
        setIsLoading(true)
        setIsLoadingPages(false)
        setIsLoadingStudents(false)
        setIsLoadingFiles(false)
        setIsLoadingAssignments(false)
        setIsLoadingAnnouncements(false)
      }
    }
    getResources()
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
    setIsLoadingStudents(false)
    setIsLoadingFiles(false)
    setIsLoadingAssignments(false)
    setIsLoadingAnnouncements(false)
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
    isLoadingCourse,
    isLoadingStudents,
    isLoadingAssignments,
    isLoadingAnnouncements,
    isLoadingFiles,
    isLoadingPages,
  }
}
