import { HelpMeChatMessage } from '@koh/common'

export interface ChatbotQToConvertToAnytimeQ {
  messages: HelpMeChatMessage[]
}

export const chatbotStartingMessageCourse =
  'Hello, how can I assist you? I can help with anything course related.'
export const chatbotStartingMessageSystem =
  'Hello, how can I assist you? I can help with anything related to the HelpMe system. You can also leave feedback here.'

export type ChatbotQuestionType = 'System' | 'Course'
