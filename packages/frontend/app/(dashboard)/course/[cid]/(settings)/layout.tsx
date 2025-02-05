import { userApi } from '@/app/api/userApi'
import { GetProfileResponse, Role } from '@koh/common'
import { redirect } from 'next/navigation'
import CourseSettingsMenu from './components/CourseSettingsMenu'
import { courseApi } from '@/app/api/courseApi'
import AddChatbot from '@/app/(dashboard)/components/AddChatbot'

export default async function Layout({
  params,
  children,
}: {
  params: { cid: string }
  children: React.ReactNode
}) {
  const profile: GetProfileResponse = await (await userApi.getUser()).json()
  const cid = Number(params.cid)

  if (!profile) {
    redirect(`/course/${params.cid}`)
  }

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
