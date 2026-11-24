'use client'

import {
  BellOutlined,
  DownloadOutlined,
  LinkOutlined,
  QrcodeOutlined,
  RobotOutlined,
  ScheduleOutlined,
  SettingOutlined,
  TableOutlined,
} from '@ant-design/icons'
import type { CourseSettingsResponse } from '@koh/common'
import { Role } from '@koh/common'
import type { MenuProps } from 'antd'
import { Menu, Select } from 'antd'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import Link from 'next/link'

type MenuItem = Required<MenuProps>['items'][number]
type MenuOption = { key: string; label: ReactNode }

enum CourseAdminOptions {
  CHECK_IN = 'CHECK_IN',
  ROSTER = 'ROSTER',
  EXPORT_DATA = 'EXPORT_DATA',
  QUEUE_INVITES = 'QUEUE_INVITES',
  EDIT_QUESTIONS = 'EDIT_QUESTIONS',
  SETTINGS = 'SETTINGS',
  LMS_INTEGRATIONS = 'LMS_INTEGRATIONS',
  CHATBOT_SETTINGS = 'CHATBOT_SETTINGS',
  CHATBOT_KNOWLEDGE_BASE = 'CHATBOT_KNOWLEDGE_BASE',
  CHATBOT_QUESTIONS = 'CHATBOT_QUESTIONS',
}

type CourseSettingsManyProps = {
  courseRole: Role
  courseFeatures?: CourseSettingsResponse
  courseId: number
}

const CourseSettingsMenu: React.FC<CourseSettingsManyProps> = ({
  courseRole,
  courseFeatures,
  courseId,
}) => {
  const pathname = usePathname()

  const handleCurrentMenuItem = () => {
    const path = pathname.split('/')

    return CourseAdminOptions[
      path[path.length - 1].toUpperCase() as keyof typeof CourseAdminOptions
    ]
  }

  const currentMenuItem = handleCurrentMenuItem()

  const baseMenuItems: MenuItem[] = [
    {
      key: CourseAdminOptions.QUEUE_INVITES,
      icon: <QrcodeOutlined />,
      label: (
        <Link href={`/course/${courseId}/settings/queue_invites`}>
          Queue Invites
        </Link>
      ),
    },
    {
      key: CourseAdminOptions.EDIT_QUESTIONS,
      icon: <TableOutlined />,
      label: (
        <Link href={`/course/${courseId}/settings/edit_questions`}>
          Edit Queue Questions
        </Link>
      ),
    },
    {
      key: CourseAdminOptions.EXPORT_DATA,
      icon: <DownloadOutlined />,
      label: (
        <Link href={`/course/${courseId}/settings/export_data`}>
          Export Data
        </Link>
      ),
    },
    {
      type: 'divider',
    },
    {
      key: CourseAdminOptions.CHATBOT_SETTINGS,
      icon: <RobotOutlined />,
      label: (
        <Link href={`/course/${courseId}/settings/chatbot_settings`}>
          Chatbot Settings
        </Link>
      ),
    },
    {
      key: CourseAdminOptions.CHATBOT_KNOWLEDGE_BASE,
      icon: <RobotOutlined />,
      label: (
        <Link href={`/course/${courseId}/settings/chatbot_knowledge_base`}>
          Chatbot Knowledge Base
        </Link>
      ),
    },
    {
      key: CourseAdminOptions.CHATBOT_QUESTIONS,
      icon: <RobotOutlined />,
      label: (
        <Link href={`/course/${courseId}/settings/chatbot_questions`}>
          Edit Chatbot Questions
        </Link>
      ),
    },
  ]

  const professorMenuItems: MenuItem[] = [
    {
      key: CourseAdminOptions.SETTINGS,
      icon: <SettingOutlined />,
      label: (
        <Link href={`/course/${courseId}/settings`}>General Settings</Link>
      ),
    },
    {
      key: CourseAdminOptions.ROSTER,
      icon: <BellOutlined />,
      label: (
        <Link href={`/course/${courseId}/settings/roster`}>Course Roster</Link>
      ),
    },
    {
      key: CourseAdminOptions.LMS_INTEGRATIONS,
      icon: <LinkOutlined />,
      label: (
        <Link href={`/course/${courseId}/settings/lms_integrations`}>
          LMS Integrations
        </Link>
      ),
    },
  ]

  if (courseFeatures?.queueEnabled) {
    professorMenuItems.push({
      key: CourseAdminOptions.CHECK_IN,
      icon: <ScheduleOutlined />,
      label: (
        <Link href={`/course/${courseId}/settings/check_in`}>
          TA Check In/Out Times
        </Link>
      ),
    })
  }

  const menuItems =
    courseRole === Role.PROFESSOR
      ? [...professorMenuItems, ...baseMenuItems]
      : baseMenuItems

  const mobileOptions = menuItems
    .filter((item): item is MenuOption => {
      return (
        !!item && item.type !== 'divider' && 'key' in item && 'label' in item
      )
    })
    .map((item) => ({
      value: item.key,
      label: item.label,
    }))

  return (
    <>
      <div className="md:hidden">
        <Select
          value={currentMenuItem}
          className="w-full"
          options={mobileOptions}
        />
      </div>
      <Menu
        selectedKeys={[currentMenuItem]}
        className="hidden bg-[#f8f9fb] md:block"
        items={menuItems}
      />
    </>
  )
}

export default CourseSettingsMenu
