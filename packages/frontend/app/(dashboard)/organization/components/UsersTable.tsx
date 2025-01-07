'use client'

import { API } from '@/app/api'
import UserAvatar from '@/app/components/UserAvatar'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { SearchOutlined } from '@ant-design/icons'
import {
  GetOrganizationResponse,
  OrganizationRole,
  OrgUser,
  User,
  UserRole,
} from '@koh/common'
import { Button, Input, List, message, Pagination, Select, Spin } from 'antd'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

interface UsersTableProps {
  organization: GetOrganizationResponse
  prepareAndShowConfirmationModal: (user: OrgUser) => (newRole: string) => void
  profile: User
}

const UsersTable: React.FC<UsersTableProps> = ({
  organization,
  prepareAndShowConfirmationModal,
  profile,
}) => {
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const router = useRouter()
  const [users, setUsers] = useState<OrgUser[]>([])

  const updateUsers = useCallback(async () => {
    await API.organizations
      .getUsers(organization.id, page, search)
      .then((response) => {
        setUsers(response)
      })
      .catch((error) => {
        const errorMessage = getErrorMessage(error)
        message.error(errorMessage)
      })
  }, [organization.id, page, search])

  const handleSearch = useCallback(
    (value: string) => {
      const handler = setTimeout(() => {
        setSearch(value)
        setPage(1)
        updateUsers()
      }, 500)

      return () => {
        clearTimeout(handler)
      }
    },
    [updateUsers],
  )

  useEffect(() => {
    updateUsers()
  }, [page, search])

  if (!users) {
    return (
      <Spin
        tip="Loading..."
        style={{ margin: '0 auto', width: '100%', textAlign: 'center' }}
        size="large"
      />
    )
  } else {
    return (
      <>
        <div className="bg-white">
          <Input
            placeholder="Search Users (press enter to search)"
            prefix={<SearchOutlined />}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={() => handleSearch(input)}
          />
          <List
            style={{ marginTop: 20 }}
            dataSource={users}
            renderItem={(item: OrgUser) => (
              <>
                <List.Item
                  className="border-b-2 p-3"
                  key={item.userId}
                  actions={[
                    <Select
                      key={item.userId}
                      defaultValue={item.organizationRole}
                      className="w-full"
                      onChange={prepareAndShowConfirmationModal(item)}
                      disabled={
                        item.userId === profile.id ||
                        item.organizationRole.toLowerCase() ===
                          OrganizationRole.ADMIN.toLowerCase() ||
                        item.userRole.toLowerCase() ===
                          UserRole.ADMIN.toLowerCase()
                      }
                      options={Object.keys(OrganizationRole).map((role) => ({
                        label: role.toLowerCase(),
                        value: role.toLowerCase(),
                        disabled:
                          item.userId === profile.id ||
                          item.userRole.toLowerCase() ===
                            UserRole.ADMIN.toLowerCase() ||
                          role.toLowerCase() ===
                            item.organizationRole.toLowerCase(),
                      }))}
                    />,

                    <Button
                      key=""
                      disabled={
                        item.userId === profile.id ||
                        item.userRole.toLowerCase() ===
                          UserRole.ADMIN.toLowerCase() ||
                        item.organizationRole === OrganizationRole.ADMIN
                      }
                      onClick={() =>
                        router.push(`/organization/user/${item.userId}/edit`)
                      }
                    >
                      Edit
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <UserAvatar
                        username={item.firstName + ' ' + item.lastName}
                        photoURL={item.photoUrl ?? undefined}
                      />
                    }
                    title={item.firstName + ' ' + (item.lastName ?? '')}
                    description={item.email}
                  />
                </List.Item>
              </>
            )}
          />
        </div>
        <Pagination
          className="float-right"
          current={page}
          pageSize={50}
          showQuickJumper
          // set the total number of users very high so that it shows enough pages
          // TODO: change the endpoint so it actually returns the total number of users
          total={5000}
          onChange={(page) => setPage(page)}
          showSizeChanger={false}
        />
      </>
    )
  }
}

export default UsersTable
