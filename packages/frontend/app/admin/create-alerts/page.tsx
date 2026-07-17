'use client'

import { API } from '@/app/api'
import ExpandableText from '@/app/components/ExpandableText'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { formatDateAndTimeForExcel } from '@/app/utils/timeFormatUtils'
import {
  GetAdminNoticeAlert,
  AlertDeliveryMode,
  OrganizationRole,
  Role,
  CreateAlertAdminRequest,
  AdminNoticeTarget,
} from '@koh/common'
import {
  Button,
  Card,
  message,
  Popconfirm,
  Progress,
  Table,
  Tag,
  Tooltip,
  Space,
  Alert as AntdAlert,
  Checkbox,
  Form,
  FormProps,
  Input,
  Segmented,
  InputNumber,
} from 'antd'
import { useState } from 'react'
import useSWRImmutable from 'swr/immutable'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

type TargetType = 'All' | 'Org' | 'Course' | 'User'

type FormValues = {
  targetType: TargetType

  targetOrgRole?: OrganizationRole | null
  targetOrgId?: number

  targetCourseId?: number
  targetCourseRole?: Role | null

  targetUserId?: number

  title: string
  message: string
  deliveryMode: AlertDeliveryMode
}

const CreateAdminAlertsPage: React.FC = () => {
  const { userInfo } = useUserInfo()

  const {
    data: existingAdminAlerts,
    error: existingAdminAlertsError,
    isLoading: existingAdminAlertsIsLoading,
    mutate: mutateExistingAdminAlerts,
  } = useSWRImmutable(
    `alerts/admin-notice`,
    async () => await API.alerts.adminOnly.get(),
  )

  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  // Need to delete by sentAt since Admin Notices may have sent out hundreds of alerts and sentAt pretty much works as a unique identifier in this case
  const handleDelete = async (sentAt: Date) => {
    const sentAtStr = new Date(sentAt).toISOString()
    setDeleteLoading(sentAtStr)
    // optimistic removal
    mutateExistingAdminAlerts(
      (prev) =>
        prev
          ? prev.filter((a) => new Date(a.sentAt).toISOString() !== sentAtStr)
          : [],
      { revalidate: false },
    )
    await API.alerts.adminOnly
      .delete({ sentAt })
      .then((result) => {
        message.success(`Deleted ${result.numDeleted} alerts`)
      })
      .catch((error) => {
        message.error(`Error deleting alerts: ${getErrorMessage(error)}`)
        mutateExistingAdminAlerts() // revalidate on failure
      })
      .finally(() => {
        setDeleteLoading(null)
      })
  }

  const [form] = Form.useForm<FormValues>()
  const [createAlertLoading, setCreateAlertLoading] = useState(false)
  const onFinish: FormProps<FormValues>['onFinish'] = async (values) => {
    setCreateAlertLoading(true)

    const target: AdminNoticeTarget | undefined =
      values.targetType === 'All'
        ? undefined
        : values.targetType === 'Org'
          ? {
              orgId: values.targetOrgId,
              orgRole: values.targetOrgRole ?? undefined,
            }
          : values.targetType === 'Course'
            ? {
                courseId: values.targetCourseId,
                courseRole: values.targetCourseRole ?? undefined,
              }
            : values.targetType === 'User'
              ? {
                  userId: values.targetUserId,
                }
              : undefined

    const requestBody: CreateAlertAdminRequest = {
      deliveryMode: values.deliveryMode,
      payload: {
        title: values.title || 'Admin Notice',
        message: values.message,
        creatorId: userInfo.id,
        creatorName: userInfo.name,
        target: target,
      },
    }
    await API.alerts.adminOnly
      .create(requestBody)
      .then(({ numSent, sentAt }) => {
        if (numSent > 0) {
          mutateExistingAdminAlerts([
            ...(existingAdminAlerts || []),
            {
              deliveryMode: values.deliveryMode,
              sentAt: sentAt,
              title: values.title || 'Admin Notice',
              message: values.message,
              creatorName: userInfo.name,
              creatorId: userInfo.id,
              totalRead: 0,
              totalSent: numSent,
              target: target,
            },
          ])
        }
        message.success(
          `Successfully sent a ${values.deliveryMode === AlertDeliveryMode.MODAL ? 'modal' : 'feed'} alert to ${numSent} user${numSent === 1 ? '' : 's'}.`,
        )
      })
      .catch((error) => {
        message.error(`Error creating alert: ${getErrorMessage(error)}`)
      })
      .finally(() => {
        setCreateAlertLoading(false)
      })
  }

  const targetTypeValue = Form.useWatch('targetType', form)

  return (
    <>
      <title>HelpMe Admin - Create Notices</title>
      <Card className="overflow-hidden rounded-lg border border-gray-100 shadow-md">
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-800">
                Admin Notices
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Create alerts targeting any number of users in the system. You
                can choose to make it a Modal alert or a Feed alert.
              </p>
            </div>
          </div>

          <Form
            form={form}
            name="basic"
            labelCol={{ span: 8 }}
            wrapperCol={{ span: 16 }}
            style={{ maxWidth: 600 }}
            initialValues={{
              targetType: 'User',
              deliveryMode: AlertDeliveryMode.FEED,
              message: '',
              targetOrgId: 1,
              title: 'Admin Notice',
            }}
            onFinish={onFinish}
          >
            <Form.Item<FormValues> label="Title" name="title">
              <Input placeholder="Admin Notice" />
            </Form.Item>

            <Form.Item<FormValues>
              label="Message"
              name="message"
              rules={[{ required: true, message: 'Please enter a message!' }]}
            >
              <Input.TextArea rows={5} />
            </Form.Item>
            <Form.Item<FormValues> label="Delivery Mode" name="deliveryMode">
              <Segmented<AlertDeliveryMode>
                options={[
                  {
                    value: AlertDeliveryMode.MODAL,
                    label: 'Modal',
                  },
                  {
                    value: AlertDeliveryMode.FEED,
                    label: 'Feed',
                  },
                ]}
              />
            </Form.Item>
            <Form.Item<FormValues> label="Target Type" name="targetType">
              <Segmented<TargetType>
                options={['User', 'Course', 'Org', 'All']}
              />
            </Form.Item>

            {targetTypeValue === 'User' && (
              <Form.Item<FormValues>
                label="Target User ID"
                name="targetUserId"
                tooltip="You can go to the Users page under Organization Settings to find the userId of who you want to message. I didn't want to spend the time to add a user search selector here."
                rules={[
                  { required: true, message: 'Target User ID is required' },
                ]}
              >
                <InputNumber min={0} />
              </Form.Item>
            )}

            {targetTypeValue === 'Course' && (
              <>
                <Form.Item<FormValues>
                  label="Target Course ID"
                  name="targetCourseId"
                  tooltip="You can find course IDs in the URL of the course page or on the Courses page under Organization Settings"
                  rules={[
                    { required: true, message: 'Target Course ID is required' },
                  ]}
                >
                  <InputNumber min={0} />
                </Form.Item>
                <Form.Item<FormValues>
                  label="Target Course Role"
                  name="targetCourseRole"
                >
                  <Segmented<Role | null>
                    options={[
                      { value: null, label: 'Everyone in Course' },
                      { value: Role.STUDENT, label: 'Students' },
                      { value: Role.TA, label: 'TAs' },
                      { value: Role.PROFESSOR, label: 'Professors' },
                    ]}
                  />
                </Form.Item>
              </>
            )}

            {targetTypeValue === 'Org' && (
              <>
                <Form.Item<FormValues>
                  label="Target Organization ID"
                  tooltip="(UBC is org ID 1)"
                  name="targetOrgId"
                  rules={[
                    { required: true, message: 'Target Org ID is required' },
                  ]}
                >
                  <InputNumber min={0} />
                </Form.Item>
                <Form.Item<FormValues>
                  label="Target Organization Role"
                  name="targetOrgRole"
                >
                  <Segmented<OrganizationRole | null>
                    options={[
                      { value: null, label: 'Everyone in Org' },
                      { value: OrganizationRole.MEMBER, label: 'Members' },
                      {
                        value: OrganizationRole.PROFESSOR,
                        label: 'Org Professors',
                      },
                      { value: OrganizationRole.ADMIN, label: 'Org Admins' },
                    ]}
                  />
                </Form.Item>
              </>
            )}

            <Form.Item label={null}>
              <Button
                type="primary"
                htmlType="submit"
                loading={createAlertLoading}
              >
                Submit
              </Button>
            </Form.Item>
          </Form>

          {existingAdminAlertsError && (
            <AntdAlert
              type="error"
              message={`Error loading admin alerts: ${getErrorMessage(existingAdminAlertsError)}`}
            />
          )}

          <Table<GetAdminNoticeAlert>
            size="small"
            tableLayout="auto"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `${total} notice${total !== 1 ? 's' : ''}`,
            }}
            rootClassName="overflow-x-auto"
            loading={existingAdminAlertsIsLoading}
            columns={[
              {
                title: 'Delivery',
                dataIndex: 'deliveryMode',
                key: 'deliveryMode',
                width: 90,
                render: (mode: AlertDeliveryMode) => {
                  const color =
                    mode === AlertDeliveryMode.MODAL ? 'orange' : 'cyan'
                  return <Tag color={color}>{mode.toUpperCase()}</Tag>
                },
                filters: [
                  { text: 'MODAL', value: AlertDeliveryMode.MODAL },
                  { text: 'FEED', value: AlertDeliveryMode.FEED },
                ],
                onFilter: (value: any, record: GetAdminNoticeAlert) =>
                  record.deliveryMode === value,
              },
              {
                title: 'Title',
                dataIndex: 'title',
                key: 'title',
                minWidth: 120,
                render: (title: string) => (
                  <div className="text-wrap break-all">
                    <Tooltip title={title}>
                      <span className="font-medium">
                        {title || 'Admin Notice'}
                      </span>
                    </Tooltip>
                  </div>
                ),
              },
              {
                title: 'Message',
                dataIndex: 'message',
                key: 'message',
                minWidth: 120,
                render: (msg: string) => (
                  <div className="text-wrap break-all">
                    <ExpandableText maxRows={2}>{msg || '-'}</ExpandableText>
                  </div>
                ),
              },
              {
                title: 'Sender',
                key: 'sender',
                width: 100,
                render: (_: any, record: GetAdminNoticeAlert) => (
                  <div>
                    <div className="font-medium text-gray-700">
                      {record.creatorName || '-'}
                    </div>
                    {record.creatorId && (
                      <div className="text-xs text-gray-400">
                        ID: {record.creatorId}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                title: 'Target',
                key: 'target',
                width: 150,
                render: (_: any, record: GetAdminNoticeAlert) => {
                  const target = record.target
                  if (!target) {
                    return <Tag color="geekblue">All Users</Tag>
                  }

                  if (target.userId !== undefined && target.userId !== null) {
                    return (
                      <Space direction="vertical" size={2}>
                        <Tag color="purple">Specific User</Tag>
                        <span className="font-mono text-xs text-gray-600">
                          User ID: {target.userId}
                        </span>
                      </Space>
                    )
                  }

                  if (target.orgId !== undefined && target.orgId !== null) {
                    return (
                      <Space direction="vertical" size={2}>
                        <div>
                          <Tag color="blue">Organization</Tag>
                          <span className="font-mono text-xs">
                            ID: {target.orgId}
                          </span>
                        </div>
                        {target.orgRole && (
                          <div className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                            Role: {target.orgRole}
                          </div>
                        )}
                      </Space>
                    )
                  }

                  if (
                    target.courseId !== undefined &&
                    target.courseId !== null
                  ) {
                    return (
                      <Space direction="vertical" size={2}>
                        <div>
                          <Tag color="magenta">Course</Tag>
                          <span className="font-mono text-xs">
                            ID: {target.courseId}
                          </span>
                        </div>
                        {target.courseRole && (
                          <div className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                            Role: {target.courseRole}
                          </div>
                        )}
                      </Space>
                    )
                  }

                  return <Tag color="geekblue">???</Tag>
                },
              },
              {
                title: 'Sent At',
                dataIndex: 'sentAt',
                key: 'sentAt',
                width: 90,
                render: (sentAt: Date) => (
                  <>
                    <Tooltip title={formatDateAndTimeForExcel(sentAt)}>
                      <span>{dayjs(sentAt).fromNow()}</span>
                    </Tooltip>
                  </>
                ),
                sorter: (a: GetAdminNoticeAlert, b: GetAdminNoticeAlert) =>
                  a.sentAt.getTime() - b.sentAt.getTime(),
                defaultSortOrder: 'descend',
              },
              {
                title: 'Read',
                key: 'read',
                width: 70,
                render: (_: any, record: GetAdminNoticeAlert) => {
                  const percent =
                    record.totalSent > 0
                      ? Math.round((record.totalRead / record.totalSent) * 100)
                      : 0
                  const progressStatus = percent === 100 ? 'success' : 'active'
                  return (
                    <Tooltip
                      title={`${record.totalRead} of ${record.totalSent} recipients have read this notice`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-gray-700">
                          {record.totalRead}/{record.totalSent}
                        </span>
                        <Progress
                          percent={percent}
                          size="small"
                          status={progressStatus}
                          showInfo={false}
                          strokeColor={percent === 100 ? '#52c41a' : '#1677ff'}
                        />
                      </div>
                    </Tooltip>
                  )
                },
                sorter: (a: GetAdminNoticeAlert, b: GetAdminNoticeAlert) => {
                  const pctA = a.totalSent > 0 ? a.totalRead / a.totalSent : 0
                  const pctB = b.totalSent > 0 ? b.totalRead / b.totalSent : 0
                  return pctA - pctB
                },
              },
              {
                title: '',
                key: 'actions',
                width: 70,
                render: (_: any, record: GetAdminNoticeAlert) => (
                  <Popconfirm
                    title="Delete Notice Batch"
                    description={`Delete all ${record.totalSent} alerts from this batch?`}
                    onConfirm={() => handleDelete(record.sentAt)}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      loading={
                        deleteLoading === new Date(record.sentAt).toISOString()
                      }
                    >
                      Delete
                    </Button>
                  </Popconfirm>
                ),
              },
            ]}
            dataSource={existingAdminAlerts || []}
            rowKey={(record) => record.sentAt?.toString()}
            className="overflow-hidden rounded-lg border border-gray-100"
          />
        </div>
      </Card>
    </>
  )
}

export default CreateAdminAlertsPage
