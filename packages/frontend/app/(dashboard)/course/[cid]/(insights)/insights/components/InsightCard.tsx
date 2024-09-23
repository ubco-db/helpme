import React from 'react'

type InsightCardProps = {
  children: React.ReactNode
  title: string
  subtitle?: string
  filterContent?: React.ReactNode
}

const InsightCard: React.FC<InsightCardProps> = ({
  children,
  title,
  subtitle,
  filterContent,
}) => {
  return (
    <div className="border-b-helpmeblue-light hover:border-b-helpmeblue rounded-lg border-b-2 bg-gray-50 p-8 drop-shadow-md transition-all">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div className={'p-4'}>{children}</div>
      {filterContent}
    </div>
  )
}

export default InsightCard
