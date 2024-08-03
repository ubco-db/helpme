import { QuestionCircleOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { ReactNode } from 'react'

interface AsyncCentreInfoColumnProps {
  buttons: ReactNode
}

const AsyncCentreInfoColumn: React.FC<AsyncCentreInfoColumnProps> = ({
  buttons,
}) => {
  return (
    <div className="relative flex flex-shrink-0 flex-col pb-3 md:mt-8 md:w-72 md:pb-7">
      <h1 className="mb-8 inline-block overflow-visible whitespace-nowrap text-2xl font-bold text-[#212934]">
        Anytime Question Hub{' '}
        <Tooltip
          title={
            'Missed office hours or lab and need help? Ask your questions here, where an AI will attempt to answer the question right away. If you still need help, you can request for professors or TAs to review and answer it. All questions are private, and may be published by professors and TAs for other students to see if they think its a good question.'
          }
        >
          <QuestionCircleOutlined style={{ color: 'gray' }} />
        </Tooltip>
      </h1>

      {buttons}
    </div>
  )
}

export default AsyncCentreInfoColumn
