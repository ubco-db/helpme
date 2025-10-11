'use client'

import React, { useMemo, useState } from 'react'
import {
  Alert,
  AlertDeliveryMode,
  AlertType,
  DocumentProcessedPayload,
  GetCourseResponse,
  AsyncQuestionUpdatePayload,
} from '@koh/common'
import {
  Badge,
  Button,
  Empty,
  List,
  Popover,
  Space,
  Spin,
  Typography,
  Tag,
} from 'antd'
import { BellOutlined } from '@ant-design/icons'
import useSWR from 'swr'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { API } from '@/app/api'
import { useRouter } from 'next/navigation'

const { Text } = Typography
dayjs.extend(relativeTime)

type AlertMetadata = {
  title: string
  description?: string
  destination?: string
}

type NotificationBellProps = {
  showText?: boolean
  onAfterNavigate?: () => void
  className?: string
}

type NotificationView = {
  key: number
  title: string
  description?: string
  ctaLabel?: string
  onOpen?: () => Promise<void> | void
  isUnread: boolean
  sent: Date
  courseName?: string
}

const alertMeta: Record<AlertType, AlertMetadata> = {
  [AlertType.DOCUMENT_PROCESSED]: {
    title: 'Document processed',
    description:
      'Your uploaded document has been processed and is ready to use.',
    destination: '/settings/chatbot_knowledge_base',
  },
  [AlertType.REPHRASE_QUESTION]: {
    title: 'Question rephrase requested',
    description:
      'You have been asked to add more detail to your question. Your place in line is reserved while you edit.',
  },
  [AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE]: {
    title: 'Please leave the queue',
    description:
      'You have been inactive for a while. Please leave the queue if you no longer need assistance.',
  },
  [AlertType.EVENT_ENDED_CHECKOUT_STAFF]: {
    title: 'Event has ended',
    description:
      'The event you were assisting with has ended. Please check out.',
  },
  [AlertType.ASYNC_QUESTION_UPDATE]: {
    title: 'Anytime question update',
    description: 'There was an update related to an Anytime Question.',
  },
}

