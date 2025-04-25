import EditCourse from '@/app/(dashboard)/components/EditCourse'
import { organizationApi } from '@/app/api/organizationApi'
import { userApi } from '@/app/api/userApi'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { GetOrganizationResponse } from '@koh/common'

export default async function SettingsPage(props: {
  params: Promise<{ cid: string }>
}) {
  const params = await props.params
  const currentUser = await userApi.getUser()
  const organization: GetOrganizationResponse =
    await organizationApi.getOrganization(currentUser.organization?.orgId ?? -1)
  const courseId = Number(params.cid)

  if (!currentUser) {
    return <CenteredSpinner tip="Loading user..." />
  } else if (!organization) {
    return <CenteredSpinner tip="Loading organization..." />
  } else {
    return (
      <EditCourse
        courseId={courseId}
        organization={organization}
        user={currentUser}
      />
    )
  }
}
