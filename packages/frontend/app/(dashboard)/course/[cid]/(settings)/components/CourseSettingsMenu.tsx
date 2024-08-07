'use client'

import {
  BellOutlined,
  DownloadOutlined,
  ScheduleOutlined,
  SettingOutlined,
  TableOutlined,
} from '@ant-design/icons'
import { Role } from '@koh/common'
import { Menu } from 'antd'
import { usePathname, useRouter } from 'next/navigation'

enum CourseAdminOptions {
  CHECK_IN = 'CHECK_IN',
  ROSTER = 'ROSTER',
  ADD = 'ADD',
  EXPORT_DATA = 'EXPORT_DATA',
  EDIT_QUESTIONS = 'EDIT_QUESTIONS',
  SETTINGS = 'SETTINGS',
}

type CourseSettingsMenyProps = {
  courseRole: Role
  courseFeatures: any
  courseId: number
}

const CourseSettingsMenu: React.FC<CourseSettingsMenyProps> = ({
  courseRole,
  courseFeatures,
  courseId,
}) => {
  const router = useRouter()
  const pathname = usePathname()

  const handleMenuClick = (item: any) => {
    const basePath = `/course/${courseId}/settings`
    switch (item.key) {
      case CourseAdminOptions.SETTINGS:
        router.push(basePath)
        break
      case CourseAdminOptions.ROSTER:
        router.push(`${basePath}/roster`)
        break
      case CourseAdminOptions.EXPORT_DATA:
        router.push(`${basePath}/export_data`)
        break
      case CourseAdminOptions.EDIT_QUESTIONS:
        router.push(`${basePath}/edit_questions`)
        break
    }
  }

  const handleCurrentMenuItem = () => {
    const path = pathname.split('/')

    return CourseAdminOptions[
      path[path.length - 1].toUpperCase() as keyof typeof CourseAdminOptions
    ]
  }

  return (
    <Menu
      defaultSelectedKeys={[handleCurrentMenuItem()]}
      onClick={(item) => handleMenuClick(item)}
      className="bg-[#f8f9fb]"
    >
      {courseRole === Role.PROFESSOR && (
        <>
          <Menu.Item
            key={CourseAdminOptions.SETTINGS}
            icon={<SettingOutlined />}
          >
            General Settings
          </Menu.Item>

          {courseFeatures?.queueEnabled && (
            <Menu.Item
              key={CourseAdminOptions.CHECK_IN}
              icon={<ScheduleOutlined />}
            >
              TA Check In/Out Times
            </Menu.Item>
          )}

          <Menu.Item key={CourseAdminOptions.ROSTER} icon={<BellOutlined />}>
            Course Roster
          </Menu.Item>
        </>
      )}
      <Menu.Item
        key={CourseAdminOptions.EXPORT_DATA}
        icon={<DownloadOutlined />}
      >
        Export Data
      </Menu.Item>

      <Menu.Item
        key={CourseAdminOptions.EDIT_QUESTIONS}
        icon={<TableOutlined />}
      >
        Edit Questions
      </Menu.Item>
    </Menu>
  )
}

export default CourseSettingsMenu
