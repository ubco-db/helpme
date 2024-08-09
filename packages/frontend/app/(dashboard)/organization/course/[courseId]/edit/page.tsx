import EditCourse from '@/app/(dashboard)/components/EditCourse'
import { organizationApi } from '@/app/api/organizationApi'
import { userApi } from '@/app/api/userApi'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { GetOrganizationResponse, User } from '@koh/common'

type CourseEditPageProps = {
  params: { courseId: string }
}

export default async function CourseEditPage({ params }: CourseEditPageProps) {
  const currentUser: User = await (await userApi.getUser()).json()
  const organization: GetOrganizationResponse =
    await organizationApi.getOrganization(currentUser.organization?.orgId ?? -1)
  const courseId = Number(params.courseId)
  if (!currentUser) {
    return <CenteredSpinner tip="Loading user..." />
  } else if (!organization) {
    return <CenteredSpinner tip="Loading organization..." />
  } else {
    return (
      <div className="mb-10">
        <EditCourse
          courseId={courseId}
          organization={organization}
          user={currentUser}
        />
      </div>
    )
  }
}
