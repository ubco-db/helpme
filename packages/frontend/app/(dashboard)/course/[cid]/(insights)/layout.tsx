import React from 'react'
import { Role, User } from '@koh/common'
import { userApi } from '@/app/api/userApi'
import { redirect } from 'next/navigation'
import AddChatbot from '@/app/(dashboard)/components/AddChatbot'

export default async function Layout(props: {
  params: Promise<{ cid: string }>
  children: React.ReactNode
}) {
  const params = await props.params

  const { children } = props

  const profile = await userApi.getUser().catch((error) => {
    redirect(`/course/${params.cid}`)
  })
  const cid = Number(params.cid)

  const courseRole = profile.courses.find((e) => e.course.id === cid)?.role

  if (courseRole !== Role.PROFESSOR) {
    redirect(`/course/${params.cid}`)
  }

  return (
    <AddChatbot courseId={cid}>
      <div className="mt-2 flex flex-col">
        <title>HelpMe | Course Insights</title>
        <h1 className="mb-2 hidden md:block">Course Insights</h1>
        <div className="flex flex-1 flex-row">{children}</div>
      </div>
    </AddChatbot>
  )
}
