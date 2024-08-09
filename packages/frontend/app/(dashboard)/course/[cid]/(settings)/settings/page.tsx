import EditCourse from '@/app/(dashboard)/components/EditCourse'
import { organizationApi } from '@/app/api/organizationApi'
import { userApi } from '@/app/api/userApi'
import { GetOrganizationResponse, User } from '@koh/common'

export default async function SettingsPage({
  params,
}: {
  params: { cid: string }
}) {
  const currentUser: User = await (await userApi.getUser()).json()
  const organization: GetOrganizationResponse =
    await organizationApi.getOrganization(currentUser.organization?.orgId ?? -1)
  const courseId = Number(params.cid)

  return (
    <EditCourse
      courseId={courseId}
      organization={organization}
      user={currentUser}
    />
  )
}
