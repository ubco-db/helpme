import { API } from '@/app/api'
import {
  ChatbotDocumentListResponse,
  ChatbotDocumentResponse,
  ChatbotQuestionResponse,
  HelpMeChatbotQuestionTableResponse,
  PaginatedResponse,
} from '@koh/common'

export type QuestionListItem = Omit<
  HelpMeChatbotQuestionTableResponse,
  'children' | 'chatbotQuestion'
> & {
  key: string
  chatbotQuestion: ChatbotQuestionResponse
  children: QuestionListItem[]
}

export function mapChatbotDocumentsToListForm(
  documents: ChatbotDocumentResponse[],
): ChatbotDocumentListResponse[] {
  const aggregateMap: Record<string, ChatbotDocumentResponse[]> = {}
  const standalone: ChatbotDocumentResponse[] = []

  for (const document of documents) {
    if (document.aggregateId != undefined) {
      if (aggregateMap[document.aggregateId]) {
        aggregateMap[document.aggregateId].push(document)
      } else {
        aggregateMap[document.aggregateId] = [document]
      }
    } else {
      standalone.push(document)
    }
  }

  return [
    ...Object.keys(aggregateMap).map((k) => ({
      aggregateId: k,
      type: 'aggregate' as 'aggregate' | 'chunk',
      title: aggregateMap[k].find((v) => v.title != undefined)?.title ?? 'N/A',
      documents: aggregateMap[k],
    })),
    ...standalone.map((v) => ({
      title: v.title ?? 'N/A',
      type: 'chunk' as 'aggregate' | 'chunk',
      documents: [v],
    })),
  ]
}

export function extractWords(content?: string): string[] {
  if (!content) return []
  const words = content.match(/(\s*\S*\s*)/g)?.map((v) => v) ?? []
  if (words.length > 0 && words[words.length - 1].trim() == '') {
    return words.slice(0, words.length - 1)
  }
  return words
}

export async function getPaginatedChatbotDocuments<T>(
  apiFunction: (...params: any[]) => Promise<PaginatedResponse<T>>,
  courseId: number,
  page: number,
  pageSize: number,
  setTotal: React.Dispatch<React.SetStateAction<number>>,
  setDocuments: React.Dispatch<React.SetStateAction<T[]>>,
  search?: string,
) {
  await apiFunction
    .call(API, courseId, page, pageSize, search)
    .then((response) => {
      //response.items.forEach((v) => (v as any)['key'] = v.id);
      setTotal(response.total)
      setDocuments(response.items)
    })
    .catch((e) => {
      console.error(e)
      setTotal(0)
      setDocuments([])
    })
}