const NotificationBell: React.FC<NotificationBellProps> = ({
  showText = false,
  onAfterNavigate,
  className,
}) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const { data, isLoading, mutate } = useSWR(
    ['alerts-feed'],
    async () => API.alerts.getAll(AlertDeliveryMode.FEED),
    { revalidateOnFocus: true },
  )

  const alerts: Alert[] = useMemo(() => data?.alerts ?? [], [data])

  const unreadCount = useMemo(
    () => alerts.filter((alert) => !alert.readAt).length,
    [alerts],
  )

  const uniqueCourseIds = useMemo(() => {
    const ids = new Set<number>()
    for (const alert of alerts) {
      if ((alert.payload as any)?.courseId) {
        ids.add((alert.payload as any).courseId)
      }
    }
    return Array.from(ids)
  }, [alerts])

  // fetch course names for each courseId in alerts
  const { data: courseResponses } = useSWR(
    uniqueCourseIds.length > 0 ? ['courses-for-alerts', uniqueCourseIds] : null,
    async () => {
      const results: Record<number, string> = {}
      await Promise.all(
        uniqueCourseIds.map(async (id) => {
          try {
            const course: GetCourseResponse = await API.course.get(id)
            results[id] = course?.name ?? `Course ${id}`
          } catch {
            results[id] = `Course ${id}`
          }
        }),
      )
      return results
    },
    { revalidateOnFocus: false },
  )

  const courseNameMap = courseResponses ?? {}

  const markAsRead = async (alert: Alert) => {
    if (alert.readAt) return
    // optimistic update
    mutate(
      (current) =>
        current
          ? {
              ...current,
              alerts: current.alerts.map((a) =>
                a.id === alert.id ? { ...a, readAt: new Date() as any } : a,
              ),
            }
          : current,
      { revalidate: false },
    )
    try {
      await API.alerts.close(alert.id)
    } finally {
      await mutate(undefined, { revalidate: true })
    }
  }

  const handleNavigate =
    (alert: Alert, url: string) => async (): Promise<void> => {
      await markAsRead(alert)
      router.push(url)
      onAfterNavigate?.()
    }

  const views: NotificationView[] = useMemo(() => {
    return alerts
      .filter((alert) => alert.deliveryMode === AlertDeliveryMode.FEED)
      .map((alert) => {
        const sentAt = new Date(alert.sent)
        const courseId = (alert.payload as any)?.courseId
        const courseName = courseId ? courseNameMap[courseId] : undefined

        if (alert.alertType === AlertType.DOCUMENT_PROCESSED) {
          const payload = alert.payload as DocumentProcessedPayload
          const destination = courseId
            ? `/course/${courseId}/settings/chatbot_knowledge_base`
            : undefined

          return {
            key: alert.id,
            title: `Document "${payload.documentName}" is ready`,
            description: 'Uploaded course document finished processing.',
            ctaLabel: destination ? 'View document' : undefined,
            onOpen: destination
              ? handleNavigate(alert, destination)
              : async () => await markAsRead(alert),
            isUnread: !alert.readAt,
            sent: sentAt,
            courseName,
          }
        }

        if (alert.alertType === AlertType.ASYNC_QUESTION_UPDATE) {
          const payload = alert.payload as AsyncQuestionUpdatePayload
          const destination = payload.courseId
            ? `/course/${payload.courseId}/async_centre`
            : undefined
          const title =
            payload.subtype === 'commentOnMyPost'
              ? 'New comment on your Anytime Question'
              : payload.subtype === 'commentOnOthersPost'
                ? 'New comment on a followed Anytime Question'
                : payload.subtype === 'humanAnswered'
                  ? 'Your Anytime Question was answered'
                  : payload.subtype === 'statusChanged'
                    ? 'Anytime Question status changed'
                    : payload.subtype === 'upvoted'
                      ? 'Your Anytime Question was upvoted'
                      : 'Anytime Question update'
          return {
            key: alert.id,
            title,
            description: payload.summary,
            ctaLabel: destination ? 'Open' : undefined,
            onOpen: destination
              ? handleNavigate(alert, destination)
              : async () => await markAsRead(alert),
            isUnread: !alert.readAt,
            sent: sentAt,
            courseName,
          }
        }

        const meta = alertMeta[alert.alertType]
        return {
          key: alert.id,
          title: meta?.title,
          description: meta?.description,
          onOpen: async () => await markAsRead(alert),
          isUnread: !alert.readAt,
          sent: sentAt,
          courseName,
        }
      })
      .sort((a, b) => b.sent.getTime() - a.sent.getTime())
  }, [alerts, courseNameMap])

  const markAllRead = async () => {
    const unread = alerts.filter((a) => !a.readAt)
    if (!unread.length) return
    // optimistic update for all
    mutate(
      (current) =>
        current
          ? {
              ...current,
              alerts: current.alerts.map((a) =>
                a.readAt ? a : { ...a, readAt: new Date() as any },
              ),
            }
          : current,
      { revalidate: false },
    )
    try {
      await Promise.all(unread.map((a) => API.alerts.close(a.id)))
    } finally {
      await mutate(undefined, { revalidate: true })
    }
  }

  const content = (
    <div className="w-80 max-w-xs">
      {isLoading ? (
        <div className="py-6 text-center">
          <Spin size="small" />
        </div>
      ) : views.length === 0 ? (
        <Empty
          description="No notifications"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          rowKey={(item) => item.key}
          dataSource={views}
          renderItem={(item) => (
            <List.Item
              className={`${item.isUnread ? 'bg-slate-100' : ''} transition-colors hover:bg-slate-50`}
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #f0f0f0',
              }}
              actions={
                item.ctaLabel
                  ? [
                      <Button
                        key="cta"
                        type="link"
                        size="small"
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (item.onOpen) await item.onOpen()
                        }}
                      >
                        {item.ctaLabel}
                      </Button>,
                    ]
                  : undefined
              }
            >
              <List.Item.Meta
                style={{ margin: 0 }}
                title={
                  <Space
                    direction="vertical"
                    size={1}
                    style={{ width: '100%' }}
                  >
                    <Text
                      strong={item.isUnread}
                      ellipsis={{ tooltip: item.title }}
                      style={{
                        display: 'block',
                        maxWidth: '95%',
                        fontSize: 14,
                      }}
                    >
                      {item.title}
                    </Text>

                    {item.courseName && (
                      <Tag
                        color="blue"
                        style={{
                          fontSize: 11,
                          padding: '0 6px',
                          lineHeight: '18px',
                          borderRadius: 6,
                          width: 'fit-content',
                        }}
                      >
                        {item.courseName}
                      </Tag>
                    )}

                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(item.sent).fromNow()}
                    </Text>
                  </Space>
                }
                description={
                  item.description && (
                    <Text
                      type="secondary"
                      ellipsis={{ tooltip: item.description }}
                      style={{
                        fontSize: 12,
                        display: 'block',
                        maxWidth: '95%',
                        marginTop: 4,
                      }}
                    >
                      {item.description}
                    </Text>
                  )
                }
              />
              {!item.ctaLabel && (
                <Button
                  type="link"
                  size="small"
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (item.onOpen) await item.onOpen()
                  }}
                >
                  Mark as read
                </Button>
              )}
            </List.Item>
          )}
        />
      )}

      {views.length > 0 && unreadCount > 0 && (
        <div className="mt-2 flex justify-end">
          <Button type="link" size="small" onClick={markAllRead}>
            Mark all as read
          </Button>
        </div>
      )}
    </div>
  )

  const trigger = (
    <Badge count={unreadCount} size="small">
      <Button
        type="text"
        className={`flex items-center ${className ?? ''}`.trim()}
        icon={<BellOutlined />}
      >
        {showText && <span className="ml-1">Notifications</span>}
      </Button>
    </Badge>
  )

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={(visible) => setOpen(visible)}
      overlayStyle={{ padding: 0, borderRadius: 8 }}
    >
      {trigger}
    </Popover>
  )
}

export default NotificationBell
