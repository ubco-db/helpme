'use client'

import {
  BellOutlined,
  DownloadOutlined,
  RobotOutlined,
  ScheduleOutlined,
  SettingOutlined,
  TableOutlined,
} from '@ant-design/icons'
import { Role } from '@koh/common'
import { Menu, MenuProps } from 'antd'
import { usePathname, useRouter } from 'next/navigation'

type MenuItem = Required<MenuProps>['items'][number]

enum CourseAdminOptions {
  CHECK_IN = 'CHECK_IN',
  ROSTER = 'ROSTER',
  ADD = 'ADD',
  EXPORT_DATA = 'EXPORT_DATA',
  EDIT_QUESTIONS = 'EDIT_QUESTIONS',
  SETTINGS = 'SETTINGS',
  CHATBOT_SETTINGS = 'CHATBOT_SETTINGS',
  CHATBOT_QUESTIONS = 'CHATBOT_QUESTIONS',
}

type CourseSettingsManyProps = {
  courseRole: Role
  courseFeatures: any
  courseId: number
}

const CourseSettingsMenu: React.FC<CourseSettingsManyProps> = ({
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
      case CourseAdminOptions.CHECK_IN:
        router.push(`${basePath}/check_in`)
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
      case CourseAdminOptions.CHATBOT_SETTINGS:
        router.push(`${basePath}/chatbot_settings`)
        break
      case CourseAdminOptions.CHATBOT_QUESTIONS:
        router.push(`${basePath}/chatbot_questions`)
        break
    }
  }

  const handleCurrentMenuItem = () => {
    const path = pathname.split('/')

    return CourseAdminOptions[
      path[path.length - 1].toUpperCase() as keyof typeof CourseAdminOptions
    ]
  }

  const baseMenuItems: MenuItem[] = [
    {
      key: CourseAdminOptions.EDIT_QUESTIONS,
      icon: <TableOutlined />,
      label: 'Edit Queue Questions',
    },
    {
      key: CourseAdminOptions.EXPORT_DATA,
      icon: <DownloadOutlined />,
      label: 'Export Data',
    },
    {
      key: CourseAdminOptions.CHATBOT_SETTINGS,
      icon: <RobotOutlined />,
      label: 'Chatbot Settings',
    },
    {
      key: CourseAdminOptions.CHATBOT_QUESTIONS,
      icon: <RobotOutlined />,
      label: 'Edit Chatbot Questions',
    },
  ]

  const professorMenuItems: MenuItem[] = [
    {
      key: CourseAdminOptions.SETTINGS,
      icon: <SettingOutlined />,
      label: 'General Settings',
    },
    {
      key: CourseAdminOptions.ROSTER,
      icon: <BellOutlined />,
      label: 'Course Roster',
    },
  ]

  if (courseFeatures?.queueEnabled) {
    professorMenuItems.push({
      key: CourseAdminOptions.CHECK_IN,
      icon: <ScheduleOutlined />,
      label: 'TA Check In/Out Times',
    })
  }

  const menuItems =
    courseRole === Role.PROFESSOR
      ? [...professorMenuItems, ...baseMenuItems]
      : baseMenuItems

  return (
    <Menu
      defaultSelectedKeys={[handleCurrentMenuItem()]}
      onClick={(item) => handleMenuClick(item)}
      className="bg-[#f8f9fb]"
      items={menuItems}
    />
  )
}

export default CourseSettingsMenu
