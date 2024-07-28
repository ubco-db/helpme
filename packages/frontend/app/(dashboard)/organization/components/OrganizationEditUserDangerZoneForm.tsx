import { API } from '@/app/api'
import {
  GetOrganizationResponse,
  GetOrganizationUserResponse,
} from '@koh/common'
import { Button, message } from 'antd'

type OrganizationEditUserDangerZoneFormProps = {
  userData: GetOrganizationUserResponse
  organization: GetOrganizationResponse
  fetchUserData: () => void
}

const OrganizationEditUserDangerZoneForm: React.FC<
  OrganizationEditUserDangerZoneFormProps
> = ({ userData, organization, fetchUserData }) => {
  const deleteProfilePicture = async () => {
    await API.organizations
      .deleteProfilePicture(organization?.id, userData.user.id)
      .then(() => {
        message.success('Profile picture was deleted')
        setTimeout(() => {
          fetchUserData()
        }, 1750)
      })
      .catch((error) => {
        const errorMessage = error.response.data.message

        message.error(errorMessage)
      })
  }

  const updateAccess = async () => {
    await API.organizations
      .updateAccess(organization?.id, userData.user.id)
      .then(() => {
        message.success('User access was updated')
        fetchUserData()
      })
      .catch((error) => {
        const errorMessage = error.response.data.message

        message.error(errorMessage)
      })
  }

  return (
    <div>
      <div className="flex flex-col items-center md:flex-row">
        <div className="mb-2 w-full md:mr-4 md:w-5/6 md:text-left">
          <strong>
            {userData.user.accountDeactivated
              ? 'Reactivate this account'
              : 'Deactivate this account'}
          </strong>
          <div className="mb-0">
            {userData.user.accountDeactivated
              ? 'Once you reactivate an account, the user will be able to access organization resources.'
              : 'Once you deactivate an account, the user will not be able to access organization resources.'}
          </div>
        </div>
        <Button danger className="w-full md:w-auto" onClick={updateAccess}>
          {userData.user.accountDeactivated
            ? 'Reactivate this account'
            : 'Deactivate this account'}
        </Button>
      </div>

      <div className="mt-2 flex flex-col items-center md:flex-row">
        <div className="mb-2 w-full md:mr-4 md:w-5/6 md:text-left">
          <strong>Delete profile picture</strong>
          <div className="mb-0">
            This will delete the user&lsquo;s profile picture.
          </div>
        </div>
        <Button
          danger
          className="w-full md:w-auto"
          disabled={!userData.user.photoUrl}
          onClick={deleteProfilePicture}
        >
          Delete profile picture
        </Button>
      </div>
    </div>
  )
}

export default OrganizationEditUserDangerZoneForm
