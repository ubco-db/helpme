import {
  Button,
  message,
  Table,
  TableColumnsType,
  Tooltip,
  Popconfirm,
  Alert,
  Card,
} from 'antd'
import { GetProfInviteResponse } from '@koh/common'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import useSWRImmutable from 'swr/immutable'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { DeleteOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { KeyedMutator } from 'swr'

dayjs.extend(relativeTime)

interface AllProfInvitesProps {
  orgId: number
}

export const AllProfInvites: React.FC<AllProfInvitesProps> = ({ orgId }) => {
  // trying out useSWRImmutable as an experiment.
  // It's basically the same as having 3 useState variables (data, error, isLoading) condensed into one
  // Difference between "useSWR" and "useSWRImmutable" is that this disables all the extra API calls and validation n whatnot that comes loaded with swr
  const {
    data: profInvites,
    error,
    isLoading,
    mutate: mutateProfInvites,
  } = useSWRImmutable(
    `organization/${orgId}/profInvites`,
    async () => await API.profInvites.getAll(orgId),
  )

  const columns: TableColumnsType<GetProfInviteResponse> = [
    {
      title: 'piid',
      dataIndex: 'id',
      key: 'id',
      width: 20,
    },
    {
      title: 'Course',
      children: [
        {
          title: 'Name',
          dataIndex: ['course', 'name'],
          key: 'courseName',
          sorter: (a, b) => a.course.name.localeCompare(b.course.name),
        },
        {
          title: 'id',
          dataIndex: ['course', 'id'],
          key: 'courseId',
          minWidth: 20,
          sorter: (a, b) => a.course.id - b.course.id,
        },
      ],
    },
    {
      title: 'Creator',
      children: [
        {
          title: 'Name',
          dataIndex: ['adminUser', 'name'],
          key: 'adminUserName',
          sorter: (a, b) => a.adminUser.name.localeCompare(b.adminUser.name),
          render: (text: string, record) => (
            <Tooltip title={record.adminUser.email}>{text}</Tooltip>
          ),
        },
        {
          title: 'id',
          dataIndex: ['adminUser', 'id'],
          key: 'adminUserId',
          minWidth: 20,
        },
      ],
    },
    {
      title: 'Uses / MaxUses',
      dataIndex: 'usesUsed',
      key: 'usesUsed',
      // sort by the number of uses remaining
      sorter: (a, b) => a.maxUses - a.usesUsed - (b.maxUses - b.usesUsed),
      render: (text: string, record) => (
        <span
          className={
            record.maxUses - record.usesUsed <= 0 ? 'text-zinc-400' : ''
          }
        >
          {text} / {record.maxUses}
        </span>
      ),
    },
    {
      title: 'Expires At',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      sorter: (a, b) => a.expiresAt.getTime() - b.expiresAt.getTime(),
      render: (_, record) => {
        const expiresAt = dayjs(record.expiresAt)
        return (
          <span className={expiresAt.isBefore(dayjs()) ? 'text-zinc-400' : ''}>
            <Tooltip title={expiresAt.format('YYYY-MM-DD hh:mm A')}>
              {expiresAt.fromNow()}
            </Tooltip>
          </span>
        )
      },
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      render: (_, record) => {
        const createdAt = dayjs(record.createdAt)
        return (
          <Tooltip title={createdAt.format('YYYY-MM-DD hh:mm A')}>
            {createdAt.fromNow()}
          </Tooltip>
        )
      },
      defaultSortOrder: 'descend',
    },
    {
      title: 'MakeOrgProf',
      dataIndex: 'makeOrgProf',
      key: 'makeOrgProf',
      minWidth: 20,
      render: (_, record) => <>{record.makeOrgProf ? '✓' : 'X'}</>,
    },
    {
      title: '',
      key: 'action',
      render: (_, record) => (
        <DeleteProfInviteButton
          orgId={orgId}
          record={record}
          mutateProfInvites={mutateProfInvites}
        />
      ),
    },
  ]
  if (error) {
    return (
      <Alert
        type="warning"
        message={`Error getting all prof invites: ${getErrorMessage(error)}`}
      />
    )
  } else {
    return (
      <Card
        className="mb-2 w-full"
        title="All Prof Invites"
        variant="outlined"
        classNames={{
          body: 'px-0.5 md:px-0 py-0',
        }}
      >
        <Table
          dataSource={profInvites}
          columns={columns}
          loading={isLoading}
          rowKey={(record) => record.id}
          tableLayout="auto"
          scroll={{ x: 'max-content' }}
          bordered
          size="small"
        />
      </Card>
    )
  }
}

const DeleteProfInviteButton: React.FC<{
  orgId: number
  record: GetProfInviteResponse
  mutateProfInvites: KeyedMutator<GetProfInviteResponse[]>
}> = ({ orgId, record, mutateProfInvites }) => {
  const [isDeleteLoading, setIsDeleteLoading] = useState(false)

  return (
    <Popconfirm
      title="You sure?"
      onConfirm={() => {
        setIsDeleteLoading(true)
        API.profInvites
          .delete(orgId, record.id)
          .then(() => {
            // remove the prof invite from the local data source
            mutateProfInvites((data) =>
              (data ?? []).filter(
                (existingInvite) => existingInvite.id !== record.id,
              ),
            )
          })
          .catch((err) => {
            message.error(getErrorMessage(err))
          })
          .finally(() => setIsDeleteLoading(false))
      }}
      okText="Yes"
      okButtonProps={{ loading: isDeleteLoading }}
      cancelText="Cancel"
    >
      <Button danger loading={isDeleteLoading} icon={<DeleteOutlined />} />
    </Popconfirm>
  )
}
