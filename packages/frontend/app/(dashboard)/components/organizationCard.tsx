import React from 'react'

interface ContentCardProps {
  children: React.ReactNode
}

const OrganizationCard: React.FC<ContentCardProps> = ({ children }) => {
  return (
    <div className="320px:px-[15px] 320px:text-center 750px:px-[10px_20px] 750px:text-left 1000px:px-[50px_32px] mt-[-50px] flex items-center rounded-[10px] bg-white p-5 shadow-[0_1px_3px_rgba(26,26,26,0.1)] xl:max-w-[1500px] xl:px-[24px_100px]">
      {children}
    </div>
  )
}

export default OrganizationCard
