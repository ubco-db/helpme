import { Input, List, Pagination, Tabs } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { API } from '@/app/api'
import {
  ChatbotDocumentListResponse,
  ChatbotDocumentResponse,
} from '@koh/common'
import {
  extractWords,
  getPaginatedChatbotDocuments,
  mapChatbotDocumentsToListForm,
} from '@/app/(dashboard)/course/[cid]/(settings)/settings/util'
import ChatbotListDocumentItem from '@/app/(dashboard)/course/[cid]/(settings)/settings/components/ChatbotListDocumentItem'

type ChatbotSelectCitationsProps = {
  courseId: number
  selectedDocuments: string[]
  setSelectedDocuments: React.Dispatch<React.SetStateAction<string[]>>
  preloadedDocuments?: ChatbotDocumentResponse[]
}

const ChatbotSelectCitations: React.FC<ChatbotSelectCitationsProps> = ({
  courseId,
  selectedDocuments,
  setSelectedDocuments,
  preloadedDocuments,
}) => {
  const [pageSize] = useState(10)
  const [listDocuments, setListDocuments] = useState<
    ChatbotDocumentListResponse[]
  >([])
  const documents = useMemo(
    () =>
      listDocuments.map((d) => d.documents).reduce((p, c) => [...p, ...c], []),
    [listDocuments],
  )
  const [selected, setSelected] = useState<ChatbotDocumentResponse[]>([])

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState<string>()

  const contentWordMap = useMemo(() => {
    const rec: Record<string, string[]> = {}

    ;[...(preloadedDocuments ?? []), ...documents]
      .filter((v, i, a) => a.findIndex((v0) => v0.id == v.id) == i)
      .forEach((doc) => (rec[doc.id] = extractWords(doc.content)))
    return rec
  }, [preloadedDocuments, documents])

  useEffect(() => {
    if (preloadedDocuments) {
      const ids = preloadedDocuments.map((v) => v.id)
      setSelected((prev) => [
        ...preloadedDocuments.filter((v) => selectedDocuments.includes(v.id)),
        ...prev.filter((v) => !ids.includes(v.id)),
      ])
    }
  }, [preloadedDocuments, selectedDocuments])

  const toggleSelectDocument = (id: string) => {
    let isSelected = false
    setSelectedDocuments((prev) => {
      isSelected = !prev.includes(id)
      return !isSelected ? prev.filter((i) => i != id) : [...prev, id]
    })
    const match =
      documents.find((v) => v.id == id) ??
      preloadedDocuments?.find((v) => v.id == id)
    if (isSelected && match) {
      setSelected((prev) => [...prev, match])
    } else if (!isSelected) {
      setSelected((prev) => prev.filter((v) => v.id != id))
    }
  }

  useEffect(() => {
    getPaginatedChatbotDocuments(
      API.chatbot.staffOnly.getListDocuments,
      courseId,
      page,
      pageSize,
      setTotal,
      setListDocuments,
      search,
    )
  }, [courseId, page, pageSize])

  const selectedInListForm = useMemo(
    () => mapChatbotDocumentsToListForm(selected),
    [selected],
  )

  return (
    <>
      <style>{`
      .ant-pagination .ant-pagination-item {
        background-color: transparent;
      }
      
      .ant-list-items {
        overflow-y: scroll;
        max-height: 33vh;
      }
    `}</style>
      {listDocuments.length > 0 && (
        <div
          className={
            'my-1 flex flex-col items-center rounded-md border-2 border-gray-200 p-1 text-xs text-gray-700'
          }
        >
          <p>Hover over page/source links to view source document content.</p>
          <p>
            (De)-select citations by clicking the checkbox inside the source
            link.
          </p>
        </div>
      )}
      <Tabs
        items={[
          {
            key: 'select',
            label: 'Select Citations',
            children: (
              <>
                <div className={'my-2 flex justify-between gap-2'}>
                  <Input
                    placeholder={'Search document name...'}
                    prefix={<SearchOutlined />}
                    value={search}
                    onChange={(e) => {
                      e.preventDefault()
                      setSearch(e.target.value)
                    }}
                    onPressEnter={() => {
                      setPage(1)
                      getPaginatedChatbotDocuments(
                        API.chatbot.staffOnly.getListDocuments,
                        courseId,
                        page,
                        pageSize,
                        setTotal,
                        setListDocuments,
                        search,
                      )
                    }}
                  />
                  <Pagination
                    total={total}
                    showSizeChanger={false}
                    current={page}
                    pageSize={pageSize}
                    onChange={(page) => {
                      setPage(page)
                    }}
                  />
                </div>
                <List<ChatbotDocumentListResponse>
                  dataSource={listDocuments}
                  pagination={false}
                  renderItem={(listDocument: ChatbotDocumentListResponse) => (
                    <ChatbotListDocumentItem
                      listDocument={listDocument}
                      selectedDocuments={selectedDocuments}
                      toggleSelectDocument={toggleSelectDocument}
                      contentWordMap={contentWordMap}
                      hasSearch={search != undefined}
                    />
                  )}
                />
              </>
            ),
          },
          {
            key: 'selected',
            label: `Selected Citations (${selectedDocuments.length})`,
            children: (
              <List<ChatbotDocumentListResponse>
                dataSource={selectedInListForm}
                pagination={false}
                renderItem={(citation: ChatbotDocumentListResponse) => (
                  <ChatbotListDocumentItem
                    listDocument={citation}
                    selectedDocuments={selectedDocuments}
                    toggleSelectDocument={toggleSelectDocument}
                    contentWordMap={contentWordMap}
                    hasSearch={search != undefined}
                  />
                )}
              />
            ),
          },
        ]}
      ></Tabs>
    </>
  )
}

export default ChatbotSelectCitations
