'use client'

import React from 'react'
import { Menu, MenuProps } from 'antd'
import {
  AreaChartOutlined,
  DashboardOutlined,
  LineChartOutlined,
  QuestionCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import { InsightCategories, InsightCategory } from '@koh/common'

type InsightsMenuProps = {
  category: InsightCategory
  setCategory: (category: InsightCategory) => void
}

type MenuItem = Required<MenuProps>['items'][number]

const InsightsMenu: React.FC<InsightsMenuProps> = ({
  category,
  setCategory,
}) => {
  const insightsMenuItems: MenuItem[] = InsightCategories.map((v) => {
    let icon: React.ReactNode = <LineChartOutlined />
    switch (v) {
      case 'Dashboard':
        icon = <DashboardOutlined />
        break
      case 'Tool_Usage_Statistics':
        icon = <AreaChartOutlined />
        break
      case 'Questions':
        icon = <QuestionCircleOutlined />
        break
      case 'Chatbot':
        icon = <RobotOutlined />
        break
    }

    return {
      label: v.replace(/_/g, ' '),
      icon: icon,
      key: v,
    }
  })

  const handleInsightsClick = (item: MenuItem) => {
    if (item == undefined) {
      setCategory('Dashboard')
      return
    }
    setCategory(item.key as InsightCategory)
  }

  return (
    <div className="mt-2">
      <Menu
        defaultSelectedKeys={[category]}
        onClick={(item) => handleInsightsClick(item)}
        className="bg-[#f8f9fb]"
        items={insightsMenuItems}
      />
    </div>
  )
}

export default InsightsMenu
