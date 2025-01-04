import { API } from '@/app/api'
import UserAvatar from '@/app/components/UserAvatar'
import { useUserInfo } from '@/app/contexts/userContext'
import {
  DownOutlined,
  SearchOutlined,
  UserDeleteOutlined,
} from '@ant-design/icons'
import { Role, UserPartial } from '@koh/common'
import {
  Button,
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
import { cn } from '@/app/utils/generalUtils'

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
  const [users, setUsers] = useState<UserPartial[]>([])
  const [totalUsers, setTotalUsers] = useState<number>(0)
  const [isSensitiveInfoHidden, setIsSensitiveInfoHidden] = useState(
    hideSensitiveInformation,
  )
  const { userInfo } = useUserInfo()

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
    setTotalUsers(data.total)
  }

  useEffect(() => {
    fetchUsers().then()
  }, [page, search, role, courseId])

  // everytime updateFlag changes, refresh the tables
  useEffect(() => {
    fetchUsers().then()
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

  const RosterItem: React.FC<{ item: UserPartial; className?: string }> = ({
    item,
    className,
  }) => {
    return (
      <List.Item
        key={item.id}
        className={cn('flex items-center justify-between', className ?? '')}
      >
        <List.Item.Meta
          avatar={
            <UserAvatar photoURL={item.photoURL} username={item.name ?? ''} />
          }
          title={<span className="mr-2">{item.name}</span>}
          className="flex flex-grow items-center"
        />
        {isSensitiveInfoHidden ? (
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
                  handleRoleChange(item.id, e.key as Role, item.name ?? '')
                }

                Modal.confirm({
                  title: <div className="font-bold">Warning</div>,
                  content: (
                    <div>
                      You are about to change role of{' '}
                      <span className="font-bold">{item.name}</span> to{' '}
                      <span className="font-bold">{e.key.toUpperCase()}</span>
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
          <a className="ant-dropdown-link" onClick={(e) => e.preventDefault()}>
            Change Role <DownOutlined />
          </a>
        </Dropdown>
        {userInfo.id !== item.id && (
          <Button
            icon={<UserDeleteOutlined />}
            danger
            className="ml-2"
            onClick={() => {
              Modal.confirm({
                title: <div className="font-bold text-red-600">Warning</div>,
                content: (
                  <div>
                    You are about to{' '}
                    <span className="text-red-600">remove</span>{' '}
                    <span className="font-bold">{item.name}</span> from the
                    course.
                    <br />
                    <br />
                    Are you sure you want to proceed?
                  </div>
                ),
                okText: 'Yes',
                okType: 'danger',
                cancelText: 'No',

                onOk() {
                  API.organizations
                    .dropUserCourses(
                      userInfo.organization?.orgId ?? -1,
                      item.id,
                      [courseId],
                    )
                    .then(() => {
                      message.success(
                        `${item.name} successfully removed from the course`,
                      )
                      onRoleChange()
                    })
                    .catch(() => {
                      message.error(
                        `Failed to remove ${item.name} from the course`,
                      )
                    })
                },
              })
            }}
          />
        )}
      </List.Item>
    )
  }

  if (!users) {
    return <Spin tip="Loading..." size="large" />
  } else {
    return (
      <>
        <div className="bg-white">
          <div className="mb-2 flex">
            <h3 className="text-lg font-semibold">{listTitle}</h3>
            {/* Only show this button if the table hides sensitive info */}
            {hideSensitiveInformation && (
              <Button
                type="link"
                onClick={() => setIsSensitiveInfoHidden(!isSensitiveInfoHidden)}
              >
                {isSensitiveInfoHidden ? 'Show' : 'Hide'} Student Emails
              </Button>
            )}
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
            size="small"
            renderItem={(item: UserPartial) => <RosterItem item={item} />}
            bordered
          />
        </div>
        {totalUsers > 50 && (
          <Pagination
            style={{ float: 'right' }}
            current={page}
            pageSize={50}
            total={totalUsers}
            onChange={(page) => setPage(page)}
            showSizeChanger={false}
          />
        )}
      </>
    )
  }
}

export default CourseRosterTable
