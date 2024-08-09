import React from 'react'

interface ContentCardProps {
  children: React.ReactNode
  className?: string
}

const StandardPageContainer: React.FC<ContentCardProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`mx-auto flex w-full flex-col px-1 sm:px-5 md:px-8 xl:max-w-[1500px] ${className}`}
    >
      {children}
    </div>
  )
}

export default StandardPageContainer
