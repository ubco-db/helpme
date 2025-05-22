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

const { Panel } = Collapse
const { Text, Paragraph } = Typography

const UserChatbotHistory: React.FC = () => {
  const { userInfo } = useUserInfo()
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<InteractionResponse[]>([])

  useEffect(() => {
    if (!userInfo?.id) return
    setLoading(true)
    API.chatbot.studentsOrStaff
      .getChatHistory(userInfo.id)
      .then((res: GetChatbotHistoryResponse) => {
        setHistory(res.history)
      })
      .finally(() => setLoading(false))
  }, [userInfo?.id])

  return (
    <div className="mx-auto mt-8 max-w-3xl">
      <h2 className="mb-4 text-2xl font-bold">Your Chatbot Conversations</h2>
      {loading ? (
        <div className="py-8 text-center text-gray-500">Loading...</div>
      ) : (
        <Collapse accordion>
          {history.length === 0 && (
            <div className="text-gray-500">No chatbot history found.</div>
          )}
          {history.map((interaction) => (
            <Panel
              header={
                <span>
                  Conversation started:{' '}
                  {formatDateAndTimeForExcel(new Date(interaction.timestamp))}
                </span>
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
                      bodyStyle={{ padding: 12 }}
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
                        {formatDateAndTimeForExcel(new Date(q.timestamp))}
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
