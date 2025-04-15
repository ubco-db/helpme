'use client'

import { Collapse, Menu } from 'antd'
import EditProfile from './EditProfile'
import {
  BellOutlined,
  BookOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { SettingsOptions } from '@/app/typings/enum'
import NotificationsSettings from './NotificationsSettings'
import CoursePreference from './CoursePreference'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import EmailNotifications from './EmailNotifications'
import AdvancedSettings from './AdvancedSettings'
interface SettingsMenuProps {
  currentSettings: SettingsOptions
  setCurrentSettings: (settings: SettingsOptions) => void
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({
  currentSettings,
  setCurrentSettings,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)')

  return isMobile ? (
    <Collapse
      accordion
      className="mt-4 w-[95vw] md:hidden"
      size="small"
      items={[
        {
          key: SettingsOptions.PROFILE,
          label: 'Personal Information',
          children: <EditProfile />,
        },
        {
          key: SettingsOptions.NOTIFICATIONS,
          label: 'Notifications',
          children: (
            <div>
              <NotificationsSettings />
              <EmailNotifications />
            </div>
          ),
        },
        {
          key: SettingsOptions.PREFERENCES,
          label: 'Course Preferences',
          children: <CoursePreference />,
        },
        {
          key: SettingsOptions.ADVANCED,
          label: 'Advanced Settings',
          children: <AdvancedSettings />,
        },
      ]}
    />
  ) : (
    <Menu
      className="mt-5 bg-transparent text-left"
      defaultSelectedKeys={[currentSettings]}
      onClick={(e) => setCurrentSettings(e.key as SettingsOptions)}
      items={[
        {
          key: SettingsOptions.PROFILE,
          label: 'Personal Information',
          icon: <UserOutlined />,
        },
        {
          key: SettingsOptions.NOTIFICATIONS,
          label: 'Notifications',
          icon: <BellOutlined />,
        },
        {
          key: SettingsOptions.PREFERENCES,
          label: 'Course Preferences',
          icon: <BookOutlined />,
        },
        {
          key: SettingsOptions.ADVANCED,
          label: 'Advanced Settings',
          icon: <SettingOutlined />,
        },
      ]}
    />
  )
}

export default SettingsMenu
