import { Badge, Col, Input, List, Pagination, Row, Select, Tooltip } from 'antd'
import {
  DateRangeType,
  OrganizationRole,
  OrgRoleHistory,
  OrgUser,
} from '@koh/common'
import { cn } from '@/app/utils/generalUtils'
import UserAvatar from '@/app/components/UserAvatar'
import { ArrowBigRight } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import { API } from '@/app/api'
import { QuestionCircleOutlined, SearchOutlined } from '@ant-design/icons'
import DateOptionFilter from '@/app/(dashboard)/course/[cid]/(insights)/components/filters/DateOptionFilter'

const { Option } = Select
const roleOptions = Object.keys(OrganizationRole)
  .map((v) => v.toUpperCase())
  .filter((v, i, a) => a.indexOf(v) == i)
  .map((v) => `${v.charAt(0)}${v.substring(1).toLowerCase()}`)

const OrganizationRoleHistoryList: React.FC = () => {
  const { userInfo } = useUserInfo()

  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [history, setHistory] = useState<OrgRoleHistory[]>([])
  const [totalHistory, setTotalHistory] = useState<number>(0)

  const [fromRole, setFromRole] = useState<OrganizationRole | 'none'>('none')
  const [toRole, setToRole] = useState<OrganizationRole | 'none'>('none')

  const [dateRange, setDateRange] = useState<DateRangeType>({
    start: '',
    end: '',
  })

  const handleInput = (event: any) => {
    event.preventDefault()
    setInput(event.target.value)
  }

  const handleSearch = (event: any) => {
    event.preventDefault()
    setSearch(event.target.value)
    setPage(1)
  }

  const fetchHistory = async () => {
    let hasDate = !!(dateRange.start && dateRange.end)
    if (dateRange.start == 'Invalid Date' || dateRange.end == 'Invalid Date') {
      hasDate = false
      setDateRange({ start: '', end: '' })
    }

    const data = await API.organizations.getOrganizationRoleHistory(
      Number(userInfo?.organization?.orgId) ?? -1,
      page,
      {
        search: !search ? undefined! : search,
        fromRole: fromRole == 'none' ? undefined : fromRole,
        toRole: toRole == 'none' ? undefined : toRole,
        minDate: hasDate ? (dateRange.start as unknown as Date) : undefined,
        maxDate: hasDate ? (dateRange.end as unknown as Date) : undefined,
      },
    )
    setHistory(data.history)
    setTotalHistory(data.totalHistory)
  }

  useEffect(() => {
    fetchHistory().then()
  }, [userInfo?.organization?.orgId, page, search, fromRole, toRole, dateRange])

  return (
    <div>
      <Row gutter={16} className={'my-4'}>
        <Col span={6} className={'flex items-end'}>
          <Input
            placeholder={
              'Search for users involved in role change and press enter.'
            }
            prefix={<SearchOutlined />}
            value={input}
            onChange={handleInput}
            onPressEnter={handleSearch}
          />
        </Col>
        <Col flex={'auto'} />
        <Col span={6}>
          <Row gutter={16} className={'text-center font-semibold'}>
            <Col span={12}>From Role</Col>
            <Col span={12}>To Role</Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Select
                className={'w-full'}
                value={fromRole}
                onChange={setFromRole}
              >
                <Option key={'NoneOption'} value={'none'}>
                  None
                </Option>
                {roleOptions.map((key, index) => (
                  <Option key={index} value={key.toLowerCase()}>
                    {key}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col span={12}>
              <Select className={'w-full'} value={toRole} onChange={setToRole}>
                <Option key={'NoneOption'} value={'none'}>
                  None
                </Option>
                {roleOptions.map((key, index) => (
                  <Option key={index} value={key.toLowerCase()}>
                    {key}
                  </Option>
                ))}
              </Select>
            </Col>
          </Row>
        </Col>
        <Col span={6}>
          <Row>
            <Col span={24} className={'text-center font-semibold'}>
              Timeframe
            </Col>
          </Row>
          <Row>
            <Col span={24}>
              <DateOptionFilter
                setRange={setDateRange}
                customOnly={true}
                allowNone={true}
                dontShowTitle={true}
                dontIncludeDateSelectOptions={true}
              />
            </Col>
          </Row>
        </Col>
      </Row>
      <Row>
        <List
          className={'w-full'}
          dataSource={history}
          size="small"
          header={
            <Row className={'font-semibold'}>
              <Col span={4}>Date/Time</Col>
              <Col flex={'auto'} />
              <Col span={2} className={'flex justify-center'}>
                Previous Role
              </Col>
              <Col span={1} />
              <Col span={2} className={'flex justify-center'}>
                New Role
              </Col>
              <Col span={1} />
            </Row>
          }
          renderItem={(item) => <RoleChangeItem item={item} />}
          bordered
        />
        {totalHistory > 50 && (
          <Pagination
            style={{ float: 'right' }}
            current={page}
            pageSize={50}
            total={totalHistory}
            onChange={(page) => setPage(page)}
            showSizeChanger={false}
          />
        )}
      </Row>
    </div>
  )
}

export default OrganizationRoleHistoryList

const RoleBadge: React.FC<{ role: OrganizationRole }> = ({ role }) => {
  const badgeColor = useMemo(() => {
    switch (role) {
      case 'admin':
        return 'red'
      case 'professor':
        return 'blue'
      case 'member':
        return 'green'
      default:
        return 'gray'
    }
  }, [role])

  return (
    <Badge
      color={badgeColor}
      count={
        role
          ? `${role.charAt(0).toUpperCase()}${role.substring(1)}`
          : 'No Known Role'
      }
      showZero={true}
    />
  )
}

const UserItem: React.FC<{ user: OrgUser }> = ({ user }) => {
  let name = `${user.firstName ?? ''} ${user.lastName ?? ''}`
  if (!name.trim()) name = 'Deleted User'

  return (
    <div className={'flex flex-col items-center justify-center'}>
      <div className={'flex items-center gap-2'}>
        <UserAvatar
          photoURL={user.photoUrl ?? undefined}
          colour={'#8A8A8A'}
          username={name == 'Deleted User' ? '' : name}
        />
        <span className={'font-semibold'}>{name}</span>
      </div>
      <div>
        <RoleBadge role={user.organizationRole as OrganizationRole} />
      </div>
    </div>
  )
}

const RoleChangeItem: React.FC<{
  item: OrgRoleHistory
  className?: string
}> = ({ item, className }) => {
  return (
    <List.Item
      key={item.id}
      className={cn(
        'flex flex-col items-center justify-between px-1 py-2 md:flex-row md:px-4 md:py-4',
        className ?? '',
      )}
    >
      <Row className="flex w-full items-center justify-between">
        <Col span={4}>
          {item.timestamp
            ? new Date(item.timestamp).toLocaleDateString('US', {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : undefined}
        </Col>
        <Col span={4} className={'flex justify-center'}>
          <UserItem user={item.byUser} />
        </Col>
        <Col span={4} className={'flex justify-center'}>
          <p className={'text-center'}> changed role of </p>
        </Col>
        <Col span={4} className={'flex justify-center'}>
          <UserItem user={item.toUser} />
        </Col>
        <Col flex={'auto'} />
        <Col span={2} className={'flex justify-center'}>
          <RoleBadge role={item.fromRole} />
        </Col>
        <Col span={1} className={'flex justify-center'}>
          <ArrowBigRight />
        </Col>
        <Col span={2} className={'flex justify-center'}>
          <RoleBadge role={item.toRole} />
        </Col>
        <Col span={1}>
          {item.changeReason && (
            <Tooltip title={item.changeReason}>
              <QuestionCircleOutlined />
            </Tooltip>
          )}
        </Col>
      </Row>
    </List.Item>
  )
}
