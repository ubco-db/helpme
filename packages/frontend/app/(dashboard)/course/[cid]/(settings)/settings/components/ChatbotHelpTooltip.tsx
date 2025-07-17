import { InfoCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import React from 'react'

type TooltipLocations =
  | 'chatbot_settings'
  | 'chatbot_knowledge_base'
  | 'edit_chatbot_questions'
  | 'add_chatbot_document'
  | 'chatbot_settings_modal'

interface ChatbotHelpTooltipProps {
  forPage: TooltipLocations
  className?: string
}

const ChatbotConfigurationTutorial: React.FC<{
  startAtSeconds?: number
  startAtMinutes?: number
}> = ({ startAtSeconds = 0, startAtMinutes = 0 }) => {
  // I was too lazy to do the conversions by hand so I did it like this so I could basically just feed in the timestamp
  const startAt =
    startAtSeconds && startAtMinutes
      ? startAtSeconds + startAtMinutes * 60
      : startAtSeconds || startAtMinutes * 60
  return (
    <div className="youtube-video-container">
      <iframe
        src={`https://www.youtube.com/embed/Y8v8HfEpkqo?si=ZgDnpjBhiIp1RRCT${startAt ? `&amp;start=${startAt}` : ''}`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  )
}

const ChatbotPageTooltips: Record<TooltipLocations, React.ReactNode> = {
  chatbot_settings: (
    <div className="flex flex-col gap-2">
      <div>
        Here, you can Add Documents to the chatbot, which will process them and
        add them to the chatbot&apos;s knowledge base. This will allow the
        chatbot to answer questions about the course content.
      </div>
      <div>
        You can also Open Settings to change the prompt, AI model, and other
        parameters.
      </div>
      <div>
        You can find a tutorial video here:
        <ChatbotConfigurationTutorial />
      </div>
    </div>
  ),
  chatbot_knowledge_base: (
    <div className="flex flex-col gap-2">
      <div>
        Chatbot document &quot;chunks&quot; function as the knowledge base for
        the chatbot, where the most relevant chunks are sent into the LLM with
        the user&apos;s question to provide better answers. These retrieved
        chunks form the citations you see when asking the chatbot questions.
      </div>
      <div>
        Each chunk can have a page number, which is the page number of the
        original document that this chunk came from. Note that modifying a chunk
        does not actually modify the original document nor does it affect any
        previously asked chatbot questions.
      </div>
      <div>
        Most users are not expected to manually add or edit chunks, but some may
        want to fine-tune the content here to maximize the effectiveness of the
        chatbot.
      </div>
      <div>
        For more information on how the chatbot works, see here:
        <ChatbotConfigurationTutorial startAtSeconds={48} />
      </div>
    </div>
  ),
  edit_chatbot_questions: (
    <div className="flex flex-col gap-2">
      <div>
        Here, you can see how your Chatbot is being used and how it&apos;s
        performing.
      </div>
      <div>
        Find an answer that was answered poorly? Edit the question and answer
        and then Insert the Q&A into the Chatbot Knowledge Base.
      </div>
      <div>
        Find a good/common question? Edit the question (and optionally modify
        the answer) and mark it as suggested, which will make it show up in new
        chats.
      </div>
      <div>
        Relevant section of tutorial video:
        <ChatbotConfigurationTutorial startAtMinutes={5} startAtSeconds={44} />
      </div>
    </div>
  ),
  add_chatbot_document: (
    <div className="flex flex-col gap-2">
      <div>
        Here, you can upload a new document to the chatbot, which will be
        processed and added to the chatbot&apos;s knowledge base.
      </div>
      <div>
        The typical way to do so is you may upload a file (PDF, Word, etc.), but
        alternatively you can give a Github URL that links to a file (said file
        must be public).
      </div>
      <div>
        Relevant section of tutorial video:
        <ChatbotConfigurationTutorial startAtMinutes={2} />
      </div>
    </div>
  ),
  chatbot_settings_modal: (
    <div className="flex flex-col gap-2">
      <div>
        Here, you can change the chatbot&apos;s model, prompt, and other
        parameters.
      </div>
      <div>
        You can hover any of the <InfoCircleOutlined /> for more information on
        each setting/model.
      </div>
      <div>
        Relevant section of tutorial video:
        <ChatbotConfigurationTutorial startAtMinutes={3} startAtSeconds={32} />
      </div>
    </div>
  ),
}

/* Same thing to hover, just gives different tooltip text based on what forPage is */
const ChatbotHelpTooltip: React.FC<ChatbotHelpTooltipProps> = ({
  forPage,
  className,
}) => {
  return (
    <div
      className={`cursor-pointer text-gray-500 hover:text-gray-600 ${className}`}
    >
      <Tooltip
        title={ChatbotPageTooltips[forPage]}
        classNames={{
          body: 'md:w-80',
        }}
        trigger="click" // On-click rather than hover because it causes problems with fullscreen embed video
        destroyOnHidden
      >
        Help <QuestionCircleOutlined />
      </Tooltip>
    </div>
  )
}

export default ChatbotHelpTooltip
