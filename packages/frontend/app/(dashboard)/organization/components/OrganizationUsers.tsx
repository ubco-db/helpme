'use client'

import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { GetOrganizationResponse, OrganizationRole, OrgUser } from '@koh/common'
import { Alert, Card, message, Modal } from 'antd'
import { useState } from 'react'
import UsersTable from './UsersTable'

interface UsersTableProps {
  organization: GetOrganizationResponse
}

const OrganizationUsers: React.FC<UsersTableProps> = ({ organization }) => {
  const { userInfo } = useUserInfo()
  const [isRoleChangeModalVisible, setRoleChangeModalVisible] = useState(false)
  const [selectedUserData, setSelectedUserData] = useState<OrgUser | null>(null)
  const [updatedRole, setUpdatedRole] = useState<OrganizationRole>(
    OrganizationRole.MEMBER,
  )
  const [updateFlag, setUpdateFlag] = useState<boolean>(false)

  const toggleRoleChangeModal = (userData: OrgUser) => {
    setSelectedUserData(userData)
    setRoleChangeModalVisible(!isRoleChangeModalVisible)
  }

  const prepareAndShowConfirmationModal =
    (user: OrgUser) => async (newRole: string) => {
      setUpdatedRole(newRole as OrganizationRole)
      toggleRoleChangeModal(user)
    }

  const updateRole = async () => {
    const { userId } = selectedUserData as OrgUser

    await API.organizations
      .updateOrganizationUserRole(userInfo.organization?.orgId || -1, {
        userId,
        organizationRole: updatedRole,
      })
      .then(() => {
        setUpdateFlag((prev) => !prev)
        toggleRoleChangeModal(selectedUserData as OrgUser)
        message.success('Successfully updated user role.')
      })
      .catch((error) => {
        const errorMessage = error.response.data.message
        message.error(errorMessage)
      })
  }

  return (
    <>
      <Card title="Users" className="mb-5">
        {organization.ssoEnabled && (
          <Alert
            message="System Notice"
            description="Organizations with SSO/Shibboleth authentication enabled have limited editing permissions for users. Changes must be made in the SSO provider."
            type="error"
            className="mb-5"
          />
        )}
        <UsersTable
          organization={organization}
          prepareAndShowConfirmationModal={prepareAndShowConfirmationModal}
          profile={userInfo}
          updateFlag={updateFlag}
        />
      </Card>

      {isRoleChangeModalVisible && (
        <Modal
          title="Confirm Role Change"
          open={isRoleChangeModalVisible}
          onCancel={() => toggleRoleChangeModal}
          onOk={updateRole}
        >
          {selectedUserData && (
            <>
              You are about to change the role of{' '}
              <strong>
                {selectedUserData.firstName} {selectedUserData.lastName ?? ''}
              </strong>{' '}
              to <strong>{updatedRole}</strong>. <br />
              <br />
              Are you sure?
            </>
          )}
        </Modal>
      )}
    </>
  )
}

export default OrganizationUsers
