import { useMemo, useState } from 'react'
import { Tooltip } from 'antd'
import CustomPagination from '@/app/(dashboard)/course/[cid]/(settings)/settings/components/CustomPagination'

const ChatbotDocumentContentTooltip: React.FC<{
  words?: string[]
  children: React.ReactNode
}> = ({ words, children }) => {
  const [pageSize] = useState(32)
  const [page, setPage] = useState(1)
  const pageCount = useMemo(
    () => Math.ceil((words?.length ?? 0) / pageSize),
    [words, pageSize],
  )

  if (!words || words.length <= 0 || pageCount <= 0) return children

  return (
    <Tooltip
      title={
        <div className={'flex flex-col gap-2'}>
          <p>{words.slice((page - 1) * pageSize, page * pageSize).join('')}</p>
          {pageCount > 1 && (
            <CustomPagination
              page={page}
              numPages={pageCount}
              onChange={(pageNumber) => setPage(pageNumber)}
              isTooltip={true}
            />
          )}
        </div>
      }
    >
      {children}
    </Tooltip>
  )
}

export default ChatbotDocumentContentTooltip
