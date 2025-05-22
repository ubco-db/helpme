'use client'

import { Collapse, Typography, Card, Space } from 'antd'
import { useEffect, useState } from 'react'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { formatDateAndTimeForExcel } from '@/app/utils/timeFormatUtils'
import {
  GetChatbotHistoryResponse,
  InteractionResponse,
  ChatbotQuestionResponseHelpMeDB,
} from '@koh/common'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Tooltip } from 'antd'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { getErrorMessage } from '@/app/utils/generalUtils'

dayjs.extend(relativeTime)

const { Panel } = Collapse
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
      .then((res: GetChatbotHistoryResponse) => {
        setHistory(res.history)
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

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-4 text-2xl font-bold">Your Chatbot Conversations</h2>
      {loading ? (
        <CenteredSpinner tip="Loading..." />
      ) : error ? (
        <div className="py-8 text-red-500">{error}</div>
      ) : (
        <Collapse accordion>
          {history.length === 0 && (
            <div className="text-gray-500">No chatbot history found.</div>
          )}
          {history.map((interaction) => (
            <Panel
              header={
                <Tooltip
                  title={formatDateAndTimeForExcel(
                    new Date(interaction.timestamp),
                  )}
                >
                  <span>
                    Conversation started:{' '}
                    {dayjs(interaction.timestamp).fromNow()}
                  </span>
                </Tooltip>
              }
              key={interaction.id}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {(interaction.questions ?? []).map(
                  (q: ChatbotQuestionResponseHelpMeDB) => (
                    <Card
                      key={q.id}
                      size="small"
                      style={{ marginBottom: 12 }}
                      styles={{ body: { padding: 12 } }}
                    >
                      <Text strong>Q:</Text>{' '}
                      <Paragraph style={{ display: 'inline' }}>
                        {q.questionText}
                      </Paragraph>
                      <br />
                      <Text strong>A:</Text>{' '}
                      <Paragraph style={{ display: 'inline' }}>
                        {q.responseText}
                      </Paragraph>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Asked at:{' '}
                        <Tooltip
                          title={formatDateAndTimeForExcel(
                            new Date(q.timestamp),
                          )}
                        >
                          {dayjs(q.timestamp).fromNow()}
                        </Tooltip>
                      </Text>
                    </Card>
                  ),
                )}
              </Space>
            </Panel>
          ))}
        </Collapse>
      )}
    </div>
  )
}

export default UserChatbotHistory
