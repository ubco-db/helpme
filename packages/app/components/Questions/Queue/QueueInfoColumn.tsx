import {
  ClearOutlined,
  CloudSyncOutlined,
  DeleteOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  FrownOutlined,
  MenuOutlined,
  NotificationOutlined,
  StopOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { Button, message, Modal, Popconfirm, Row, Switch, Tooltip } from 'antd'
import Linkify from 'react-linkify'
import moment from 'moment'
import React, { ReactElement, ReactNode, useState } from 'react'
import styled from 'styled-components'
import { useQueue } from '../../../hooks/useQueue'
import { RenderEvery } from '../../RenderEvery'
import { TAStatuses } from './TAStatuses'
import { API } from '@koh/api-client'
import Router from 'next/router'
import { QueueInfoColumnButton, Text } from '../Shared/SharedComponents'

const QueueTitle = styled.h2`
  font-weight: 700;
  font-size: 1.5rem;
  color: #212934;
  margin-bottom: 0px;
  line-height: 2rem;
  display: inline-block;
`

// New queue styled components start here
const InfoColumnContainer = styled.div`
  flex-shrink: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  padding-bottom: 0.75em;

  @media (min-width: 650px) {
    margin-top: 32px;
    width: 290px;
    padding-bottom: 30px;
  }
`

const { confirm } = Modal

const QueuePropertyRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center; // This kinda funky, not sure how to align the tops of the row
  margin-bottom: 20px;
  color: #5f6b79;
  font-size: 20px;

  // less margin on mobile
  @media (max-width: 650px) {
    margin-bottom: 0;
  }
`

const QueuePropertyText = styled.div`
  margin-left: 12px;
  font-size: 16px;
  font-style: italic;

  // To break text in flexbox
  min-width: 0;
  overflow-wrap: break-word;

  // to show new lines in the text
  white-space: pre-wrap;

  /* make text smaller on mobile */
  @media (max-width: 650px) {
    font-size: 14px;
  }
`

const CustomH3 = styled.h3`
  margin-bottom: 0;
  font-size: 1.5rem;
  line-height: 2rem;
  font-weight: 600;
`

const QueueRoomGroup = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`

const QueueInfo = styled.div`
  margin-bottom: 8px;

  // less margin on mobile
  @media (max-width: 650px) {
    margin-bottom: 0px;
  }
`

const QueueText = styled.div`
  max-height: 200px;
  overflow-y: auto;
  width: 100%;
`

export const DisableQueueButton = styled(QueueInfoColumnButton)`
  color: white;
  background: #da3236;
  &:hover,
  &:focus {
    color: #da3236;
    background: #fff;
    border-color: #da3236;
  }
`

export const ClearQueueButton = styled(QueueInfoColumnButton)`
  color: #d4380d;
  background: #fff;
  border-color: #d4380d;
  &:hover,
  &:focus {
    background: #fff;
    color: #da3236;
    border-color: #da3236;
  }
`

const QueueManagementBox = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  color: white;
  width: 100%;
  height: 100%;
  bottom: 0;
`

interface QueueInfoColumnProps {
  queueId: number
  isStaff: boolean
  buttons: ReactNode
  hasDemos?: boolean
  tagGroupsEnabled?: boolean
  setTagGroupsEnabled?: (tagGroupsEnabled: boolean) => void
}

export function QueueInfoColumn({
  queueId,
  isStaff,
  buttons,
  hasDemos,
  tagGroupsEnabled,
  setTagGroupsEnabled,
}: QueueInfoColumnProps): ReactElement {
  const { queue } = useQueue(queueId)
  const [staffListHidden, setStaffListHidden] = useState(false)

  // const [away, setAway] = useState(false);
  // const checkAway = (checked: boolean) => {
  //   if (!checked) {
  //     setAway(true);
  //   } else {
  //     setAway(false);
  //   }
  // };
  return (
    <InfoColumnContainer>
      {/* only show the queue title and warning here on desktop, move down on mobile */}
      <QueueInfo className="justify-left hidden items-center sm:flex">
        <QueueTitle>
          {queue?.room} {queue?.isDisabled && <b>(disabled)</b>}
        </QueueTitle>

        <QueueRoomGroup>
          {!queue.allowQuestions && (
            <Tooltip title="This queue is no longer accepting questions">
              <StopOutlined
                style={{ color: 'red', fontSize: '24px', marginLeft: '8px' }}
              />
            </Tooltip>
          )}
        </QueueRoomGroup>
      </QueueInfo>

      {queue?.notes && (
        <QueuePropertyRow>
          <NotificationOutlined />
          <QueueText>
            <Linkify
              componentDecorator={(decoratedHref, decoratedText, key) => (
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={decoratedHref}
                  key={key}
                >
                  {decoratedText}
                </a>
              )}
            >
              <QueuePropertyText>{queue.notes}</QueuePropertyText>
            </Linkify>
          </QueueText>
        </QueuePropertyRow>
      )}

      {/* buttons and queueUpToDateInfo for desktop (has different order than mobile)*/}
      <div className="hidden sm:block">
        <QueueUpToDateInfo queueId={queueId} />
        {buttons}
      </div>

      <div className="flex">
        <CustomH3 className="mt-0 sm:mt-10">Staff</CustomH3>
        <Button
          className="sm:hidden"
          onClick={() => setStaffListHidden(!staffListHidden)}
          type="text"
          icon={staffListHidden ? <UpOutlined /> : <DownOutlined />}
        />
      </div>
      {queue.staffList.length < 1 ? (
        <div
          role="alert"
          className="border-l-4 border-orange-500 bg-orange-100 p-4 text-orange-700"
        >
          <p> No staff checked in</p>
        </div>
      ) : !staffListHidden ? (
        <TAStatuses queueId={queueId} />
      ) : null}

      {/* buttons for staff on mobile */}
      {isStaff && (
        <div className="my-3 block flex flex-wrap items-center justify-between sm:hidden">
          {buttons}
        </div>
      )}

      {isStaff && (
        // "Clear Queue" and "Delete Queue" buttons for DESKTOP ONLY - mobile is in EditQueueModal.tsx
        <QueueManagementBox className="!hidden sm:!flex">
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
            arrowPointAtCenter={true}
            onConfirm={() => clearQueue(queueId, queue)}
          >
            {/* Hide button on mobile (it gets moved to edit queue modal) */}
            <ClearQueueButton
              icon={<ClearOutlined />}
              className="hidden sm:flex"
            >
              Clear Queue
            </ClearQueueButton>
          </Popconfirm>
          {/* Hide button on mobile (it gets moved to edit queue modal) */}
          <DisableQueueButton
            onClick={() => confirmDisable(queueId, queue)}
            disabled={queue?.isDisabled}
            icon={<DeleteOutlined />}
          >
            {queue?.isDisabled ? `Queue deleted` : `Delete Queue`}
          </DisableQueueButton>
        </QueueManagementBox>
      )}

      {/* mobile only */}
      <div className="mt-3 flex items-center justify-between sm:hidden">
        {!isStaff && hasDemos && buttons}
      </div>
      <div className="mt-3 flex items-center justify-between sm:hidden">
        <div className="flex flex-col">
          <CustomH3 className="mt-0">
            {tagGroupsEnabled ? 'Queue Groups By Tag' : 'Queue'}
          </CustomH3>
          <Row>
            <QueueUpToDateInfo queueId={queueId} />
            {!hasDemos &&
            !(
              queue?.config?.fifo_queue_view_enabled === false ||
              queue?.config?.tag_groups_queue_view_enabled === false
            ) ? (
              <TagGroupSwitchMobile
                tagGroupsEnabled={tagGroupsEnabled}
                setTagGroupsEnabled={setTagGroupsEnabled}
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
            <TagGroupSwitchMobile
              tagGroupsEnabled={tagGroupsEnabled}
              setTagGroupsEnabled={setTagGroupsEnabled}
            />
          ) : null}
        </div>
        {/* for 'Join Queue' button for students */}
        {!isStaff && !hasDemos && buttons}
      </div>
    </InfoColumnContainer>
  )
}

// Note: if you're looking to modify this, there is also a switch in Queue.tsx that will need changing
const TagGroupSwitchMobile: React.FC<{
  tagGroupsEnabled: boolean
  setTagGroupsEnabled: (tagGroupsEnabled: boolean) => void
  className?: string
}> = ({ tagGroupsEnabled, setTagGroupsEnabled, className }) => {
  return (
    <Switch
      className={'sm:hidden ' + className} // only show on mobile (sizes greater than sm)
      defaultChecked={tagGroupsEnabled}
      onChange={() => {
        setTimeout(() => {
          // do a timeout to allow the animation to play
          setTagGroupsEnabled(!tagGroupsEnabled)
        }, 200)
      }}
      checkedChildren={
        <div className="flex min-h-[12px] flex-col items-center justify-center">
          <div className="mb-[2px] min-h-[5px] w-full rounded-[1px] border border-gray-300" />
          <div className="min-h-[5px] w-full rounded-[1px] border border-gray-300" />
        </div>
      }
      unCheckedChildren={<MenuOutlined />}
    />
  )
}

function QueueUpToDateInfo({ queueId }: { queueId: number }): ReactElement {
  const [lastUpdated, setLastUpdated] = useState(null)
  const { isLive } = useQueue(queueId, setLastUpdated)
  return (
    <QueuePropertyRow className="hide-in-percy">
      {isLive || lastUpdated ? <CloudSyncOutlined /> : <FrownOutlined />}
      <QueuePropertyText className="hide-in-percy">
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
      </QueuePropertyText>
    </QueuePropertyRow>
  )
}

export const clearQueue = async (queueId: number, queue: { room: string }) => {
  await API.queues.clean(queueId)
  message.success('Successfully cleaned queue: ' + queue.room)
}

export const confirmDisable = (queueId: number, queue: { room: string }) => {
  confirm({
    title: `Please Confirm!`,
    icon: <ExclamationCircleOutlined />,
    style: { whiteSpace: 'pre-wrap' },
    content: `Please confirm that you want to disable the queue: ${queue.room}.\n
    This queue will no longer appear in the app, and any students currently in the queue will be removed.`,
    onOk() {
      disableQueue(queueId, queue)
    },
  })
}

export const disableQueue = async (
  queueId: number,
  queue: { room: string },
) => {
  await API.queues.disable(queueId)
  message.success('Successfully disabled queue: ' + queue.room)

  // redirect to /today page
  const currentPath = window.location.pathname
  const pathParts = currentPath.split('/')
  // Remove the last two parts ('queue' and '4') and add 'today'
  const newPathParts = [...pathParts.slice(0, -2), 'today']
  const newPath = newPathParts.join('/')

  await Router.push(newPath)
}

interface QuestionTypeProps {
  typeName: string
  typeColor: string
  onClick: () => void
}
export function QuestionType({
  typeName,
  typeColor,
  onClick,
}: QuestionTypeProps): ReactElement {
  function getBrightness(color: string): number {
    const rgb = parseInt(color.slice(1), 16)
    const r = (rgb >> 16) & 0xff
    const g = (rgb >> 8) & 0xff
    const b = (rgb >> 0) & 0xff
    return (r * 299 + g * 587 + b * 114) / 1000
  }
  const textColor = getBrightness(typeColor) < 128 ? 'white' : 'black'

  return (
    <div
      style={{
        backgroundColor: typeColor,
        borderRadius: '15px',
        padding: '0px 7px',
        //marginTop: '2px',
        margin: '2px',
        display: 'inline-block',
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      <Text style={{ fontSize: 'smaller', color: textColor }}>{typeName}</Text>{' '}
    </div>
  )
}
