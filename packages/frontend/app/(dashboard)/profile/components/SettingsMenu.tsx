'use client'

import { Collapse, Menu } from 'antd'
import { useEffect, useState } from 'react'
import EditProfile from './EditProfile'
import { BellOutlined, BookOutlined, UserOutlined } from '@ant-design/icons'
import { SettingsOptions } from '@/app/typings/enum'
import NotificationsSettings from './NotificationsSettings'
import CoursePreference from './CoursePreference'

interface SettingsMenuProps {
  setCurrentSettings: (settings: SettingsOptions) => void
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ setCurrentSettings }) => {
  const [isMobile, setIsMobile] = useState(false)
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 0
  const { Panel } = Collapse

  useEffect(() => {
    setIsMobile(windowWidth < 768)
  }, [windowWidth, isMobile])

  return isMobile ? (
    <Collapse accordion className="xlg:hidden mt-10 md:hidden lg:hidden">
      <Panel header="Personal Information" key="profile">
        <EditProfile />
      </Panel>
      <Panel header="Notifications" key="notifications">
        <NotificationsSettings />
      </Panel>
      <Panel header="Course Preferences" key="preferences">
        <CoursePreference />
      </Panel>
    </Collapse>
  ) : (
    <Menu
      className="mt-5 bg-transparent text-left"
      defaultSelectedKeys={[SettingsOptions.PROFILE]}
      onClick={(e) => setCurrentSettings(e.key as SettingsOptions)}
    >
      <Menu.Item key={SettingsOptions.PROFILE} icon={<UserOutlined />}>
        Personal Information
      </Menu.Item>

      <Menu.Item key={SettingsOptions.NOTIFICATIONS} icon={<BellOutlined />}>
        Notifications
      </Menu.Item>

      <Menu.Item key={SettingsOptions.PREFERENCES} icon={<BookOutlined />}>
        Course Preferences
      </Menu.Item>
    </Menu>
  )
}

export default SettingsMenu
