import React from 'react'

interface ContentCardProps {
  children: React.ReactNode
}

const OrganizationCard: React.FC<ContentCardProps> = ({ children }) => {
  return (
    <div className="mt-[-5rem] flex items-center rounded-[10px] bg-white p-3 shadow md:mt-[-8rem] md:text-left lg:p-5 xl:max-w-[1500px]">
      {children}
    </div>
  )
}

export default OrganizationCard
