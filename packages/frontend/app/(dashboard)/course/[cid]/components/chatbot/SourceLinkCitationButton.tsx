import { Tooltip } from 'antd'

const SourceLinkCitationButton: React.FC<{
  docName: string
  sourceLink?: string
  part?: number
  documentText?: string
}> = ({ docName, sourceLink, part, documentText }) => {
  if (!sourceLink) {
    return null
  }
  const pageNumber = part && !isNaN(part) ? Number(part) : undefined

  return (
    <Tooltip
      title={documentText ?? ''}
      classNames={{
        body: 'w-96 max-h-[80vh] overflow-y-auto',
      }}
    >
      <a
        className={`flex items-center justify-center rounded-lg bg-blue-100 px-3 py-2 font-semibold transition ${
          sourceLink && 'hover:bg-black-300 cursor-pointer hover:text-white'
        }`}
        key={`${docName}-${part}`}
        href={
          sourceLink +
          (pageNumber && sourceLink.startsWith('/api/v1/chatbot/document/')
            ? `#page=${pageNumber}`
            : '')
        }
        rel="noopener noreferrer"
        // open in new tab
        target="_blank"
      >
        <p className="h-fit w-fit text-xs leading-4">
          {part ? `p. ${part}` : 'Source'}
        </p>
      </a>
    </Tooltip>
  )
}

export default SourceLinkCitationButton
