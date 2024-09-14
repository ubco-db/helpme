'use client'

import React from 'react'
import { Menu, MenuProps } from 'antd'
import {
  AreaChartOutlined,
  DashboardOutlined,
  LineChartOutlined,
  QuestionCircleOutlined,
  RobotOutlined,
  SolutionOutlined,
} from '@ant-design/icons'
import { usePathname, useRouter } from 'next/navigation'

type InsightsPageProps = {
  courseId: number
}

type MenuItem = Required<MenuProps>['items'][number]

enum InsightsPageOptions {
  INSIGHTS = 'INSIGHTS',
  USAGE = 'USAGE',
  QUESTIONS = 'QUESTIONS',
  QUEUES = 'QUEUES',
  CHATBOT = 'CHATBOT',
  TRENDS = 'TRENDS',
}

const InsightsPageMenu: React.FC<InsightsPageProps> = ({ courseId }) => {
  const router = useRouter()
  const pathname = usePathname()

  const insightsMenuItems: MenuItem[] = [
    {
      key: InsightsPageOptions.INSIGHTS,
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: InsightsPageOptions.USAGE,
      icon: <AreaChartOutlined />,
      label: 'Tool Usage Statistics',
    },
    {
      key: InsightsPageOptions.QUESTIONS,
      icon: <QuestionCircleOutlined />,
      label: 'Questions',
    },
    {
      key: InsightsPageOptions.QUEUES,
      icon: <SolutionOutlined />,
      label: 'Queues',
    },
    {
      key: InsightsPageOptions.CHATBOT,
      icon: <RobotOutlined />,
      label: 'Chatbot',
    },
    {
      key: InsightsPageOptions.TRENDS,
      icon: <LineChartOutlined />,
      label: 'Trends',
    },
  ]

  const handleCurrentInsights = () => {
    const path = pathname.split('/')

    return InsightsPageOptions[
      path[path.length - 1].toUpperCase() as keyof typeof InsightsPageOptions
    ]
  }

  const handleInsightsClick = (item: MenuItem) => {
    const basePath = `/course/${courseId}/insights`
    if (item == undefined) {
      router.push(basePath)
      return
    }

    switch (item.key) {
      case InsightsPageOptions.INSIGHTS:
        router.push(basePath)
        break
      case InsightsPageOptions.USAGE:
        router.push(`${basePath}/usage`)
        break
      case InsightsPageOptions.QUESTIONS:
        router.push(`${basePath}/questions`)
        break
      case InsightsPageOptions.QUEUES:
        router.push(`${basePath}/queues`)
        break
      case InsightsPageOptions.CHATBOT:
        router.push(`${basePath}/chatbot`)
        break
      case InsightsPageOptions.TRENDS:
        router.push(`${basePath}/trends`)
        break
    }
  }

  return (
    <div className="mt-2">
      <Menu
        defaultSelectedKeys={[handleCurrentInsights()]}
        onClick={(item) => handleInsightsClick(item)}
        className="bg-[#f8f9fb]"
        items={insightsMenuItems}
      />
    </div>
  )
}

export default InsightsPageMenu
