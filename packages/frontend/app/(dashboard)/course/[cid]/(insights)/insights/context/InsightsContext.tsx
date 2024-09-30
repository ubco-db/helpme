'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { API } from '@/app/api'
import { UserPartial, Role } from '@koh/common'

type InsightContextType = {
  studentDetails?: {
    students: UserPartial[]
    totalStudents: number
    page: number
    setPage: (n: number) => void
    search: string
    setSearch: (s: string) => void
  }
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
  const [students, setStudents] = useState<UserPartial[]>([])
  const [totalStudents, setTotalStudents] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [search, setSearch] = useState<string>('')

  useEffect(() => {
    fetchUsers().then()
  }, [courseId, page, search])

  const fetchUsers = async () => {
    const data = await API.course.getUserInfo(
      courseId,
      page,
      Role.STUDENT,
      search,
    )
    setStudents(data.users)
    setTotalStudents(data.total)
  }

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
      }}
    >
      {children}
    </InsightContext.Provider>
  )
}

export { useInsightContext, InsightContextProvider }
