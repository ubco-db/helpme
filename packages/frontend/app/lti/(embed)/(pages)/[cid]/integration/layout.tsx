import { Role } from '@koh/common'
import { redirect } from 'next/navigation'
import getAPI from '@/app/api/server'

export default async function Layout(props: {
  params: Promise<{ cid: string }>
  children: React.ReactNode
}) {
  const API = await getAPI()
  const params = await props.params

  const { children } = props

  const profile = await API.profile.getUser().catch(() => {
    redirect(`/lti/login?redirect=/lti/${params.cid}/integration`)
  })
  const cid = Number(params.cid)

  const courseRole = profile.courses.find((uc) => uc.course.id === cid)?.role

  if (courseRole !== Role.PROFESSOR) {
    redirect(`/lti/${params.cid}`)
  }

  return (
    <div className="mt-2 flex flex-col space-y-3 md:flex-row md:space-x-3 md:space-y-0">
      {children}
    </div>
  )
}
