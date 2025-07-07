import { QuestionCircleOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import React from 'react'

const ChunkHelpTooltip: React.FC = () => {
  return (
    <div className="text-gray-500">
      <Tooltip
        title={`Chatbot document "chunks" function as the knowledge base for the chatbot, where the most relevant chunks are sent into the LLM with the user's question to provide better answers. These retrieved chunks form the citations you see when asking the chatbot questions.\n\nEach chunk can have a page number, which is the page number of the original document that this chunk came from. Note that modifying a chunk does not actually modify the original document nor does it affect any previously asked chatbot questions.`}
      >
        Help <QuestionCircleOutlined />
      </Tooltip>
    </div>
  )
}

export default ChunkHelpTooltip
