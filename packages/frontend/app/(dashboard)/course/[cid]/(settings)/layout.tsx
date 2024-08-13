import { userApi } from '@/app/api/userApi'
import { Role, User } from '@koh/common'
import { redirect } from 'next/navigation'
import CourseSettingsMenu from './components/CourseSettingsMenu'
import { courseApi } from '@/app/api/courseApi'

export default async function Layout({
  params,
  children,
}: {
  params: { cid: string }
  children: React.ReactNode
}) {
  const profile: User = await (await userApi.getUser()).json()

  if (!profile) {
    redirect(`/course/${params.cid}`)
  }

  const courseRole = profile.courses.find(
    (e) => e.course.id === Number(params.cid),
  )?.role

  if (courseRole !== Role.PROFESSOR && courseRole !== Role.TA) {
    redirect(`/course/${params.cid}`)
  }

  const courseFeatures = await courseApi.getCourseFeatures(Number(params.cid))

  return (
    <>
      <div className="mb-10 mt-2 flex flex-col space-y-3 md:flex-row md:space-x-3 md:space-y-0">
        <CourseSettingsMenu
          courseRole={courseRole}
          courseFeatures={courseFeatures}
          courseId={Number(params.cid)}
        />
        <div className="flex-1">{children}</div>
      </div>
    </>
  )
}
