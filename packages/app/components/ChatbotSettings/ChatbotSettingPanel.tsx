import React, { useState } from 'react'
import { Row, Col, Space, Menu } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import { useRouter } from 'next/router'
import { Role } from '@koh/common'
import DefaultErrorPage from 'next/error'
import ChatbotSettings from './ChatbotSettings'
import ChatbotQuestions from './ChatbotQuestions'
import ChatbotDocuments from './ChatbotDocuments'
import { useRoleInCourse } from '../../hooks/useRoleInCourse'

export enum ChatbotSettingsOptions {
  CHATBOT_SETTINGS = 'CHATBOT_SETTINGS',
  DOCUMENT_SETTINGS = 'DOCUMENT_SETTINGS',
  CHATBOT_QUESTIONS = 'CHATBOT_QUESTIONS',
}

interface ChatbotSettingsPanelProps {
  courseId: number
}

const VerticalDivider = styled.div`
  @media (min-width: 767px) {
    border-right: 1px solid #cfd6de;
    margin-right: 32px;
  }
`

export default function ChatbotSettingsPanel({
  courseId,
}: ChatbotSettingsPanelProps): React.ReactElement {
  const role = useRoleInCourse(Number(courseId))
  const [currentSettings, setCurrentSettings] = useState(
    ChatbotSettingsOptions.CHATBOT_SETTINGS,
  )

  const handleMenuClick = (e: any) => {
    setCurrentSettings(e.key as ChatbotSettingsOptions)
  }

  return (
    <Space
      direction="vertical"
      size={40}
      style={{ flexGrow: 1, width: '100%' }}
    >
      <Menu
        onClick={handleMenuClick}
        selectedKeys={[currentSettings]}
        mode="horizontal"
        style={{ justifyContent: 'center', marginBottom: '20px' }}
      >
        <Menu.Item
          key={ChatbotSettingsOptions.CHATBOT_SETTINGS}
          icon={<RobotOutlined />}
        >
          Chatbot Settings
        </Menu.Item>
        <Menu.Item
          key={ChatbotSettingsOptions.DOCUMENT_SETTINGS}
          icon={<RobotOutlined />}
        >
          Document Chunk Settings
        </Menu.Item>
        <Menu.Item
          key={ChatbotSettingsOptions.CHATBOT_QUESTIONS}
          icon={<RobotOutlined />}
        >
          Chatbot Questions
        </Menu.Item>
      </Menu>
      <Row>
        <Col span={24}>
          {currentSettings === ChatbotSettingsOptions.CHATBOT_SETTINGS && (
            <ChatbotSettings courseId={courseId} />
          )}
          {currentSettings === ChatbotSettingsOptions.DOCUMENT_SETTINGS && (
            <ChatbotDocuments courseId={courseId} />
          )}
          {currentSettings === ChatbotSettingsOptions.CHATBOT_QUESTIONS && (
            <ChatbotQuestions courseId={courseId} />
          )}
        </Col>
      </Row>
    </Space>
  )
}
