'use client'

import { Card, Collapse, CollapseProps, Space, Tooltip, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { formatDateAndTimeForExcel } from '@/app/utils/timeFormatUtils'
import { HelpMeChatbotQuestionResponse, InteractionResponse } from '@koh/common'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { getErrorMessage } from '@/app/utils/generalUtils'

dayjs.extend(relativeTime)
const { Text, Paragraph } = Typography

const UserChatbotHistory: React.FC = () => {
  const { userInfo } = useUserInfo()
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<InteractionResponse[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userInfo?.id) return
    setLoading(true)
    setError(null)
    API.chatbot.studentsOrStaff
      .getChatHistory()
      .then((res: InteractionResponse[]) => {
        setHistory(res)
      })
      .catch((err) => {
        if (err?.response?.status === 403) {
          setError("You are not allowed to access this user's history.")
        } else {
          setError(getErrorMessage(err))
        }
      })
      .finally(() => setLoading(false))
  }, [userInfo?.id])

  const sortedHistory = useMemo(() => {
    return history.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
  }, [history])

  const collapseItems: CollapseProps['items'] = sortedHistory.map(
    (interaction) => {
      const firstQuestionText =
        interaction.questions?.[0]?.chatbotQuestion?.question
      return {
        key: interaction.id,
        label: (
          <Tooltip
            title={formatDateAndTimeForExcel(new Date(interaction.timestamp))}
          >
            <span>
              Conversation
              {firstQuestionText
                ? ` on ${firstQuestionText.slice(0, 20) + `${firstQuestionText.length > 20 ? '...' : ''}`}`
                : ''}
              : {dayjs(interaction.timestamp).fromNow()}
            </span>
          </Tooltip>
        ),
        children: (
          <Space direction="vertical" style={{ width: '100%' }}>
            {(interaction.questions ?? []).map(
              (q: HelpMeChatbotQuestionResponse) => (
                <Card
                  key={q.id}
                  size="small"
                  style={{ marginBottom: 12 }}
                  styles={{ body: { padding: 12 } }}
                >
                  <Text strong>Q:</Text>{' '}
                  <Paragraph style={{ display: 'inline' }}>
                    {q.chatbotQuestion?.question}
                  </Paragraph>
                  <br />
                  <Text strong>A:</Text>{' '}
                  <Paragraph style={{ display: 'inline' }}>
                    {q.chatbotQuestion?.answer}
                  </Paragraph>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Asked at:{' '}
                    <Tooltip
                      title={formatDateAndTimeForExcel(
                        new Date(q?.timestamp ?? -1),
                      )}
                    >
                      {dayjs(q.timestamp).fromNow()}
                    </Tooltip>
                  </Text>
                </Card>
              ),
            )}
          </Space>
        ),
      }
    },
  )

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-4 text-2xl font-bold">Your Chatbot Conversations</h2>
      {loading ? (
        <CenteredSpinner tip="Loading..." />
      ) : error ? (
        <div className="py-8 text-red-500">{error}</div>
      ) : sortedHistory.length === 0 ? (
        <div className="text-gray-500">No chatbot history found.</div>
      ) : (
        <Collapse accordion items={collapseItems} />
      )}
    </div>
  )
}

export default UserChatbotHistory
