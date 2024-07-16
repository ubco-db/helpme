import React from 'react'
import {
  TeamOutlined,
  ExperimentOutlined,
  SettingOutlined,
  CodeOutlined,
} from '@ant-design/icons'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

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
    key: 'dev',
    label: 'Development Tools',
    icon: <CodeOutlined />,
    url: '/organization/dev',
  },
]

const SidebarNavigation: React.FC = () => {
  const pathname = usePathname()

  return (
    <>
      {items.map((item) => (
        <div
          key={item.key}
          className={`flex cursor-pointer items-center justify-between rounded bg-white p-4 shadow-md ${pathname === item.url ? 'bg-[#e6f7ff] text-[#1890ff]' : ''}`}
        >
          <Link href={item.url}>
            <div className="flex items-center">
              {item.icon}
              <span className="ml-4">{item.label}</span>
            </div>
          </Link>
        </div>
      ))}
    </>
  )
}

export default SidebarNavigation
