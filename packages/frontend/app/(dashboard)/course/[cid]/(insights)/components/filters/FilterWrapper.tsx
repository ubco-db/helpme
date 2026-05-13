import React from 'react'
const FilterWrapper: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <b>{title}</b>
      {children}
    </div>
  )
}

export default FilterWrapper
