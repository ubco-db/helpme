export interface SourceDocument {
  docName: string
  sourceLink: string
  pageNumbers: number[]
  metadata?: { type?: string }
  type?: string
  content?: string
}

export interface PreDeterminedQuestion {
  id: string
  pageContent: string
  metadata: {
    answer: string
    courseId: string
    inserted: boolean
    sourceDocuments: SourceDocument[]
    suggested: boolean
    verified: boolean
  }
}

export interface Message {
  type: 'apiMessage' | 'userMessage'
  message: string | void
  verified?: boolean
  sourceDocuments?: SourceDocument[]
  questionId?: string
}

export interface ChatbotQToConvertToAnytimeQ {
  messages: Message[]
}

// this is the response from the backend when new questions are asked
// if question is I don't know, only answer and questionId are returned
export interface ChatbotAskResponse {
  question?: string
  answer: string
  questionId: string
  sourceDocuments?: SourceDocument[]
  verified?: boolean
  courseId?: any
  isPreviousQuestion?: boolean
}
