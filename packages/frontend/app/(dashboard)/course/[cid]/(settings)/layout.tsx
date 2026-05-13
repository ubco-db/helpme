import { Role } from '@koh/common'
import { redirect } from 'next/navigation'
import CourseSettingsMenu from './components/CourseSettingsMenu'
import { courseApi } from '@/app/api/courseApi'
import AddChatbot from '@/app/(dashboard)/components/AddChatbot'
import getAPI from '@/app/api/server'

export default async function Layout(props: {
  params: Promise<{ cid: string }>
  children: React.ReactNode
}) {
  const API = await getAPI()
  const params = await props.params

  const { children } = props

  const profile = await API.profile.getUser().catch(() => {
    redirect(`/course/${params.cid}`)
  })
  const cid = Number(params.cid)

  const courseRole = profile.courses.find((uc) => uc.course.id === cid)?.role

  if (courseRole !== Role.PROFESSOR && courseRole !== Role.TA) {
    redirect(`/course/${params.cid}`)
  }

  const courseFeatures = await courseApi.getCourseFeatures(cid)

  return (
    <div className="mb-10 mt-2">
      <div className="md:hidden">
        <CourseSettingsMenu
          courseRole={courseRole}
          courseFeatures={courseFeatures}
          courseId={cid}
        />
      </div>
      <div className="mt-3 flex min-w-0 flex-col md:mt-0 md:flex-row md:space-x-3">
        <div className="hidden md:block">
          <CourseSettingsMenu
            courseRole={courseRole}
            courseFeatures={courseFeatures}
            courseId={cid}
          />
        </div>
        <AddChatbot courseId={cid}>
          <div className="min-w-0 flex-1">{children}</div>
        </AddChatbot>
      </div>
    </div>
  )
}
