'use client'
import React from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import { getRoleInCourse } from '@/app/utils/generalUtils'
import StudentSchedulePanel from './StudentSchedulePanel'
import TAFacultySchedulePanel from './TASchedulePanel'
import { Role } from '@koh/common'
type SchedulePageProps = {
  params: { cid: string }
}

export default function SchedulePage({ params }: SchedulePageProps) {
  const cid = Number(params.cid)

  const { userInfo } = useUserInfo()
  const role = getRoleInCourse(userInfo, cid)
  return (
    <div className="mt-20 flex justify-center">
      <div className="mb-5 mt-8">
        {role === Role.PROFESSOR ? (
          <TAFacultySchedulePanel courseId={cid} />
        ) : (
          <StudentSchedulePanel courseId={cid} />
        )}
      </div>
    </div>
  )
}
