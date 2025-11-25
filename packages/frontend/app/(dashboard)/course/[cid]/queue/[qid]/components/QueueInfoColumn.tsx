import {
  ClearOutlined,
  CloudSyncOutlined,
  DeleteOutlined,
  DownOutlined,
  FrownOutlined,
  MenuOutlined,
  NotificationOutlined,
  StopOutlined,
  UpOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons'
import { Button, Popconfirm, Row, Switch, Tooltip } from 'antd'
import moment from 'moment'
import React, { ReactNode, useState } from 'react'
import { useQueue } from '@/app/hooks/useQueue'
import Linkify from '@/app/components/Linkify'
import { useRouter } from 'next/navigation'
import {
  clearQueue,
  confirmDisable,
} from '../../../utils/commonCourseFunctions'
import {
  ClearQueueButton,
  DisableQueueButton,
} from '../../../components/QueueInfoColumnButton'
import RenderEvery from '@/app/components/RenderEvery'
import TagGroupSwitch from './TagGroupSwitch'
import StaffList from './StaffList'
import { getQueueTypeLabel } from '../utils/commonQueueFunctions'
import { QueuePartial, GetQueueChatsResponse, ExtraTAStatus } from '@koh/common'
import { useUserInfo } from '@/app/contexts/userContext'
import { API } from '@/app/api'

interface QueueInfoColumnProps {
  cid: number
  queueId: number
  queue: QueuePartial
  isStaff: boolean
  buttons: ReactNode
  hasDemos: boolean
  tagGroupsEnabled: boolean
  setTagGroupsEnabled: (tagGroupsEnabled: boolean) => void
  staffListHidden: boolean
  setStaffListHidden: (hidden: boolean) => void
  queueChats?: GetQueueChatsResponse
}

const QueueInfoColumn: React.FC<QueueInfoColumnProps> = ({
  cid,
  queueId,
  queue,
  isStaff,
  buttons,
  hasDemos,
  tagGroupsEnabled,
  setTagGroupsEnabled,
  staffListHidden,
  setStaffListHidden,
  queueChats,
}) => {
  const router = useRouter()
  const { userInfo } = useUserInfo()

  const me = queue?.staffList?.find((s) => s.id === userInfo?.id)
  const isAway = me?.extraStatus === ExtraTAStatus.AWAY
  const [savingAway, setSavingAway] = useState(false)
  const toggleAway = async (checked: boolean) => {
    // checked = Answering; unchecked = Away
    const newStatus = checked ? null : ExtraTAStatus.AWAY
    try {
      setSavingAway(true)
      await API.taStatus.setExtraStatus(cid, queueId, newStatus)
    } finally {
      setSavingAway(false)
    }
  }
  return (
    <div className="relative flex flex-shrink-0 flex-col pb-1 md:mt-8 md:w-72 md:pb-7">
      {/* only show the queue title and warning here on desktop, it's moved further down on mobile (and placed in queue page.tsx) */}
      <div className="justify-left mb-0 hidden items-center md:mb-2 md:flex">
        <h2 className="mb-0 inline-block text-2xl font-bold text-[#212934]">
          {queue?.room} {queue?.isDisabled && <b>(disabled)</b>}
        </h2>

        <div className="flex flex-row items-center">
          {!queue?.allowQuestions && (
            <Tooltip title="This queue is no longer accepting questions">
              <StopOutlined className="ml-2 text-2xl text-red-500" />
            </Tooltip>
          )}
        </div>
      </div>

      {queue?.notes && (
        <div className="hidden sm:block">
          <div className="mb-0 flex items-center text-xl text-[#5f6b79] md:mb-5">
            <NotificationOutlined />
            <div className="max-h-[200px] w-full overflow-y-auto">
              <Linkify>
                <div className="ml-3 min-w-0 whitespace-pre-wrap break-words text-sm italic md:text-base">
                  {queue.notes}
                </div>
              </Linkify>
            </div>
          </div>
        </div>
      )}

      {queue?.type && (
        <div className="hidden sm:block">
          <div className="mb-0 flex items-center text-xl text-[#5f6b79] md:mb-5">
            <EnvironmentOutlined />
            <div className="ml-3 min-w-0 whitespace-pre-wrap break-words text-sm italic md:text-base">
              {getQueueTypeLabel(queue.type)}
            </div>
          </div>
        </div>
      )}

      {/* buttons and queueUpToDateInfo for desktop (has different order than mobile)*/}
      <div className="hidden sm:block">
        <QueueUpToDateInfo queueId={queueId} />
        {isStaff && (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm text-[#5f6b79]">Away</span>
            <Switch
              checkedChildren="Answering"
              unCheckedChildren="Away"
              checked={!isAway}
              onChange={toggleAway}
              loading={savingAway}
            />
          </div>
        )}
        {buttons}
      </div>

      <div className="flex md:mt-3">
        <h3 className="mb-0 text-2xl font-semibold">Staff</h3>
        {/* Button to hide staff list on mobile */}
        <Button
          className="md:hidden"
          onClick={() => setStaffListHidden(!staffListHidden)}
          type="text"
          icon={staffListHidden ? <UpOutlined /> : <DownOutlined />}
        />
      </div>
      {queue?.staffList && queue.staffList.length < 1 ? (
        <div
          role="alert"
          className="border-l-4 border-orange-500 bg-orange-100 p-4 text-orange-700"
        >
          <p> No staff checked in</p>
        </div>
      ) : !staffListHidden ? (
        <StaffList queue={queue} queueId={queueId} courseId={cid} />
      ) : null}

      {/* buttons for staff on mobile */}
      {isStaff && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-y-2 md:hidden">
          {buttons}
        </div>
      )}

      {isStaff && (
        // "Clear Queue" and "Delete Queue" buttons for DESKTOP ONLY - mobile is in EditQueueModal.tsx
        <div className="bottom-0 hidden h-full w-full flex-col justify-end text-white md:flex">
          <Popconfirm
            title={
              'Are you sure you want to clear all students from the queue?'
            }
            okText="Yes"
            cancelText="No"
            placement="top"
            getPopupContainer={(trigger) => trigger.parentNode as HTMLElement}
            arrow={{ pointAtCenter: true }}
            onConfirm={() => clearQueue(queueId, queue)}
          >
            <ClearQueueButton icon={<ClearOutlined />}>
              Clear Queue
            </ClearQueueButton>
          </Popconfirm>
          <DisableQueueButton
            onClick={() =>
              confirmDisable(queueId, queue, router, `/course/${cid}`)
            }
            disabled={queue?.isDisabled}
            icon={<DeleteOutlined />}
          >
            {queue?.isDisabled ? `Queue deleted` : `Delete Queue`}
          </DisableQueueButton>
        </div>
      )}

      {/* mobile only */}
      {!isStaff && (
        <div className="mt-2 flex w-full items-center justify-around gap-y-2 md:hidden">
          {buttons}
        </div>
      )}
      <div className="mt-2 flex w-full items-center justify-between md:hidden">
        <div className="flex w-full flex-col gap-0">
          <h3 className="my-0 text-2xl font-semibold">
            {tagGroupsEnabled ? 'Queue Groups By Tag' : 'Queue'}
          </h3>
          <Row className="box-border flex w-full flex-row justify-between px-2">
            {queue?.type && (
              <div className="mb-0 flex items-center text-xl text-[#5f6b79] md:mb-5">
                <EnvironmentOutlined />
                <div className="ml-3 min-w-0 whitespace-pre-wrap break-words text-sm italic md:text-base">
                  {getQueueTypeLabel(queue?.type)}
                </div>
              </div>
            )}
            <QueueUpToDateInfo queueId={queueId} />
            {queue &&
            !(
              queue?.config?.fifo_queue_view_enabled === false ||
              queue?.config?.tag_groups_queue_view_enabled === false
            ) ? (
              <TagGroupSwitch
                tagGroupsEnabled={tagGroupsEnabled}
                setTagGroupsEnabled={setTagGroupsEnabled}
                mobile={true}
                className="ml-1"
              />
            ) : null}
          </Row>
          {queue?.notes && queue?.notes.length > 0 && (
            <div className="flex max-h-[200px] w-full items-center overflow-y-auto px-2 text-xl text-[#5f6b79] md:hidden">
              <Linkify>
                <div className="min-w-0 whitespace-pre-wrap break-words text-sm italic md:text-base">
                  {`Notes: ${queue?.notes}`}
                </div>
              </Linkify>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const QueueUpToDateInfo: React.FC<{ queueId: number }> = ({ queueId }) => {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const { isLive } = useQueue(queueId, setLastUpdated)
  return (
    <div className="mb-0 flex flex-row items-center text-xl text-[#5f6b79] md:mb-5">
      {isLive || lastUpdated ? <CloudSyncOutlined /> : <FrownOutlined />}
      <div className="ml-3 min-w-0 whitespace-pre-wrap break-words text-sm italic md:text-base">
        {isLive ? (
          'Queue up to date'
        ) : lastUpdated ? (
          <RenderEvery
            render={() => {
              const secondsAgo = (Date.now() - lastUpdated.getTime()) / 1000
              return `Queue updated ${
                secondsAgo < 60
                  ? Math.ceil(secondsAgo) + 's'
                  : moment(lastUpdated).fromNow(true)
              } ago`
            }}
            interval={1000}
          />
        ) : (
          'Queue may be out of date'
        )}
      </div>
    </div>
  )
}

export default QueueInfoColumn
