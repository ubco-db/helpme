'use client'

import { Col, Row, Space } from 'antd'
import AvatarSettings from './AvatarSettings'
import SettingsMenu from './SettingsMenu'
import { SettingsOptions } from '@/app/typings/enum'
import { useState } from 'react'
import EditProfile from './EditProfile'
import NotificationsSettings from './NotificationsSettings'
import CoursePreference from './CoursePreference'
import EmailNotifications from './EmailNotifications'
import UserChatbotHistory from './UserChatbotHistory'
import { useSearchParams } from 'next/navigation'
import AdvancedSettings from './AdvancedSettings'

const ProfileSettings: React.FC = () => {
  const params = useSearchParams()

  const [currentSettings, setCurrentSettings] = useState(() => {
    switch (params.get('page')) {
      case 'notifications':
        return SettingsOptions.NOTIFICATIONS
      case 'preferences':
        return SettingsOptions.PREFERENCES
      case 'chatbot_history':
        return SettingsOptions.CHATBOT_HISTORY
      case 'advanced':
        return SettingsOptions.ADVANCED
      default:
        return SettingsOptions.PROFILE
    }
  })

  return (
    <Row className="flex-grow flex-col md:flex-row md:flex-nowrap">
      <Col
        span={5}
        className="mx-auto mt-2 h-fit w-full max-w-max text-center md:mx-0 md:mt-0"
      >
        <AvatarSettings />
        <SettingsMenu
          currentSettings={currentSettings}
          setCurrentSettings={setCurrentSettings}
        />
      </Col>
      <div className="mr-8 hidden border-r border-gray-300 md:mr-8 md:block md:border-r md:border-gray-300" />
      <Space
        direction="vertical"
        size={40}
        className="hidden h-fit flex-grow md:flex"
      >
        <Col>
          {currentSettings === SettingsOptions.PROFILE && <EditProfile />}
          {currentSettings === SettingsOptions.NOTIFICATIONS && (
            <div>
              <NotificationsSettings />
              <EmailNotifications />
            </div>
          )}
          {currentSettings === SettingsOptions.PREFERENCES && (
            <CoursePreference />
          )}
          {currentSettings === SettingsOptions.CHATBOT_HISTORY && (
            <UserChatbotHistory />
          )}
          {currentSettings === SettingsOptions.ADVANCED && <AdvancedSettings />}
        </Col>
      </Space>
    </Row>
  )
}

export default ProfileSettings
