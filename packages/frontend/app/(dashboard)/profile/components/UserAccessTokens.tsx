'use client'

import { LMSToken } from '@koh/common'
import { Button, Card, List, message, Tooltip } from 'antd'
import { useEffect, useState } from 'react'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { DeleteOutlined, KeyOutlined } from '@ant-design/icons'

const UserAccessTokens: React.FC = () => {
  const [lmsTokens, setLMSTokens] = useState<LMSToken[]>([])
  const [deletingLMSTokens, setDeletingLMSTokens] = useState<number[]>([])

  useEffect(() => {
    const getLMSTokens = async () => {
      await API.lmsIntegration
        .getAccessTokens()
        .then((tokens) => {
          setLMSTokens(tokens)
        })
        .catch((_) => {})
    }
    getLMSTokens()
  }, [])

  const deleteLMSToken = (tokenId: number) => {
    setDeletingLMSTokens((prev) => [...prev, tokenId])
    API.lmsIntegration
      .deleteAccessToken(tokenId)
      .then((result) => {
        if (result) {
          setLMSTokens((prev) => prev.filter((t) => t.id != tokenId))
          message.success('Successfully invalidated token!')
        } else {
          message.error(
            'An error occurred while invalidating token. Please try again later.',
          )
        }
      })
      .catch((err) => {
        message.error(getErrorMessage(err))
      })
      .finally(() => {
        setDeletingLMSTokens((prev) => prev.filter((v) => v != tokenId))
      })
  }

  return (
    <div className={'flex flex-col gap-12'}>
      <Card
        title="Learning Management System Access Tokens"
        classNames={{ body: 'flex flex-col gap-4', title: 'text-wrap' }}
      >
        <p>
          These are access tokens generated for learning management systems your
          organization is integrated with. You can invalidate them at any time.
        </p>
        <List
          className="flex flex-col gap-2 p-2"
          bordered
          dataSource={lmsTokens}
          renderItem={(token) => (
            <List.Item
              className={'rounded-lg border-2 border-gray-100 shadow-sm'}
            >
              <div className={'flex w-full items-center justify-between'}>
                <span>
                  <KeyOutlined className={'mr-2'} />
                  <span className={'font-semibold'}>{token.platform}</span>{' '}
                  Access Token
                </span>
                <div className={'flex gap-2'}>
                  <Tooltip
                    title={`Invalidates and delete token from HelpMe. Contacts ${token.platform} to invalidate the token on their end.`}
                  >
                    <Button
                      disabled={deletingLMSTokens.some((v) => v == token.id)}
                      onClick={() => deleteLMSToken(token.id)}
                      icon={<DeleteOutlined />}
                      danger
                    />
                  </Tooltip>
                </div>
              </div>
            </List.Item>
          )}
          pagination={{
            position: 'top',
            showSizeChanger: false,
            pageSizeOptions: [],
            pageSize: 20,
          }}
        />
      </Card>
    </div>
  )
}

export default UserAccessTokens
