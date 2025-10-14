import { useMemo, useState } from 'react'
import { Badge, Checkbox, List, Tooltip } from 'antd'
import { SourceLinkButton } from '@/app/(dashboard)/course/[cid]/components/chatbot/ChatbotCitation'
import { ChatbotDocumentListResponse } from '@koh/common'
import CustomPagination from '@/app/(dashboard)/course/[cid]/(settings)/settings/components/CustomPagination'
import ChatbotDocumentContentTooltip from '@/app/(dashboard)/course/[cid]/(settings)/settings/components/ChatbotDocumentContentTooltip'
import { cn } from '@/app/utils/generalUtils'

const ChatbotListDocumentItem: React.FC<{
  listDocument: ChatbotDocumentListResponse
  selectedDocuments?: string[]
  toggleSelectDocument?: (id: string) => void
  contentWordMap: Record<string, string[]>
  mode?: 'row' | 'column'
  hasSearch?: boolean
  size?: 'small' | 'default'
  pageSize?: number
}> = ({
  listDocument,
  selectedDocuments,
  toggleSelectDocument,
  contentWordMap,
  mode = 'row',
  hasSearch = false,
  size = 'default',
  pageSize = 10,
}) => {
  const [page, setPage] = useState(1)
  const numDocs = useMemo(() => listDocument.documents.length, [listDocument])
  const numPages = useMemo(
    () => Math.ceil(numDocs / pageSize),
    [numDocs, pageSize],
  )

  const inOrder = useMemo(
    () =>
      listDocument.documents.sort((a, b) => {
        const firstDiff = (a.pageNumber ?? 0) - (b.pageNumber ?? 0)
        if (firstDiff != 0) {
          return firstDiff
        }
        return (a.lines?.[0] ?? 0) - (b.lines?.[0] ?? 0)
      }),
    [listDocument.documents],
  )

  const selectedOnEachPage = useMemo(() => {
    const record: Record<number, number> = {}
    for (let i = 1; i <= numPages; i++) {
      const docs = inOrder.slice((i - 1) * pageSize, i * pageSize)
      record[i] = docs.filter((d) => selectedDocuments?.includes(d.id)).length
    }
    return record
  }, [inOrder, numPages, pageSize, selectedDocuments])

  const currentCitationPage = useMemo(
    () => inOrder.slice((page - 1) * pageSize, page * pageSize),
    [inOrder, page, pageSize],
  )

  const pageCount = useMemo(() => {
    const temp: Record<number, number> = {}
    listDocument.documents.forEach((d) => {
      if (d.pageNumber != undefined) {
        temp[d.pageNumber] = (temp[d.pageNumber] ?? 0) + 1
      }
    })
    setPage(1)
    return temp
  }, [listDocument.documents])

  return (
    <List.Item>
      <div
        className={cn(
          mode == 'row' ? 'flex-row justify-between' : 'flex-col justify-start',
          'flex w-full flex-grow items-center gap-1 rounded-xl border-2 border-slate-200 bg-slate-100 p-0.5',
        )}
      >
        <div
          className={cn(
            mode == 'row'
              ? 'grid grid-cols-2'
              : 'grid grid-cols-1 place-items-center',
            size == 'small' ? 'text-[10px]' : 'text-xs',
            'w-full gap-2',
          )}
        >
          <Tooltip title={listDocument.title}>
            <p
              className={cn(
                mode == 'row' ? 'ml-2 truncate' : 'text-wrap',
                'w-11/12 font-semibold',
              )}
            >
              {listDocument.title}
            </p>
          </Tooltip>
          {size != 'small' && (
            <Tooltip
              title={
                listDocument.type == 'aggregate'
                  ? `This is a document aggregate ${hasSearch ? 'matching the search parameters' : ''}.`
                  : `This is a document chunk matching the ${hasSearch ? 'matching the search parameters' : ''}. It may or may not be part of an aggregate.`
              }
            >
              <Badge
                color={listDocument.type == 'aggregate' ? '#8922D0' : '#12A844'}
                count={
                  (listDocument.type as string).substring(0, 1).toUpperCase() +
                  (listDocument.type as string).substring(1)
                }
              />
            </Tooltip>
          )}
        </div>
        <div
          className={cn(
            mode == 'row' ? 'w-1/2 items-end' : 'w-full',
            'flex flex-col gap-1',
          )}
        >
          {numDocs > pageSize && (
            <CustomPagination
              page={page}
              numPages={numPages}
              onChange={(pageNumber) => setPage(pageNumber)}
              displayCount={selectedOnEachPage}
              size={size}
            />
          )}
          <div
            className={cn(
              mode == 'row' ? 'justify-end' : 'justify-evenly',
              'flex flex-row flex-wrap gap-1',
            )}
          >
            {currentCitationPage.map((doc, i) => (
              <div
                key={doc.id}
                className={
                  'flex flex-row justify-between gap-1 rounded-lg bg-blue-100 p-1'
                }
              >
                <ChatbotDocumentContentTooltip words={contentWordMap[doc.id]}>
                  <div className={'flex flex-row items-center justify-center'}>
                    <SourceLinkButton
                      variant={'none'}
                      title={doc.title ?? 'N/A'}
                      part={doc.pageNumber}
                      sourceLink={doc.source ?? 'N/A'}
                      lines={
                        doc.pageNumber != undefined &&
                        pageCount[doc.pageNumber] > 1 &&
                        doc.lines != undefined
                          ? {
                              from: doc.lines[0],
                              to: doc.lines[1],
                            }
                          : undefined
                      }
                      linkTitle={
                        doc.pageNumber == undefined
                          ? `Chunk ${listDocument.documents.length > 1 ? (page - 1) * pageSize + i + 1 : ''}`.trim()
                          : undefined
                      }
                      size={size}
                    />
                  </div>
                </ChatbotDocumentContentTooltip>
                {toggleSelectDocument && selectedDocuments && (
                  <Checkbox
                    onClick={() =>
                      toggleSelectDocument != undefined &&
                      toggleSelectDocument(doc.id)
                    }
                    checked={selectedDocuments.includes(doc.id)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </List.Item>
  )
}

export default ChatbotListDocumentItem
