import { organizationApi } from '@/app/api/organizationApi'
import { GetOrganizationResponse } from '@koh/common'
import { Alert, Spin } from 'antd'
import OrganizationEditUser from '../../../components/OrganizationEditUser'
import getAPI from '@/app/api/server'
import { redirect } from 'next/navigation'

type UserEditPageProps = {
  params: Promise<{ userId: string }>
}

export default async function UserEditPage(props: UserEditPageProps) {
  const API = await getAPI()
  const params = await props.params
  const userId = Number(params.userId)
  const currentUser = await API.profile
    .getUser()
    .catch(() => redirect(`/courses`))
  const organization: GetOrganizationResponse =
    await organizationApi.getOrganization(currentUser.organization?.orgId ?? -1)

  return organization ? (
    <div className="mb-10">
      {organization?.ssoEnabled && (
        <Alert
          message="System Notice"
          description="Organizations with SSO/Shibboleth authentication enabled have limited editing permissions for users."
          type="error"
          className="mb-5"
        />
      )}
      <OrganizationEditUser userId={userId} organization={organization} />
    </div>
  ) : (
    <Spin />
  )
}
