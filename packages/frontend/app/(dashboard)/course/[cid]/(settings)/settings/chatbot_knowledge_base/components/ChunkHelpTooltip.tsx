import { QuestionCircleOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import React from 'react'

const ChunkHelpTooltip: React.FC = () => {
  return (
    <div className="text-gray-500">
      <Tooltip
        title={`Chatbot document "chunks" essentially function as the chatbot's knowledge base and are what are actually cited by the chatbot. Each chunk can have a page number, which is the page number of the original document that this chunk came from. Note that modifying a chunk does not actually modify the original document nor does it affect any previously asked chatbot questions.`}
      >
        Help <QuestionCircleOutlined />
      </Tooltip>
    </div>
  )
}

export default ChunkHelpTooltip
