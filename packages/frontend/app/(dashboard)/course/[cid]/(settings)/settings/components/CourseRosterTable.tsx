import { API } from '@/app/api'
import UserAvatar from '@/app/components/UserAvatar'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import {
  DownOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  UserDeleteOutlined,
} from '@ant-design/icons'
import { Role, User, UserPartial } from '@koh/common'
import {
  Button,
  Dropdown,
  Input,
  List,
  Menu,
  message,
  Modal,
  Pagination,
  Popover,
  Row,
  Spin,
  Tooltip,
} from 'antd'
import TextArea from 'antd/es/input/TextArea'
import { Notebook, NotebookText } from 'lucide-react'
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
  const { userInfo, setUserInfo } = useUserInfo()

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
      if (userId === userInfo.id) {
        setUserInfo({
          ...userInfo,
          courses: userInfo.courses.map((uc) => {
            if (uc.course.id === courseId) {
              return {
                ...uc,
                role: newRole,
              }
            }
            return uc
          }),
        })
      }
    } catch (error) {
      message.error(`Failed to update ${userName} to ${newRole}`)
    }
  }

  const renderItem = (item: UserPartial) => {
    return (
      <RosterItem
        item={item}
        courseId={courseId}
        userInfo={userInfo}
        role={role}
        isSensitiveInfoHidden={isSensitiveInfoHidden}
        handleRoleChange={handleRoleChange}
        onRoleChange={onRoleChange}
      />
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
            renderItem={renderItem}
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

const RosterItem: React.FC<{
  item: UserPartial
  courseId: number
  role: Role
  isSensitiveInfoHidden: boolean
  userInfo: User
  handleRoleChange: (userId: number, newRole: Role, userName: string) => void
  onRoleChange: () => void
  className?: string
}> = ({
  item,
  courseId,
  role,
  isSensitiveInfoHidden,
  userInfo,
  handleRoleChange,
  onRoleChange,
  className,
}) => {
  const [tempTaNotes, setTempTaNotes] = useState(item.TANotes ?? '')
  const [canSave, setCanSave] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveSuccessful, setSaveSuccessful] = useState(false)

  return (
    <List.Item
      key={item.id}
      className={cn(
        'flex flex-col items-center justify-between px-1 py-2 md:flex-row md:px-4 md:py-4',
        className ?? '',
      )}
    >
      <Row className="flex w-full items-center justify-between">
        <List.Item.Meta
          avatar={
            <UserAvatar photoURL={item.photoURL} username={item.name ?? ''} />
          }
          title={<span className="mr-0 md:mr-2">{item.name}</span>}
          className="flex flex-grow items-center"
        />
        {isSensitiveInfoHidden ? (
          <div className="text-gray-600">
            {item.email
              ?.substring(0, item.email?.indexOf('@'))
              .replace(/./g, '*')}
            {item.email?.substring(item.email?.indexOf('@'))}
          </div>
        ) : (
          <div className="text-gray-600">{item.email}</div>
        )}
      </Row>

      <Row className="flex w-full items-center justify-around md:justify-end">
        {userInfo.id !== item.id && (
          <Dropdown
            menu={{
              items: [
                role !== Role.PROFESSOR
                  ? {
                      key: Role.PROFESSOR,
                      label: 'Professor',
                    }
                  : null,
                role !== Role.TA
                  ? {
                      key: Role.TA,
                      label: 'Teaching Assistant',
                    }
                  : null,
                role !== Role.STUDENT
                  ? {
                      key: Role.STUDENT,
                      label: 'Student',
                    }
                  : null,
              ].filter(Boolean),
              onClick: (e) => {
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
              },
            }}
            className="flex-grow-0"
          >
            <a
              className="ant-dropdown-link"
              onClick={(e) => e.preventDefault()}
            >
              Change Role <DownOutlined />
            </a>
          </Dropdown>
        )}

        {(role === Role.TA || role === Role.PROFESSOR) && (
          // NOTE: if you modify this popover, you may also want to make changes to the popover in StaffList
          <Popover
            trigger="click"
            overlayClassName="min-w-80"
            content={
              <div className="flex flex-col gap-y-2">
                <TextArea
                  placeholder="Can answer questions about MATH 101, PHYS 102..."
                  autoSize={{ minRows: 4, maxRows: 7 }}
                  value={tempTaNotes}
                  onChange={(e) => {
                    setCanSave(e.target.value !== item.TANotes)
                    setTempTaNotes(e.target.value)
                  }}
                />
                <div className="flex items-center justify-start">
                  <Button
                    disabled={!canSave}
                    loading={saveLoading}
                    onClick={async () => {
                      setSaveLoading(true)
                      await API.course
                        .updateTANotes(courseId, item.id, tempTaNotes ?? '')
                        .then(() => {
                          setSaveSuccessful(true)
                          setCanSave(false)
                          item.TANotes = tempTaNotes
                          // saved goes away after 1s
                          setTimeout(() => {
                            setSaveSuccessful(false)
                          }, 1000)
                        })
                        .catch((e) => {
                          const errorMessage = getErrorMessage(e)
                          message.error(errorMessage)
                        })
                        .finally(() => {
                          setSaveLoading(false)
                        })
                    }}
                  >
                    Save
                  </Button>
                  <div>
                    {
                      <span
                        className={`ml-2 text-green-500 transition-opacity duration-300 ${
                          saveSuccessful ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        Saved!
                      </span>
                    }
                  </div>
                </div>
              </div>
            }
            title={
              <div className="flex items-center">
                <div>{item.name} - TA Notes</div>
                <div>
                  <Tooltip title="Here you can set notes on your TAs (e.g. the types of questions a TA can answer). Other users can then hover the TA to see these notes. TAs are able to modify their own notes.">
                    <span className="ml-2 text-gray-500">
                      <QuestionCircleOutlined />
                    </span>
                  </Tooltip>
                </div>
              </div>
            }
          >
            <Button
              icon={
                item.TANotes ? (
                  <NotebookText className="p-[0.075rem] text-gray-700 transition-colors duration-200 ease-out hover:text-[#5ba1d4]" />
                ) : (
                  <Notebook className="p-[0.075rem] transition-colors duration-200 ease-out hover:text-[#5ba1d4]" />
                )
              }
              className={cn(userInfo.id !== item.id && 'mx-2')}
            />
          </Popover>
        )}

        {userInfo.id !== item.id && (
          <Button
            icon={<UserDeleteOutlined />}
            danger
            className={role === Role.STUDENT ? 'ml-2' : ''}
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
      </Row>
    </List.Item>
  )
}

export default CourseRosterTable
