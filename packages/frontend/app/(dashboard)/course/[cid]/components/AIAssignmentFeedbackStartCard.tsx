'use client'

import { Card } from 'antd'
import Link from 'next/link'
import { ReactElement } from 'react'

type AIAssignmentFeedbackStartCardProps = {
  cid: number
}

const AIAssignmentFeedbackStartCard: React.FC<
  AIAssignmentFeedbackStartCardProps
> = ({ cid }): ReactElement => {
  return (
    <Link
      href={`/course/${cid}/assignment-feedback`}
      aria-label="AI Assignment Feedback"
    >
      <Card
        classNames={{
          header:
            'text-white bg-[#0c6b6e] rounded-t-lg group-hover:underline group-focus:underline group-active:underline',
        }}
        className="aiAssignmentFeedbackCard group my-4 rounded-t-lg"
        title={'AI Assignment Feedback'}
      >
        <div className="flex items-center justify-between">
          <span className="text-md italic text-gray-600">
            Get AI Feedback on your LLED Descriptive Reports
          </span>
        </div>
      </Card>
    </Link>
  )
}

export default AIAssignmentFeedbackStartCard
