import { API } from '@/app/api'
import { DownOutlined, SearchOutlined } from '@ant-design/icons'
import { Role, UserPartial } from '@koh/common'
import {
  Avatar,
  Dropdown,
  Input,
  List,
  Menu,
  message,
  Modal,
  Pagination,
  Spin,
} from 'antd'
import { useEffect, useState } from 'react'

type CourseRosterTableProps = {
  courseId: number
  role: Role
  listTitle: string
  displaySearchBar: boolean
  searchPlaceholder: string
  onRoleChange: () => void
  updateFlag: boolean
  hideSensitiveInformation?: boolean
}

const CourseRosterTable: React.FC<CourseRosterTableProps> = ({
  courseId,
  role,
  listTitle,
  displaySearchBar,
  searchPlaceholder,
  onRoleChange,
  updateFlag,
  hideSensitiveInformation = false,
}) => {
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<any>([])

  const handleInput = (event: any) => {
    event.preventDefault()
    setInput(event.target.value)
  }

  const handleSearch = (event: any) => {
    event.preventDefault()
    setSearch(event.target.value)
    setPage(1)
  }

  const fetchUsers = async () => {
    const data = await API.course.getUserInfo(courseId, page, role, search)
    setUsers(data.users)
  }

  useEffect(() => {
    fetchUsers()
  }, [page, search, role, courseId])

  // everytime updateFlag changes, refresh the tables
  useEffect(() => {
    fetchUsers()
  }, [updateFlag])

  const handleRoleChange = async (
    userId: number,
    newRole: Role,
    userName: string,
  ) => {
    try {
      await API.course.updateUserRole(courseId, userId, newRole)
      message.success(`${userName} successfully updated to ${newRole} role`)
      onRoleChange()
    } catch (error) {
      message.error(`Failed to update ${userName} to ${newRole}`)
    }
  }

  const userAvatar = (photoUrl: string) => {
    if (photoUrl && photoUrl.startsWith('http')) {
      return <Avatar src={photoUrl} className="mt-3" />
    } else if (photoUrl) {
      return (
        <Avatar
          src={'/api/v1/profile/get_picture/' + photoUrl}
          style={{ marginRight: 10 }}
        />
      )
    } else {
      return <Avatar style={{ marginRight: 10 }}>N/A</Avatar>
    }
  }

  if (!users) {
    return <Spin tip="Loading..." size="large" />
  } else {
    return (
      <>
        <div className="bg-white">
          <div className="mb-2">
            <h3 className="text-lg font-semibold">{listTitle}</h3>
          </div>
          {displaySearchBar && (
            <Input
              placeholder={searchPlaceholder}
              prefix={<SearchOutlined />}
              value={input}
              onChange={handleInput}
              onPressEnter={handleSearch}
              className="my-3"
            />
          )}
          <List
            dataSource={users}
            renderItem={(item: UserPartial) => (
              <List.Item
                key={item.id}
                className="flex items-center justify-between"
              >
                <List.Item.Meta
                  avatar={userAvatar(item.photoURL ?? '')}
                  title={<span className="mr-2">{item.name}</span>}
                  className="flex flex-grow items-center"
                />
                {hideSensitiveInformation ? (
                  <span className="flex-grow">
                    {item.email
                      ?.substring(0, item.email?.indexOf('@'))
                      .replace(/./g, '*')}
                    {item.email?.substring(item.email?.indexOf('@'))}
                  </span>
                ) : (
                  <span className="flex-grow">{item.email}</span>
                )}

                <Dropdown
                  overlay={
                    <Menu
                      onClick={(e) => {
                        const confirmRoleChange = () => {
                          handleRoleChange(
                            item.id,
                            e.key as Role,
                            item.name ?? '',
                          )
                        }

                        Modal.confirm({
                          title: <div className="font-bold">Warning</div>,
                          content: (
                            <div>
                              You are about to change role of{' '}
                              <span className="font-bold">{item.name}</span> to{' '}
                              <span className="font-bold">
                                {e.key.toUpperCase()}
                              </span>
                              .
                              <br />
                              <br />
                              Are you sure you want to proceed?
                            </div>
                          ),
                          okText: 'Yes',
                          okType: 'danger',
                          cancelText: 'No',
                          onOk() {
                            confirmRoleChange()
                          },
                        })
                      }}
                    >
                      {role !== Role.PROFESSOR ? (
                        <Menu.Item key={Role.PROFESSOR}>Professor</Menu.Item>
                      ) : null}
                      {role !== Role.TA ? (
                        <Menu.Item key={Role.TA}>Teaching Assistant</Menu.Item>
                      ) : null}
                      {role !== Role.STUDENT ? (
                        <Menu.Item key={Role.STUDENT}>Student</Menu.Item>
                      ) : null}
                    </Menu>
                  }
                  className="flex-grow-0"
                >
                  <a
                    className="ant-dropdown-link"
                    onClick={(e) => e.preventDefault()}
                  >
                    Change Role <DownOutlined />
                  </a>
                </Dropdown>
              </List.Item>
            )}
            bordered
          />
        </div>
        {users.total > 50 && (
          <Pagination
            style={{ float: 'right' }}
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

export default CourseRosterTable
