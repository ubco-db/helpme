'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertType,
  DocumentProcessedPayload,
  AsyncQuestionUpdatePayload,
  AsyncQuestionUpdateSubtype,
} from '@koh/common'
import {
  Badge,
  Button,
  Empty,
  Popover,
  Spin,
  Typography,
  Tag,
  Alert as AntdAlert,
  Tooltip,
} from 'antd'
import { Bell } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { FEED_PAGE_SIZE, useAlerts } from '@/app/contexts/AlertsContext'
import { getErrorMessage, stringToAntdTagColor } from '@/app/utils/generalUtils'
import Link from 'next/link'
import Linkify from './Linkify'
import { CheckOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'

const { Text, Paragraph } = Typography
dayjs.extend(relativeTime)

type NotificationBellProps = {
  className?: string
}

type FeedAlertFrontendItem = {
  alertId: number
  sentAt: Date
  readAt?: Date
  courseId?: number | null
  courseName?: string
  title: string
  description?: string
  ctaLabel?: string
  destination?: string
  onOpen?: () => Promise<void> | void
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className }) => {
  const [open, setOpen] = useState(false)

  const {
    modalAlerts,
    feedAlerts,
    totalFeedAlerts,
    totalPagesShown,
    totalUnreadFeedAlerts,
    feedPaginationLoading,
    initialFetchLoading,
    initialFetchError,
    setCurrentCourseId,
    currentPageIdx,
    setCurrentPageIdx,
    showReadAtAlerts,
    setShowReadAtAlerts,
    markAllFeedAlertsRead,
    markAlertRead,
  } = useAlerts()

  const handlePopoverOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        setOpen(true)
      } else {
        setOpen(false)
        setShowReadAtAlerts(false)
        setCurrentPageIdx(0)
        markAllFeedAlertsRead()
      }
    },
    [setOpen, setShowReadAtAlerts, setCurrentPageIdx, markAllFeedAlertsRead],
  )

  const pagesOfFeedAlerts: FeedAlertFrontendItem[][] = useMemo(() => {
    const sortedAlerts: FeedAlertFrontendItem[] = feedAlerts
      // sort by readAt (nulls first) DESC (most recently read), then sentAt DESC
      // Technically the backend already does this, and we could use some fancy-thinking logic
      // in a bunch of other places on the frontend here so that we don't need to sort it,
      // but this is just so so much easier (and guaranteed), and the arrays are small anyways.
      .sort((a, b) => {
        if (!a.sentAt.getTime || !b.sentAt.getTime) {
          console.error(
            `Error: Alert ${a.id} has invalid sentAt. sentAt: ${a.sentAt}, ${b.id}: ${b.sentAt}`,
          )
          return 0
        }
        if (!a.readAt && !b.readAt) {
          return b.sentAt.getTime() - a.sentAt.getTime()
        }
        if (!a.readAt) {
          return -1
        }
        if (!b.readAt) {
          return 1
        }
        return b.sentAt.getTime() - a.sentAt.getTime()
      })
      .filter((a) => {
        if (!showReadAtAlerts) {
          return !a.readAt
        }
        return true
      })
      .map((alert) => {
        switch (alert.alertType) {
          case AlertType.DOCUMENT_PROCESSED: {
            const payload = alert.payload as DocumentProcessedPayload
            const destination = alert.courseId // courseId *should* always be defined here, but no sense erroring if it doesn't have it
              ? `/course/${alert.courseId}/settings/chatbot_knowledge_base`
              : undefined

            return {
              alertId: alert.id,
              title: `Document "${payload.documentName}" is ready`,
              description: 'Uploaded course document finished processing.',
              ctaLabel: destination ? 'View' : undefined,
              destination: destination,
              onOpen: () => markAlertRead(alert.id), // this is an async function, but we're calling it synchronously so it happens in the background
              readAt: alert.readAt,
              sentAt: alert.sentAt,
              courseId: alert.courseId,
              courseName: alert.courseName,
            } satisfies FeedAlertFrontendItem
          }
          case AlertType.ASYNC_QUESTION_UPDATE: {
            const payload = alert.payload as AsyncQuestionUpdatePayload
            const courseId = alert.courseId ?? payload.courseId
            const destination = `/course/${alert.courseId}/async_centre`

            const title =
              payload.subtype === AsyncQuestionUpdateSubtype.COMMENT_ON_MY_POST
                ? 'New comment on your Anytime Question'
                : payload.subtype ===
                    AsyncQuestionUpdateSubtype.COMMENT_ON_OTHERS_POST
                  ? 'New comment on a followed Anytime Question'
                  : payload.subtype ===
                      AsyncQuestionUpdateSubtype.HUMAN_ANSWERED
                    ? 'Your Anytime Question was answered'
                    : payload.subtype ===
                        AsyncQuestionUpdateSubtype.STATUS_CHANGED
                      ? 'Anytime Question status changed'
                      : payload.subtype === AsyncQuestionUpdateSubtype.UPVOTED
                        ? 'Your Anytime Question was upvoted'
                        : 'Anytime Question update'
            return {
              alertId: alert.id,
              title,
              description: payload.summary,
              ctaLabel: destination ? 'Open' : undefined,
              destination: destination,
              onOpen: () => markAlertRead(alert.id),
              readAt: alert.readAt,
              sentAt: alert.sentAt,
              courseId: courseId,
              courseName: alert.courseName,
            } satisfies FeedAlertFrontendItem
          }
          default: {
            console.warn(
              `Error: Alert ${alert.id} has unknown alert type. alert: ${alert}`,
            )
            return {
              alertId: alert.id,
              title: `${alert.alertType} alert`,
              readAt: alert.readAt,
              sentAt: alert.sentAt,
              courseId: alert.courseId,
              courseName: alert.courseName,
            } satisfies FeedAlertFrontendItem
          }
        }
      })

    const totalPages = Math.ceil(sortedAlerts.length / FEED_PAGE_SIZE)
    const pages: FeedAlertFrontendItem[][] = new Array(totalPages)

    for (
      let i = 0, pageIndex = 0;
      i < sortedAlerts.length;
      i += FEED_PAGE_SIZE, pageIndex++
    ) {
      pages[pageIndex] = sortedAlerts.slice(i, i + FEED_PAGE_SIZE) // put into chunks/pages
    }
    return pages
  }, [feedAlerts, markAlertRead, showReadAtAlerts])

  return (
    <Popover
      content={
        <div className="flex w-80 max-w-xs flex-col gap-2">
          {initialFetchLoading ? (
            <div className="py-6 text-center">
              <Spin size="small" />
            </div>
          ) : (
            <ul className="flex w-full flex-col gap-y-2">
              {pagesOfFeedAlerts.length === 0 ? (
                <Empty
                  description="You're all caught up!"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                pagesOfFeedAlerts[currentPageIdx].map((item) => (
                  <li
                    key={item.alertId}
                    className={`flex w-full flex-col items-center rounded-md bg-slate-50 p-2 shadow ${item.readAt ? 'bg-opacity-50' : 'border border-blue-200 bg-opacity-80'}`}
                  >
                    <p
                      className={`w-full text-sm ${item.readAt ? 'text-zinc-800' : ''}`}
                    >
                      <b className={`${item.readAt ? 'font-medium' : ''}`}>
                        {item.title}
                      </b>
                    </p>
                    <div className="flex w-full flex-row flex-wrap items-center gap-1">
                      <Tooltip
                        title={dayjs(item.sentAt).format('YYYY-MM-DD h:mma')}
                      >
                        <p className="text-xs text-zinc-600">
                          {dayjs(item.sentAt).fromNow()}{' '}
                          {item.courseName && item.courseId ? 'on' : ''}
                        </p>
                      </Tooltip>

                      {item.courseName && item.courseId && (
                        <Tag
                          color={stringToAntdTagColor(item.courseName)}
                          bordered={false}
                          className={`text-xs transition-opacity hover:opacity-80 focus:opacity-80 active:opacity-80`}
                        >
                          <Link href={`/course/${item.courseId}`}>
                            {item.courseName}
                          </Link>
                        </Tag>
                      )}

                      {item.readAt && (
                        <Tooltip
                          title={dayjs(item.readAt).format('YYYY-MM-DD h:mma')}
                        >
                          <p className="ml-auto text-xs text-zinc-600">
                            Read {dayjs(item.readAt).fromNow()}
                          </p>
                        </Tooltip>
                      )}
                    </div>
                    <div className="mt-1 flex w-full flex-row items-center justify-between gap-1">
                      <Paragraph
                        className="text-xs text-zinc-600"
                        ellipsis={{
                          rows: 5,
                          expandable: false,
                          tooltip: <Linkify>{item.description}</Linkify>,
                        }}
                      >
                        <Linkify>{item.description}</Linkify>
                      </Paragraph>
                      {item.ctaLabel &&
                        (item.destination ? (
                          <Link
                            href={item.destination}
                            onClick={async (e) => {
                              if (item.onOpen) await item.onOpen()
                            }}
                          >
                            {item.ctaLabel}
                          </Link>
                        ) : (
                          <Button
                            type="link"
                            size="small"
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (item.onOpen) await item.onOpen()
                            }}
                          >
                            {item.ctaLabel}
                          </Button>
                        ))}
                    </div>
                  </li>
                ))
              )}
              {/* If on the last page, show a button to hide/show readAt alerts.
                Note that because showing readAt alerts will add more pages and thus move this button to the back,
                it's not really expected to actually be pressed. It's usually expected for the user to just close
                the popover to have it reset.
                */}
              {(pagesOfFeedAlerts.length === 0 ||
                (currentPageIdx + 1 === pagesOfFeedAlerts.length &&
                  totalFeedAlerts > totalUnreadFeedAlerts)) && (
                <li className="flex items-center justify-center">
                  <Button
                    type="link"
                    size="small"
                    onClick={() => setShowReadAtAlerts(!showReadAtAlerts)}
                    className="text-xs text-zinc-600 underline transition-opacity hover:opacity-80 focus:opacity-80 active:opacity-80"
                  >
                    {showReadAtAlerts ? 'Hide' : 'Show'} dismissed notifications
                  </Button>
                </li>
              )}
            </ul>
          )}
          {initialFetchError && (
            <AntdAlert
              className="m-2 w-full"
              message={`Failed to load initial alerts: ${getErrorMessage(initialFetchError)}`}
              type="error"
              showIcon
              closable
            />
          )}

          <div className="flex items-center justify-between gap-2">
            {pagesOfFeedAlerts.length > 1 ? ( // only show prev/next if there's more than 1 page
              <div className="flex items-center gap-1">
                <Button
                  type="link"
                  size="small"
                  disabled={currentPageIdx <= 0}
                  onClick={() =>
                    setCurrentPageIdx(Math.max(0, currentPageIdx - 1))
                  }
                  icon={<LeftOutlined />}
                />
                <Button
                  type="link"
                  size="small"
                  disabled={currentPageIdx + 1 >= pagesOfFeedAlerts.length}
                  loading={
                    // If we're on the last page and more pages are being fetched, THEN show the loading state
                    feedPaginationLoading &&
                    currentPageIdx + 1 >= pagesOfFeedAlerts.length
                  }
                  onClick={() =>
                    setCurrentPageIdx(
                      Math.min(
                        pagesOfFeedAlerts.length - 1,
                        currentPageIdx + 1,
                      ),
                    )
                  }
                  icon={<RightOutlined />}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {`${currentPageIdx * FEED_PAGE_SIZE + 1}-${currentPageIdx * FEED_PAGE_SIZE + (pagesOfFeedAlerts[currentPageIdx]?.length || 0)} of ${totalFeedAlerts}`}
                </Text>
              </div>
            ) : (
              <span />
            )}
            {totalUnreadFeedAlerts > 0 && (
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={
                  () => handlePopoverOpenChange(false) // this will close all alerts anyway
                }
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>
      }
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={(visible) => handlePopoverOpenChange(visible)}
      classNames={{}}
    >
      <Badge count={totalUnreadFeedAlerts} size="small">
        <Button
          type="text"
          className={`flex items-center p-0 ${className ?? ''}`.trim()}
        >
          <Bell aria-label="notifications bell" size={20} />
        </Button>
      </Badge>
    </Popover>
  )
}

export default NotificationBell
