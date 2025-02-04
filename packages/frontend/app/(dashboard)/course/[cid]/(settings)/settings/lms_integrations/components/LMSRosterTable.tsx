import { API } from '@/app/api'
import UserAvatar from '@/app/components/UserAvatar'
import { useUserInfo } from '@/app/contexts/userContext'
import {
  LoadingOutlined,
  SearchOutlined,
  UserDeleteOutlined,
} from '@ant-design/icons'
import { LMSIntegrationPlatform, Role, UserPartial } from '@koh/common'
import {
  Button,
  Card,
  Input,
  List,
  message,
  Modal,
  Pagination,
  Spin,
  Statistic,
  Tag,
} from 'antd'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { checkNameAgainst, cn } from '@/app/utils/generalUtils'

type LMSRosterTableProps = {
  courseId: number
  lmsStudents: string[]
  lmsPlatform: LMSIntegrationPlatform
  loadingLMSData?: boolean
}

const LMSRosterTable: React.FC<LMSRosterTableProps> = ({
  courseId,
  lmsStudents,
  lmsPlatform,
  loadingLMSData = false,
}) => {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<UserPartial[]>([])
  const [totalUsers, setTotalUsers] = useState<number>(0)
  const [view, setView] = useState<boolean>(true)
  const { userInfo } = useUserInfo()

  const handleSearch = (event: any) => {
    setSearch(event.target.value)
    setPage(1)
  }

  useEffect(() => {
    ;(async () => {
      const data0 = await API.course.getUserInfo(courseId, 1, Role.STUDENT)
      setTotalUsers(data0.total)

      const numPages = Math.ceil(data0.total / 50)
      const students: UserPartial[] = [...data0.users]
      for (let i = 2; i <= numPages; i++) {
        const data = await API.course.getUserInfo(courseId, i, Role.STUDENT)
        students.push(...data.users)
      }
      students.sort((a: UserPartial, b: UserPartial) => {
        const aNotEnrolled = !checkNameAgainst(a.name ?? '', lmsStudents)
        const bNotEnrolled = !checkNameAgainst(b.name ?? '', lmsStudents)
        if (aNotEnrolled && !bNotEnrolled) {
          return -1
        } else if (bNotEnrolled && !aNotEnrolled) {
          return 1
        } else {
          return (a.name ?? '').localeCompare(b.name ?? '')
        }
      })
      setUsers(students)
    })()
  }, [courseId, lmsStudents])

  const lmsUsers = useMemo(() => {
    const studentNames = users.map((u) => u.name ?? '')
    const noMatch: string[] = lmsStudents.filter(
      (s) => !checkNameAgainst(s, studentNames),
    )
    const lmsUsers: UserPartial[] = []
    for (const name of noMatch) {
      lmsUsers.push({
        id: -1,
        name: name,
        photoURL: undefined,
      } satisfies UserPartial)
    }
    return lmsUsers
  }, [lmsStudents, users])

  const matchingUsers = useMemo(
    () =>
      users.filter((s) =>
        (s.name ?? '').toLowerCase().includes(search.toLowerCase()),
      ),
    [search, users],
  )
  const matchingLMSUsers = useMemo(
    () =>
      lmsUsers.filter((s) =>
        (s.name ?? '').toLowerCase().includes(search.toLowerCase()),
      ),
    [search, lmsUsers],
  )

  const paginatedLMSUsers = useMemo(
    () => matchingLMSUsers.slice((page - 1) * 50, page * 50),
    [page, matchingLMSUsers],
  )

  const paginatedUsers = useMemo(
    () => matchingUsers.slice((page - 1) * 50, page * 50),
    [page, matchingUsers],
  )

  const RosterItem: React.FC<{ item: UserPartial; className?: string }> = ({
    item,
    className,
  }) => {
    let tagText: ReactNode = `Enrolled in ${lmsPlatform ?? 'LMS'} Course`
    let tagColor = 'rgb(0,220,120)'
    if (loadingLMSData) {
      tagText = (
        <span className={'flex items-center gap-2'}>
          <Spin indicator={<LoadingOutlined spin />} size="small" />
          {`Loading ${lmsPlatform ?? 'LMS'} Data...`}
        </span>
      )
      tagColor = 'rgb(30,120,255)'
    } else if (
      item.id != -1 &&
      !checkNameAgainst(item.name ?? '', lmsStudents)
    ) {
      tagText = `Not enrolled in ${lmsPlatform ?? 'LMS'} Course`
      tagColor = 'rgb(255,50,70)'
    } else if (item.id == -1) {
      tagText = `No match in HelpMe students`
      tagColor = 'rgb(240,220,30)'
    }

    const hasTwin =
      item.id != -1 &&
      checkNameAgainst(
        item.name ?? '',
        users.filter((s) => s.id != item.id).map((s) => s.name ?? ''),
      )

    return (
      <List.Item
        key={item.id}
        className={cn(
          'flex items-center justify-between rounded-md border border-gray-100',
          className ?? '',
        )}
      >
        <div className={'w-2/5'}>
          <Tag color={tagColor}>{tagText}</Tag>
        </div>
        <List.Item.Meta
          avatar={
            <UserAvatar photoURL={item.photoURL} username={item.name ?? ''} />
          }
          title={
            <span className="mr-2">
              {item.name}{' '}
              {hasTwin && item.email != undefined && `(${item.email})`}
            </span>
          }
          className="flex flex-grow items-center"
        />
        {userInfo.id !== item.id && item.id != -1 && (
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
                      setTotalUsers((prev) => prev - 1)
                      setUsers((prev) => prev.filter((u) => u.id != item.id))
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

  const LMSUserList = (props: { items: UserPartial[] }) => {
    const { items } = props
    return (
      <List
        className={'p-2'}
        dataSource={items}
        loading={loadingLMSData}
        size="small"
        renderItem={(item: UserPartial) => <RosterItem item={item} />}
      ></List>
    )
  }

  const toggleView = (state: boolean) => {
    setPage(1)
    setSearch('')
    setView(state)
  }

  const noMatchHelpMe = useMemo(
    () =>
      users.filter((u) => !checkNameAgainst(u.name ?? '', lmsStudents)).length,
    [users, lmsStudents],
  )

  if (!users) {
    return <Spin tip="Loading..." size="large" />
  } else {
    const totalItems =
      view || lmsUsers.length <= 0 ? totalUsers : matchingLMSUsers.length
    return (
      <div>
        <div className="bg-white">
          <div>
            {lmsUsers.length > 0 && (
              <div className={'grid grid-cols-4 justify-center gap-2'}>
                <div></div>
                <Button
                  color={view ? 'primary' : 'default'}
                  variant={view ? 'solid' : 'outlined'}
                  onClick={() => toggleView(true)}
                >
                  HelpMe Roster
                </Button>
                <Button
                  color={!view ? 'primary' : 'default'}
                  variant={!view ? 'solid' : 'outlined'}
                  onClick={() => toggleView(false)}
                >
                  {lmsPlatform ?? 'LMS'} Roster
                </Button>
                <div></div>
              </div>
            )}
            <div
              className={
                'my-2 flex flex-col justify-start md:flex-row md:justify-between'
              }
            >
              <Input
                placeholder={'Search for students'}
                prefix={<SearchOutlined />}
                value={search}
                onInput={handleSearch}
              />
              {totalItems > 50 && (
                <Pagination
                  style={{ float: 'right' }}
                  current={page}
                  pageSize={50}
                  total={totalItems}
                  onChange={(page) => setPage(page)}
                  showSizeChanger={false}
                />
              )}
            </div>
            {view || lmsUsers.length <= 0 ? (
              <div className={'flex flex-col gap-4'}>
                <Card>
                  <Statistic
                    title={<span className={'text-xl'}>Missing Students</span>}
                    value={noMatchHelpMe}
                    formatter={(value) => (
                      <span>
                        <span className={'font-bold'}>
                          {value}{' '}
                          {(value as number) > 1 || (value as number) == 0
                            ? 'students'
                            : 'student'}
                        </span>
                        {(value as number) > 1 || (value as number) == 0
                          ? ' were'
                          : ' was'}
                        <span className={'text-red-500'}> not found </span>
                        in {lmsPlatform ?? 'LMS'} course.
                      </span>
                    )}
                  />
                </Card>
                <LMSUserList items={paginatedUsers} />
              </div>
            ) : (
              <div className={'flex flex-col gap-4'}>
                <Card>
                  <Statistic
                    title={<span className={'text-xl'}>Missing Students</span>}
                    value={lmsUsers.length}
                    formatter={(value) => (
                      <span>
                        <span className={'font-bold'}>
                          {value}{' '}
                          {(value as number) > 1 || (value as number) == 0
                            ? 'students'
                            : 'student'}
                        </span>
                        {(value as number) > 1 || (value as number) == 0
                          ? ' were'
                          : ' was'}
                        <span className={'text-red-500'}> not found </span>
                        in HelpMe course.
                      </span>
                    )}
                  />
                </Card>
                <LMSUserList items={paginatedLMSUsers} />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
}

export default LMSRosterTable
