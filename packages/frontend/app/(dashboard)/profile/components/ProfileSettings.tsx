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
    <div>
      <Row className="flex-col md:flex-row lg:flex-row">
        <Col
          span={5}
          className="mx-auto w-full max-w-max text-center md:mx-0 lg:mx-0"
        >
          <AvatarSettings />
          <SettingsMenu setCurrentSettings={setCurrentSettings} />
        </Col>
        <div className="mr-8 hidden border-r border-gray-300 md:mr-8 md:block md:border-r md:border-gray-300 lg:block" />
        <Space
          direction="vertical"
          size={40}
          className="hidden flex-grow md:block lg:block xl:block"
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
    </div>
  )
}

export default ProfileSettings
