'use client'

import { API } from '@/app/api'
import UserAvatar from '@/app/components/UserAvatar'
import { SearchOutlined } from '@ant-design/icons'
import {
  GetOrganizationResponse,
  OrganizationRole,
  User,
  UserRole,
} from '@koh/common'
import { Avatar, Button, Input, List, Pagination, Select, Spin } from 'antd'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'

interface UsersTableProps {
  organization: GetOrganizationResponse
  prepareAndShowConfirmationModal: (user: UserData) => (newRole: string) => void
  profile: User
}

interface UserData {
  userId: number
  firstName: string
  lastName: string
  email: string
  photoUrl: string
  userRole: string
  organizationRole: string
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
  const handleInput = (event: any) => {
    event.preventDefault()
    setInput(event.target.value)
  }

  const handleSearch = (event: any) => {
    event.preventDefault()
    setSearch(event.target.value)
    setPage(1)
  }

  useEffect(() => {
    return () => {
      mutate(`users/${page}/${search}`)
    }
  }, [page, search])

  const { data: users } = useSWR(
    `users/${page}/${search}`,
    async () => await API.organizations.getUsers(organization.id, page, search),
  )

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
            placeholder="Search Users"
            prefix={<SearchOutlined />}
            value={input}
            onChange={handleInput}
            onPressEnter={handleSearch}
          />

          <List
            style={{ marginTop: 20 }}
            dataSource={users}
            renderItem={(item: UserData) => (
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
                        photoURL={item.photoUrl}
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
        {users.total > 50 && (
          <Pagination
            className="float-right"
            current={page}
            pageSize={50}
            total={users.total}
            onChange={(page) => setPage(page)}
            showSizeChanger={false}
          />
        )}
      </>
    )
  }
}

export default UsersTable
