'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { API } from '@/app/api'
import { UserPartial, Role, QueuePartial } from '@koh/common'
import { useCourse } from '@/app/hooks/useCourse'

type InsightContextType = {
  studentDetails?: {
    students: UserPartial[]
    totalStudents: number
    page: number
    setPage: (n: number) => void
    search: string
    setSearch: (s: string) => void
  }
  queueDetails?: QueuePartial[]
}

const InsightContext = createContext<InsightContextType>({})

const useInsightContext = () => {
  const context = useContext(InsightContext)
  if (context == undefined) {
    throw new Error(
      'Cannot use InsightContext outside of an InsightContextProvider.',
    )
  }
  return context
}

const InsightContextProvider: React.FC<{
  courseId: number
  children: React.ReactNode
}> = ({ courseId, children }) => {
  const { course } = useCourse(courseId)
  const [students, setStudents] = useState<UserPartial[]>([])
  const [totalStudents, setTotalStudents] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [search, setSearch] = useState<string>('')

  useEffect(() => {
    ;(async () => {
      const data = await API.course.getUserInfo(
        courseId,
        page,
        Role.STUDENT,
        search,
      )
      setStudents(data.users)
      setTotalStudents(data.total)
    })()
  }, [courseId, page, search])

  return (
    <InsightContext.Provider
      value={{
        studentDetails: {
          students: students,
          totalStudents: totalStudents,
          page: page,
          setPage: setPage,
          search: search,
          setSearch: (s: string) => {
            if (s == undefined) {
              setSearch('')
            } else {
              setSearch(s)
            }
          },
        },
        queueDetails: course?.queues ?? [],
      }}
    >
      {children}
    </InsightContext.Provider>
  )
}

export { useInsightContext, InsightContextProvider }
