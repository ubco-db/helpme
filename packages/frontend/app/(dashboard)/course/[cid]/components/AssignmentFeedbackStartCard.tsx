'use client'

import { Card } from 'antd'
import { ReactElement } from 'react'

type AssignmentFeedbackStartCardProps = {
  cid: number
}

const AssignmentFeedbackStartCard: React.FC<AssignmentFeedbackStartCardProps> = ({
  cid,
}): ReactElement => {
  const href = `/course/${cid}/assignment-feedback`

  return (
    <Card
      classNames={{ header: 'text-white rounded-t-lg bg-[#0c6b6e]' }}
      className="my-4 rounded-t-lg border border-[#ddd9d1] shadow-md"
      title="Assignment feedback"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-md italic text-neutral-600">
          Structured formative feedback on your Descriptive Report (LLED style).
        </span>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-[#0c6b6e] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0a5558]"
        >
          Start
        </a>
      </div>
    </Card>
  )
}

export default AssignmentFeedbackStartCard
