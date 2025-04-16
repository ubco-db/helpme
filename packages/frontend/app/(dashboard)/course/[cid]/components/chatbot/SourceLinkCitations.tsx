import { SourceDocument } from '@koh/common'
import { ChatbotQuestionType } from '@/app/typings/chatbot'
import SourceLinkCitationButton from './SourceLinkCitationButton'
import { Tooltip } from 'antd'

interface SourceLinkCitationsProps {
  sourceDocuments: SourceDocument[] | undefined
  chatbotQuestionType: ChatbotQuestionType
  appearDeleted?: boolean
}

const extractLMSLink = (content?: string) => {
  if (!content) return undefined
  const idx = content.indexOf('Page Link:')
  if (idx < 0) return undefined
  return content.substring(idx + 'Page Link:'.length).trim()
}

const SourceLinkCitations: React.FC<SourceLinkCitationsProps> = ({
  sourceDocuments,
  chatbotQuestionType,
  appearDeleted = false,
}) => {
  if (!sourceDocuments) return null
  return (
    <div className="flex flex-wrap gap-1">
      {chatbotQuestionType === 'System' ? (
        <div className="align-items-start flex h-fit w-fit max-w-[280px] flex-wrap justify-start gap-x-2 rounded-xl bg-slate-100 p-1 font-semibold">
          <p className="px-2 py-1">User Guide</p>
          <SourceLinkCitationButton
            docName="User Guide"
            sourceLink="https://github.com/ubco-db/helpme/blob/main/packages/frontend/public/userguide.md"
          />
        </div>
      ) : (
        sourceDocuments.map((sourceDocument, idx) => (
          <Tooltip
            title={
              sourceDocument.type &&
              sourceDocument.type != 'inserted_lms_document'
                ? sourceDocument.content
                : ''
            }
            key={idx}
          >
            <div className="align-items-start flex h-fit w-fit max-w-[280px] flex-wrap justify-start gap-x-2 rounded-xl bg-slate-100 p-1 font-semibold">
              {appearDeleted ? (
                <del className="text-red-500">
                  <p className="px-2 py-1 text-black">
                    {sourceDocument.docName}
                  </p>
                </del>
              ) : (
                <p className="px-2 py-1">{sourceDocument.docName}</p>
              )}
              {sourceDocument.type == 'inserted_lms_document' &&
                extractLMSLink(sourceDocument.content) && (
                  <SourceLinkCitationButton
                    docName={sourceDocument.docName}
                    documentText={
                      sourceDocument.pageContent ?? sourceDocument.content
                    }
                    sourceLink={extractLMSLink(sourceDocument.content) ?? ''}
                    part={0}
                  />
                )}
              {sourceDocument.pageNumbers &&
                sourceDocument.pageNumbers.map((part) => (
                  <SourceLinkCitationButton
                    key={`${sourceDocument.docName}-${part}`}
                    docName={sourceDocument.docName}
                    documentText={
                      sourceDocument.pageContent ?? sourceDocument.content
                    }
                    sourceLink={sourceDocument.sourceLink}
                    part={part}
                  />
                ))}
            </div>
          </Tooltip>
        ))
      )}
    </div>
  )
}

export default SourceLinkCitations
