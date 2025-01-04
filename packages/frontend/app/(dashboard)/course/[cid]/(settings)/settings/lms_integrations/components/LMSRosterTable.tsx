import { API } from '@/app/api'
import UserAvatar from '@/app/components/UserAvatar'
import { useUserInfo } from '@/app/contexts/userContext'
import {
  LoadingOutlined,
  SearchOutlined,
  UserDeleteOutlined,
} from '@ant-design/icons'
import { LMSIntegration, Role, UserPartial } from '@koh/common'
import {
  Badge,
  Button,
  Input,
  List,
  message,
  Modal,
  Pagination,
  Spin,
} from 'antd'
import { ReactNode, useEffect, useState } from 'react'
import { checkNameAgainst, cn } from '@/app/utils/generalUtils'

type LMSRosterTableProps = {
  courseId: number
  lmsStudents: string[]
  lmsPlatform: LMSIntegration
  loadingLMSData?: boolean
}

const LMSRosterTable: React.FC<LMSRosterTableProps> = ({
  courseId,
  lmsStudents,
  lmsPlatform,
  loadingLMSData = false,
}) => {
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<UserPartial[]>([])
  const [totalUsers, setTotalUsers] = useState<number>(0)
  const [updateFlag, setUpdateFlag] = useState<boolean>(true)
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
    const data = await API.course.getUserInfo(
      courseId,
      page,
      Role.STUDENT,
      search,
    )
    setUsers(data.users)
    setTotalUsers(data.total)
  }

  useEffect(() => {
    fetchUsers().then()
  }, [page, search, courseId, updateFlag])

  const RosterItem: React.FC<{ item: UserPartial; className?: string }> = ({
    item,
    className,
  }) => {
    let ribbonText: ReactNode = `Enrolled in ${lmsPlatform ?? 'LMS'} Course`
    let ribbonColor = 'rgb(0,220,120)'
    if (loadingLMSData) {
      ribbonText = (
        <span className={'flex items-center gap-2'}>
          <Spin indicator={<LoadingOutlined spin />} size="small" />
          {`Loading ${lmsPlatform ?? 'LMS'} Data...`}
        </span>
      )
      ribbonColor = 'cyan'
    } else if (!checkNameAgainst(item.name ?? '', lmsStudents)) {
      ribbonText = `Not enrolled in ${lmsPlatform ?? 'LMS'} Course`
      ribbonColor = 'red'
    }
    return (
      <Badge.Ribbon text={ribbonText} color={ribbonColor} placement={'start'}>
        <List.Item
          key={item.id}
          className={cn(
            'flex items-center justify-between rounded-md border border-gray-100',
            className ?? '',
          )}
        >
          <div className={'w-2/5'}></div>
          <List.Item.Meta
            avatar={
              <UserAvatar photoURL={item.photoURL} username={item.name ?? ''} />
            }
            title={<span className="mr-2">{item.name}</span>}
            className="flex flex-grow items-center"
          />
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
      </Badge.Ribbon>
    )
  }

  if (!users) {
    return <Spin tip="Loading..." size="large" />
  } else {
    return (
      <div>
        <div className="bg-white">
          <div
            className={
              'my-2 flex flex-col justify-start md:flex-row md:justify-between'
            }
          >
            <Input
              placeholder={'Search for students and press enter'}
              prefix={<SearchOutlined />}
              value={input}
              onChange={handleInput}
              onPressEnter={handleSearch}
            />
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
          </div>
          <List
            className={'p-2'}
            dataSource={users}
            loading={loadingLMSData}
            size="small"
            renderItem={(item: UserPartial) => <RosterItem item={item} />}
          ></List>
        </div>
      </div>
    )
  }
}

export default LMSRosterTable
