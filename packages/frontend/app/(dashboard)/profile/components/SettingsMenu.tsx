'use client'

import { Collapse, Menu } from 'antd'
import EditProfile from './EditProfile'
import { BellOutlined, BookOutlined, UserOutlined } from '@ant-design/icons'
import { SettingsOptions } from '@/app/typings/enum'
import NotificationsSettings from './NotificationsSettings'
import CoursePreference from './CoursePreference'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import EmailNotifications from './EmailNotifications'
interface SettingsMenuProps {
  setCurrentSettings: (settings: SettingsOptions) => void
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ setCurrentSettings }) => {
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
          label: 'Browser Notifications',
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
      ]}
    />
  ) : (
    <Menu
      className="mt-5 bg-transparent text-left"
      defaultSelectedKeys={[SettingsOptions.PROFILE]}
      onClick={(e) => setCurrentSettings(e.key as SettingsOptions)}
      items={[
        {
          key: SettingsOptions.PROFILE,
          label: 'Personal Information',
          icon: <UserOutlined />,
        },
        {
          key: SettingsOptions.NOTIFICATIONS,
          label: 'Browser Notifications',
          icon: <BellOutlined />,
        },
        {
          key: SettingsOptions.PREFERENCES,
          label: 'Course Preferences',
          icon: <BookOutlined />,
        },
      ]}
    />
  )
}

export default SettingsMenu
