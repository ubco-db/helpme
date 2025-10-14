import { Citation } from '@koh/common'
import { Progress, Tooltip } from 'antd'
import { cn, lerpColor } from '@/app/utils/generalUtils'
import { useMemo } from 'react'
import { CheckCircleOutlined } from '@ant-design/icons'

type ChatbotCitationProps = {
  citation: Citation
  tooltipContent?: React.ReactNode
  variant?: 'bordered' | 'none'
  listMode?: boolean
}

const ChatbotCitation: React.FC<ChatbotCitationProps> = ({
  citation,
  tooltipContent,
}) => {
  return (
    <Tooltip title={tooltipContent}>
      <div
        className={cn(
          'align-items-start flex h-fit w-fit max-w-full flex-wrap justify-start gap-x-1 gap-y-1 rounded-xl bg-slate-100 p-1 font-semibold',
        )}
      >
        <Tooltip title={citation.docName}>
          <p className={'truncate px-2 py-1'}>{citation.docName}</p>
        </Tooltip>
        {citation.sourceLink &&
          (citation.pageNumbers != undefined ? (
            citation.pageNumbers.map((part) => (
              <SourceLinkButton
                key={`${citation.docName}-${part}`}
                title={citation.docName}
                sourceLink={citation.sourceLink}
                part={part}
                confidence={citation.confidences?.[part]}
              />
            ))
          ) : (
            <SourceLinkButton
              title={citation.docName}
              sourceLink={citation.sourceLink}
              confidence={citation.confidences?.[0]}
            />
          ))}
      </div>
    </Tooltip>
  )
}

export default ChatbotCitation

export const SourceLinkButton: React.FC<{
  title: string
  sourceLink?: string
  part?: number
  variant?: 'fill' | 'none'
  lines?: { to: number; from: number }
  linkTitle?: string
  size?: 'default' | 'small'
  confidence?: number
}> = ({
  title,
  sourceLink,
  part,
  variant = 'fill',
  lines,
  linkTitle,
  size = 'default',
  confidence,
}) => {
  const confidenceColor = useMemo(
    () =>
      confidence != undefined
        ? lerpColor(
            lerpColor('#a30d0d', '#e8e231', Math.min(confidence + 0.5, 1)),
            '#1fa356',
            confidence >= 0.5 ? (confidence - 0.5) * 2 : 0,
          )
        : undefined,
    [confidence],
  )
  if (!sourceLink) {
    return null
  }
  const pageNumber = part && !isNaN(part) ? Number(part) : undefined

  return (
    <div
      className={cn(
        variant == 'fill'
          ? confidence != undefined && confidence >= 1
            ? 'rounded-lg bg-green-100 px-3 py-2'
            : 'rounded-lg bg-blue-100 px-3 py-2'
          : '',
        'flex items-center justify-center gap-1 font-semibold transition',
      )}
    >
      <a
        className={cn(
          sourceLink
            ? 'hover:bg-black-300 cursor-pointer hover:text-white'
            : '',
          confidence != undefined && confidence >= 1 ? 'text-green-600' : '',
        )}
        key={`${title}-${part}`}
        href={
          sourceLink +
          (pageNumber && sourceLink.startsWith('/api/v1/chatbot/document/')
            ? `#page=${pageNumber}`
            : '')
        }
        rel="noopener noreferrer"
        // open in new tab
        target="_blank"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className={cn(
            'h-fit w-fit leading-4',
            size == 'small' ? 'text-[8px]' : 'text-xs',
          )}
        >
          {pageNumber != undefined ? `p. ${pageNumber}` : (linkTitle ?? 'Link')}
          {pageNumber != undefined && lines != undefined
            ? `, lines ${lines.from}-${lines.to}`
            : ''}
        </p>
      </a>
      {confidence != undefined && (
        <Tooltip title={`Confidence: ${Math.round(confidence * 100)}%`}>
          <div className={'flex items-center justify-center'}>
            {confidence >= 1 ? (
              <CheckCircleOutlined style={{ color: confidenceColor }} />
            ) : (
              <Progress
                format={() => null}
                showInfo={false}
                type={'circle'}
                percent={Math.round(confidence * 100)}
                size={15}
                strokeColor={confidenceColor}
              />
            )}
          </div>
        </Tooltip>
      )}
    </div>
  )
}
