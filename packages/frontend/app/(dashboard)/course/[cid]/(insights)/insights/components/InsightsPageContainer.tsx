import React from 'react'

const InsightsPageContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <div className={'flex flex-row flex-wrap gap-4'}>{children}</div>
}

export default InsightsPageContainer
