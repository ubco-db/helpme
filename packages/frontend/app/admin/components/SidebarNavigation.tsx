'use client'

import React from 'react'
import { BarChartOutlined } from '@ant-design/icons'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/app/utils/generalUtils'
import { useUserInfo } from '@/app/contexts/userContext'
import { OrganizationRole } from '@koh/common'
import { Image } from 'antd'

const items = [
  {
    key: 'admin',
    label: 'Dashboard',
    icon: <BarChartOutlined />,
    url: '/admin',
  },
  {
    key: 'lti',
    label: 'LTI Platforms',
    icon: (
      <Image
        src={'/icons/lti-icon.png'}
        width={16}
        height={16}
        alt={'LTI'}
        preview={false}
      />
    ),
    url: '/admin/lti',
  },
]

const SidebarNavigation: React.FC = () => {
  const pathname = usePathname()
  const { userInfo } = useUserInfo()

  if (
    userInfo.organization &&
    userInfo.organization.organizationRole === OrganizationRole.ADMIN
  ) {
    return (
      <div className="md:col-span-2">
        <nav className="rounded bg-white shadow-md">
          {items.map((item) => {
            return (
              <Link href={item.url} key={item.key}>
                <div
                  className={cn(
                    'flex cursor-pointer items-center justify-between rounded bg-white p-4 hover:bg-gray-200 focus:bg-gray-200',
                    pathname === item.url
                      ? 'bg-[#e6f7ff] text-[#1890ff]'
                      : 'text-black',
                  )}
                >
                  <div className="flex items-center">
                    {item.icon}
                    <span className="ml-4">{item.label}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </nav>
      </div>
    )
  } else {
    // This is just to create a gap to center the content
    return <div className="md:col-span-1"></div>
  }
}

export default SidebarNavigation
