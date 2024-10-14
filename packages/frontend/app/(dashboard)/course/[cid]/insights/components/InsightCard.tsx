import React from 'react'

type InsightCardProps = {
  children: React.ReactNode
  title: string
  description?: string
}

const InsightCard: React.FC<InsightCardProps> = ({
  children,
  title,
  description,
}) => {
  return (
    <div className="border-b-helpmeblue-light hover:border-b-helpmeblue flex-[1_1_auto] rounded-lg border-b-2 bg-gray-50 p-8 drop-shadow-md transition-all">
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  )
}

export default InsightCard