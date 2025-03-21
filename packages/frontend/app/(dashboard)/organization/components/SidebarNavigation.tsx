'use client'

import React from 'react'
import {
  TeamOutlined,
  ExperimentOutlined,
  SettingOutlined,
  CodeOutlined,
  InteractionOutlined,
} from '@ant-design/icons'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/app/utils/generalUtils'
import { useUserInfo } from '@/app/contexts/userContext'
import { OrganizationRole } from '@koh/common'
import { Tooltip } from 'antd'

const items = [
  {
    key: 'users',
    label: 'Users',
    icon: <TeamOutlined />,
    url: '/organization/users',
  },
  {
    key: 'courses',
    label: 'Courses',
    icon: <ExperimentOutlined />,
    url: '/organization/courses',
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: <SettingOutlined />,
    url: '/organization/settings',
  },
  {
    key: 'lms_integrations',
    label: 'LMS Integrations',
    icon: <InteractionOutlined />,
    url: '/organization/lms_integrations',
  },
  {
    key: 'dev',
    label: 'Development Tools',
    icon: <CodeOutlined />,
    url: '/organization/dev',
  },
]

const SidebarNavigation: React.FC = () => {
  const pathname = usePathname()
  const { userInfo } = useUserInfo()

  if (
    userInfo.organization &&
    (userInfo.organization.organizationRole === OrganizationRole.ADMIN ||
      userInfo.organization.organizationRole === OrganizationRole.PROFESSOR)
  ) {
    return (
      <nav className="rounded bg-white shadow-md">
        {items.map((item) => {
          // For professors, only allow "settings" to be clickable.
          const isSettings = item.key === 'settings'
          const isDisabled =
            userInfo.organization?.organizationRole ===
              OrganizationRole.PROFESSOR && !isSettings

          if (isDisabled) {
            return (
              <Tooltip
                key={item.key}
                title="You need to be an administrator to access this page."
              >
                <div
                  className={cn(
                    'flex cursor-not-allowed items-center justify-between rounded bg-gray-100 p-4 text-gray-500',
                    pathname === item.url ? 'bg-[#e6f7ff] text-[#1890ff]' : '',
                  )}
                >
                  <div className="flex items-center">
                    {item.icon}
                    <span className="ml-4">{item.label}</span>
                  </div>
                </div>
              </Tooltip>
            )
          } else {
            return (
              <Link href={item.url} key={item.key}>
                <div
                  className={cn(
                    'flex cursor-pointer items-center justify-between rounded bg-white p-4 hover:bg-gray-200 focus:bg-gray-200',
                    pathname === item.url ? 'bg-[#e6f7ff] text-[#1890ff]' : '',
                  )}
                >
                  <div className="flex items-center">
                    {item.icon}
                    <span className="ml-4">{item.label}</span>
                  </div>
                </div>
              </Link>
            )
          }
        })}
      </nav>
    )
  } else {
    return null
  }
}

export default SidebarNavigation
