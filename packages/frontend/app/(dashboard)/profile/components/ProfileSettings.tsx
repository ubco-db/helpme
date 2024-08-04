'use client'

import { Col, Row, Space } from 'antd'
import AvatarSettings from './AvatarSettings'
import SettingsMenu from './SettingsMenu'
import { SettingsOptions } from '@/app/typings/enum'
import { useState } from 'react'
import EditProfile from './EditProfile'
import NotificationsSettings from './NotificationsSettings'
import CoursePreference from './CoursePreference'

const ProfileSettings: React.FC = () => {
  const [currentSettings, setCurrentSettings] = useState(
    SettingsOptions.PROFILE,
  )

  return (
    <Row className="flex-grow flex-col md:flex-row">
      <Col
        span={5}
        className="mx-auto mt-2 h-fit w-full max-w-max text-center md:mx-0 md:mt-0"
      >
        <AvatarSettings />
        <SettingsMenu setCurrentSettings={setCurrentSettings} />
      </Col>
      <div className="mr-8 hidden border-r border-gray-300 md:mr-8 md:block md:border-r md:border-gray-300" />
      <Space
        direction="vertical"
        size={40}
        className="hidden h-fit flex-grow md:block"
      >
        <Col>
          {currentSettings === SettingsOptions.PROFILE && <EditProfile />}
          {currentSettings === SettingsOptions.NOTIFICATIONS && (
            <NotificationsSettings />
          )}
          {currentSettings === SettingsOptions.PREFERENCES && (
            <CoursePreference />
          )}
        </Col>
      </Space>
    </Row>
  )
}

export default ProfileSettings
