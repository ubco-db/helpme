import EditCourse from '@/app/(dashboard)/components/EditCourse'
import { organizationApi } from '@/app/api/organizationApi'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { GetOrganizationResponse } from '@koh/common'
import getAPI from '@/app/api/server'
import { redirect } from 'next/navigation'

type CourseEditPageProps = {
  params: Promise<{ courseId: string }>
}

export default async function CourseEditPage(props: CourseEditPageProps) {
  const API = await getAPI()
  const params = await props.params
  const currentUser = await API.profile
    .getUser()
    .catch(() => redirect(`/courses`))
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
