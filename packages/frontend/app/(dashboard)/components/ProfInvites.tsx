'use client'

import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import {
  CopyOutlined,
  DeleteOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import {
  GetProfInviteResponse,
  OrganizationCourseResponse,
  OrganizationRole,
} from '@koh/common'
import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  InputNumber,
  List,
  message,
  Row,
  Tooltip,
} from 'antd'
import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const isInviteUsable = (profInvite: GetProfInviteResponse) => {
  console.log(profInvite)
  return (
    profInvite.expiresAt > new Date() &&
    profInvite.usesUsed < profInvite.maxUses
  )
}

interface FormValues {
  maxUses: number
  expiresAt: dayjs.Dayjs
  makeOrgProf: boolean
}

type ProfInvitesProps = {
  courseData: OrganizationCourseResponse
}

const ProfInvites: React.FC<ProfInvitesProps> = ({ courseData }) => {
  const [form] = Form.useForm()
  const { userInfo } = useUserInfo()
  const [profInvites, setProfInvites] = useState<GetProfInviteResponse[]>([])
  const [showUnusableProfInvites, setShowUnusableProfInvites] = useState(false)
  const [createProfInviteLoading, setCreateProfInviteLoading] = useState(false)

  const fetchProfInvites = async () => {
    if (userInfo.organization?.organizationRole !== OrganizationRole.ADMIN) {
      return // shouldn't be necessary since the component is only rendered if the user is an admin but just in case
    }
    if (courseData.organizationId && courseData.courseId) {
      await API.profInvites
        .getAll(courseData.organizationId, courseData.courseId)
        .then((profInvites) => {
          setProfInvites(profInvites)
        })
    } else {
      message.error(
        'Error fetching ProfInvites: organizationId or courseId not set',
      )
    }
  }

  const usableProfInvites = profInvites.filter((profInvite) =>
    isInviteUsable(profInvite),
  )
  const unusableProfInvites = profInvites.filter(
    (profInvite) => !isInviteUsable(profInvite),
  )

  useEffect(() => {
    fetchProfInvites()
  }, [])

  const handleCreateProfInvite = async (values: FormValues) => {
    setCreateProfInviteLoading(true)
    await API.profInvites
      .create(courseData.organizationId, {
        orgId: courseData.organizationId,
        courseId: courseData.courseId,
        maxUses: values.maxUses,
        expiresAt: values.expiresAt.toDate(),
        makeOrgProf: values.makeOrgProf,
      })
      .then(async () => {
        await fetchProfInvites()
      })
      .catch((error) => {
        message.error('Error creating ProfInvite: ' + getErrorMessage(error))
      })
    setCreateProfInviteLoading(false)
  }

  return (
    <Card
      variant="outlined"
      title={
        <div className="flex items-center justify-start gap-3">
          <div>Professor Invites (Admin Only)</div>
          <div className="text-gray-500">
            <Tooltip
              title={`For creating temporary invite links that will automatically promote the user to professor when accepted`}
            >
              Help <QuestionCircleOutlined />
            </Tooltip>
          </div>
        </div>
      }
    >
      <Form
        form={form}
        layout="horizontal"
        initialValues={{
          maxUses: 1,
          expiresAt: dayjs().add(7, 'day'),
          makeOrgProf: true,
        }}
        onFinish={handleCreateProfInvite}
      >
        <div className="flex w-full items-center justify-center gap-2 md:gap-4">
          <Form.Item name="maxUses" label="Max Uses">
            <InputNumber min={1} max={99999} className="w-12" />
          </Form.Item>
          <Form.Item name="expiresAt" label="Expires At">
            <DatePicker />
          </Form.Item>
          <Form.Item
            name="makeOrgProf"
            valuePropName="checked"
            label="Make Org Prof"
            tooltip="If checked, will also make the user an organization-level professor too."
          >
            <Checkbox />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className="lg:ml-6"
              loading={createProfInviteLoading}
              icon={<PlusOutlined />}
            >
              Create Prof Invite
            </Button>
          </Form.Item>
        </div>
      </Form>
      {usableProfInvites.length > 0 && (
        <List
          bordered
          dataSource={usableProfInvites}
          renderItem={(profInvite) => (
            <ProfInviteItem
              key={profInvite.id}
              profInvite={profInvite}
              orgId={courseData.organizationId}
              fetchProfInvites={fetchProfInvites}
            />
          )}
        />
      )}
      {unusableProfInvites.length > 0 &&
        (showUnusableProfInvites ? (
          <List
            bordered
            dataSource={unusableProfInvites}
            renderItem={(profInvite) => (
              <ProfInviteItem
                key={profInvite.id}
                profInvite={profInvite}
                orgId={courseData.organizationId}
                fetchProfInvites={fetchProfInvites}
              />
            )}
          />
        ) : (
          <div className="text-center text-zinc-800">
            {unusableProfInvites.length} expired/used invites (
            <Button
              className="inline-block"
              onClick={() => setShowUnusableProfInvites(true)}
              type="link"
            >
              show
            </Button>
            )
          </div>
        ))}
    </Card>
  )
}

