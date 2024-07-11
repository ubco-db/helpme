import React from 'react'

interface ContentCardProps {
  children: React.ReactNode
}

const StandardPageContainer: React.FC<ContentCardProps> = ({ children }) => {
  return (
    <div className="mx-auto flex w-full flex-1 flex-col px-4 sm:px-5 md:px-8 xl:max-w-[1500px]">
      {children}
    </div>
  )
}

export default StandardPageContainer
