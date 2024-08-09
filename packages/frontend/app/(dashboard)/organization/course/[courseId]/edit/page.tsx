import EditCourse from '@/app/(dashboard)/components/EditCourse'
import { organizationApi } from '@/app/api/organizationApi'
import { userApi } from '@/app/api/userApi'
import { GetOrganizationResponse, User } from '@koh/common'
import { Spin } from 'antd'

type CourseEditPageProps = {
  params: { courseId: string }
}

export default async function CourseEditPage({ params }: CourseEditPageProps) {
  const currrentUser: User = await (await userApi.getUser()).json()
  const organization: GetOrganizationResponse =
    await organizationApi.getOrganization(
      currrentUser.organization?.orgId ?? -1,
    )
  const courseId = Number(params.courseId)

  return organization ? (
    <div className="mb-10">
      <EditCourse
        courseId={courseId}
        organization={organization}
        user={currrentUser}
      />
    </div>
  ) : (
    <Spin />
  )
}
