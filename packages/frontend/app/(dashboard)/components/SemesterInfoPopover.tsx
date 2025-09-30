import React from 'react'
import { SemesterPartial } from '@koh/common'
import { Popover } from 'antd'

interface SemesterInfoPopoverProps {
  semester: SemesterPartial | undefined | null
  children: React.ReactNode
}

const SemesterInfoPopover: React.FC<SemesterInfoPopoverProps> = ({
  semester,
  children,
}) => {
  if (!semester) return null

  return (
    <Popover
      title={semester.name}
      content={
        <div className="max-w-60">
          <p>
            <strong>Start Date:</strong>{' '}
            {semester.startDate
              ? new Date(semester.startDate).toLocaleDateString()
              : '—'}
          </p>
          <p>
            <strong>End Date:</strong>{' '}
            {semester.endDate
              ? new Date(semester.endDate).toLocaleDateString()
              : '—'}
          </p>
          {semester.description && (
            <p>
              <strong>Description:</strong> {semester.description}
            </p>
          )}
        </div>
      }
    >
      {children}
    </Popover>
  )
}

export default SemesterInfoPopover
