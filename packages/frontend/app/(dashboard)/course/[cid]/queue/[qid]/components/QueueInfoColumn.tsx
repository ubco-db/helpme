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
} from '@ant-design/icons'
import { Button, Popconfirm, Row, Switch, Tooltip } from 'antd'
import moment from 'moment'
import React, { ReactNode, useState } from 'react'
import { useQueue } from '@/app/hooks/useQueue'
import Linkify from '@/app/components/Linkify'
import { usePathname, useRouter } from 'next/navigation'
import {
  clearQueue,
  confirmDisable,
} from '../../../utils/commonCourseFunctions'
import {
  ClearQueueButton,
  DisableQueueButton,
} from '../../../components/QueueInfoColumnButton'
import RenderEvery from '@/app/components/RenderEvery'
import TAStatusList from './TAStatusList'
import TagGroupSwitch from './TagGroupSwitch'

interface QueueInfoColumnProps {
  queueId: number
  isStaff: boolean
  buttons: ReactNode
  hasDemos: boolean
  tagGroupsEnabled: boolean
  setTagGroupsEnabled: (tagGroupsEnabled: boolean) => void
}

const QueueInfoColumn: React.FC<QueueInfoColumnProps> = ({
  queueId,
  isStaff,
  buttons,
  hasDemos,
  tagGroupsEnabled,
  setTagGroupsEnabled,
}) => {
  const { queue } = useQueue(queueId)
  const [staffListHidden, setStaffListHidden] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const URLSegments = pathname.split('/')
  const courseIdString =
    URLSegments[1] === 'course' && URLSegments[2] ? URLSegments[2] : ''

  // const [away, setAway] = useState(false);
  // const checkAway = (checked: boolean) => {
  //   if (!checked) {
  //     setAway(true);
  //   } else {
  //     setAway(false);
  //   }
  // };
  return (
    <div className="relative flex flex-shrink-0 flex-col pb-3 md:mt-8 md:w-72 md:pb-7">
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
        <div className="mb-0 flex flex-row items-center text-xl text-[#5f6b79] md:mb-5">
          <NotificationOutlined />
          <div className="max-h-[200px] w-full overflow-y-auto">
            <Linkify>
              <div className="ml-3 min-w-0 whitespace-pre-wrap break-words text-sm italic md:text-base">
                {queue.notes}
              </div>
            </Linkify>
          </div>
        </div>
      )}

      {/* buttons and queueUpToDateInfo for desktop (has different order than mobile)*/}
      <div className="hidden sm:block">
        <QueueUpToDateInfo queueId={queueId} />
        {buttons}
      </div>

      <div className="flex">
        <h3 className="my-0 text-2xl font-semibold md:mt-10">Staff</h3>
        {/* Button to hide staff list on mobile */}
        <Button
          className="sm:hidden"
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
        <TAStatusList queueId={queueId} />
      ) : null}

      {/* buttons for staff on mobile */}
      {isStaff && (
        <div className="my-3 flex flex-wrap items-center justify-between sm:hidden">
          {buttons}
        </div>
      )}

      {isStaff && (
        // "Clear Queue" and "Delete Queue" buttons for DESKTOP ONLY - mobile is in EditQueueModal.tsx
        <div className="bottom-0 hidden h-full w-full flex-col justify-end text-white md:flex">
          {/* <p>Toggle to indicate away </p>
            <Switch
              onChange={checkAway}
              checkedChildren="Answering"
              unCheckedChildren="Away"
              style={{ width: "200px", marginTop: "-50px", marginBottom: "50px" }}
            /> */}
          <Popconfirm
            title={
              'Are you sure you want to clear all students from the queue?'
            }
            okText="Yes"
            cancelText="No"
            placement="top"
            arrow={{ pointAtCenter: true }}
            onConfirm={() => clearQueue(queueId, queue)}
          >
            <ClearQueueButton
              icon={<ClearOutlined />}
              className="hidden sm:flex"
            >
              Clear Queue
            </ClearQueueButton>
          </Popconfirm>
          <DisableQueueButton
            onClick={() =>
              confirmDisable(
                queueId,
                queue,
                router,
                `/course/${courseIdString}`,
              )
            }
            disabled={queue?.isDisabled}
            icon={<DeleteOutlined />}
          >
            {queue?.isDisabled ? `Queue deleted` : `Delete Queue`}
          </DisableQueueButton>
        </div>
      )}

      {/* mobile only */}
      <div className="mt-3 flex items-center justify-between sm:hidden">
        {!isStaff && hasDemos && buttons}
      </div>
      <div className="mt-3 flex items-center justify-between sm:hidden">
        <div className="flex flex-col">
          <h3 className="my-0 text-2xl font-semibold">
            {tagGroupsEnabled ? 'Queue Groups By Tag' : 'Queue'}
          </h3>
          <Row>
            <QueueUpToDateInfo queueId={queueId} />
            {!hasDemos &&
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
        </div>
        <div>
          {hasDemos &&
          !(
            queue?.config?.fifo_queue_view_enabled === false ||
            queue?.config?.tag_groups_queue_view_enabled === false
          ) ? (
            <TagGroupSwitch
              tagGroupsEnabled={tagGroupsEnabled}
              setTagGroupsEnabled={setTagGroupsEnabled}
              mobile={true}
            />
          ) : null}
        </div>
        {/* for 'Join Queue' button for students */}
        {!isStaff && !hasDemos && buttons}
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