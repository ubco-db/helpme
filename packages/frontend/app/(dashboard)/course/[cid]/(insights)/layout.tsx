import React from 'react'
import InsightsPageMenu from '@/app/(dashboard)/course/[cid]/(insights)/components/InsightsPageMenu'
import { Role, User } from '@koh/common'
import { userApi } from '@/app/api/userApi'
import { redirect } from 'next/navigation'
import { InsightContextProvider } from '@/app/(dashboard)/course/[cid]/(insights)/insights/context/InsightsContext'

export default async function Layout({
  params,
  children,
}: {
  params: { cid: string }
  children: React.ReactNode
}) {
  const profile: User = await (await userApi.getUser()).json()
  const cid = Number(params.cid)

  if (!profile) {
    redirect(`/course/${params.cid}`)
  }

  const courseRole = profile.courses.find((e) => e.course.id === cid)?.role

  if (courseRole !== Role.PROFESSOR && courseRole !== Role.TA) {
    redirect(`/course/${params.cid}`)
  }

  return (
    <div className="mt-2 flex flex-col">
      <title>HelpMe | Course Insights</title>
      <h1 className="mb-2 hidden md:block">Course Insights</h1>
      <div className="flex flex-1 flex-row">
        <InsightsPageMenu courseId={cid} />
        <InsightContextProvider courseId={cid}>
          <div className="flex-1 p-5">{children}</div>
        </InsightContextProvider>
      </div>
    </div>
  )
}
