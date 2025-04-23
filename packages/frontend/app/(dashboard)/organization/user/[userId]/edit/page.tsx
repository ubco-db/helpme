import { organizationApi } from '@/app/api/organizationApi'
import { userApi } from '@/app/api/userApi'
import { GetOrganizationResponse, User } from '@koh/common'
import { Alert, Spin } from 'antd'
import OrganizationEditUser from '../../../components/OrganizationEditUser'

type UserEditPageProps = {
  params: { userId: string }
}

export default async function UserEditPage({ params }: UserEditPageProps) {
  const userId = Number(params.userId)
  const currentUser = await userApi.getUser()
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