const ProfInviteItem: React.FC<{
  profInvite: GetProfInviteResponse
  orgId: number
  fetchProfInvites: () => void
}> = ({ profInvite, orgId, fetchProfInvites }) => {
  const [copyLinkText, setCopyLinkText] = useState('Copy Link')
  const [isDeleteLoading, setIsDeleteLoading] = useState(false)

  const isHttps = window.location.protocol === 'https:'
  const baseURL = `${isHttps ? 'https' : 'http'}://${window.location.host}`
  const inviteURL = `${baseURL}/invite/prof/${profInvite.id}?&c=${profInvite.code}`

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteURL).then(() => {
      setCopyLinkText('Copied!')
      setTimeout(() => {
        setCopyLinkText('Copy Link')
      }, 1000)
    })
  }

  const expiresAt = dayjs(profInvite.expiresAt)
  const isInviteUnusable = !isInviteUsable(profInvite)

  return (
    <List.Item className={cn(isInviteUnusable ? 'opacity-80 grayscale' : '')}>
      <div className="flex w-full flex-col items-center gap-2 md:gap-4">
        <div className="flex w-full items-center justify-center gap-2">
          <div className="flex w-full items-center justify-between gap-2">
            {/* empty div for centering invite link */}
            <div className="w-0 md:w-4 lg:w-8"></div>
            <div className="flex items-center justify-center gap-2">
              <div>{isInviteUnusable ? <s>{inviteURL}</s> : inviteURL}</div>
              {!isInviteUnusable && (
                <Button
                  onClick={handleCopy}
                  type="primary"
                  className=""
                  icon={<CopyOutlined />}
                >
                  {copyLinkText}
                </Button>
              )}
            </div>
            <Button
              danger
              loading={isDeleteLoading}
              onClick={async () => {
                setIsDeleteLoading(true)
                await API.profInvites
                  .delete(orgId, profInvite.id)
                  .then(() => {
                    message.success('Professor invite deleted')
                  })
                  .catch((error) => {
                    message.error(
                      'Error deleting ProfInvite: ' + getErrorMessage(error),
                    )
                  })
                  .finally(() => {
                    setIsDeleteLoading(false)
                    fetchProfInvites()
                  })
              }}
              icon={<DeleteOutlined />}
            />
          </div>
        </div>
        <div className="flex w-full items-center justify-center gap-2 md:gap-4">
          <div className="text-zinc-700">
            <span
              className={
                profInvite.usesUsed >= profInvite.maxUses ? 'text-red-700' : ''
              }
            >
              {profInvite.usesUsed}
            </span>{' '}
            / {profInvite.maxUses} uses used
          </div>
          <Tooltip title={expiresAt.format('YYYY-MM-DD hh:mm A')}>
            <div className="text-zinc-700">
              Expire{expiresAt.isAfter(dayjs()) ? 's' : 'd'}{' '}
              <span
                className={expiresAt.isBefore(dayjs()) ? 'text-red-700' : ''}
              >
                {expiresAt.fromNow()}
              </span>
            </div>
          </Tooltip>
          <Tooltip
            title={
              <div className="flex flex-col gap-1">
                <div>Admin: {profInvite.adminUser.name}</div>
                <div>Email: {profInvite.adminUser.email}</div>
                <div>UserID: {profInvite.adminUser.id}</div>
                <div>
                  Created At:{' '}
                  {dayjs(profInvite.createdAt).format('YYYY-MM-DD hh:mm A')}
                </div>
                <div>This admin will be notified when the invite is used.</div>
              </div>
            }
          >
            <div>
              <div className="text-zinc-500">
                Created By: {profInvite.adminUser.name}{' '}
                {dayjs(profInvite.createdAt).fromNow()}
              </div>
            </div>
          </Tooltip>
          <div className="text-zinc-500">
            Make Org Prof:{' '}
            {profInvite.makeOrgProf ? (
              <span className="text-green-700 opacity-50"> Yes </span>
            ) : (
              <span className="text-red-700 opacity-50"> No </span>
            )}
          </div>
        </div>
      </div>
    </List.Item>
  )
}

export default ProfInvites
