import EditCourse from '@/app/(dashboard)/components/EditCourse'
import { organizationApi } from '@/app/api/organizationApi'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { GetOrganizationResponse } from '@koh/common'
import getAPI from '@/app/api/server'
import { redirect } from 'next/navigation'

export default async function SettingsPage(props: {
  params: Promise<{ cid: string }>
}) {
  const API = await getAPI()
  const params = await props.params
  const currentUser = await API.profile
    .getUser()
    .catch(() => redirect(`/course/${params.cid}`))
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
