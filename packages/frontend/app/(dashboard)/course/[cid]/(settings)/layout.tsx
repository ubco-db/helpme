import { userApi } from '@/app/api/userApi'
import { Role } from '@koh/common'
import { redirect } from 'next/navigation'
import CourseSettingsMenu from './components/CourseSettingsMenu'
import { courseApi } from '@/app/api/courseApi'
import AddChatbot from '@/app/(dashboard)/components/AddChatbot'

export default async function Layout(props: {
  params: Promise<{ cid: string }>
  children: React.ReactNode
}) {
  const params = await props.params

  const { children } = props

  const profile = await userApi.getUser().catch(() => {
    redirect(`/course/${params.cid}`)
  })
  const cid = Number(params.cid)

  const courseRole = profile.courses.find((uc) => uc.course.id === cid)?.role

  if (courseRole !== Role.PROFESSOR && courseRole !== Role.TA) {
    redirect(`/course/${params.cid}`)
  }

  const courseFeatures = await courseApi.getCourseFeatures(cid)

  return (
    <div className="mb-10 mt-2 flex flex-col space-y-3 md:flex-row md:space-x-3 md:space-y-0">
      <CourseSettingsMenu
        courseRole={courseRole}
        courseFeatures={courseFeatures}
        courseId={cid}
      />
      <AddChatbot courseId={cid}>
        <div className="flex-1">{children}</div>
      </AddChatbot>
    </div>
  )
}
