'use client'

import {
  CheckOutlined,
  DeleteOutlined,
  FileAddOutlined,
  GithubOutlined,
  LoadingOutlined,
  RedoOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  Form,
  Input,
  List,
  message,
  Modal,
  Segmented,
  Switch,
  Tooltip,
  UploadFile,
} from 'antd'
import Dragger from 'antd/es/upload/Dragger'
import { useCallback, useEffect, useState } from 'react'
import { API } from '@/app/api'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import { useAsyncToaster } from '@/app/contexts/AsyncToasterContext'
import ChatbotHelpTooltip from '../../components/ChatbotHelpTooltip'
import { useWebSocket } from '@/app/contexts/WebSocketContext'
import {
  ChatbotDocumentAggregateResponse,
  ChatbotResultEventName,
  ChatbotResultEvents,
} from '@koh/common'
import { toast } from 'sonner'
import { UploadChangeParam } from 'antd/es/upload'

interface AddChatbotDocumentModalProps {
  courseId: number
  open: boolean
  onClose: () => void
  getDocumentsProxy: () => void
}

type SocketExpectedReturn = {
  params: { resultId: string; type: ChatbotResultEventName }
  data: ChatbotDocumentAggregateResponse | Error
}

type UploadedStatus =
  | 'error'
  | 'done'
  | 'uploading'
  | 'removed'
  | 'queued'
  | 'uploaded'
type UploadedFile = Omit<UploadFile, 'status'> & {
  status?: UploadedStatus
  resultId?: string
}

const AddChatbotDocumentModal: React.FC<AddChatbotDocumentModalProps> = ({
  courseId,
  open,
  onClose,
  getDocumentsProxy,
}) => {
  const webSocket = useWebSocket()

  const [documentType, setDocumentType] = useState('FILE')
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [isSlideDeck, setIsSlideDeck] = useState(false)
  const [fileList, setFileList] = useState<
    (UploadedFile & { resultId?: string })[]
  >([])
  const [selectedFiles, setSelectedFiles] = useState<UploadFile[]>([])
  const [urlUpload, setUrlUpload] = useState<
    { url: string; resultId?: string; status: 'queued' | 'uploading' }[]
  >([])
  const { runAsyncToast } = useAsyncToaster()

  const addDocument = async () => {
    setLoading(true)
    try {
      const formData = await form.validateFields()

      if (documentType === 'URL') {
        await addUrl(formData.url)
      } else if (documentType === 'FILE') {
        await uploadFiles()
      }
    } finally {
      setLoading(false)
    }
  }

  const uploadNextFile = useCallback(
    async (callback: () => Promise<void>) => {
      const i = fileList.findIndex((v) => v.status === 'queued')
      if (i < 0) {
        // no more pending documents = all done!
        message.info('All file uploads have finished processing.')
      }
      const file = fileList[i]

      const formData = new FormData()
      formData.append('file', file.originFileObj!)
      formData.append('parseAsPng', isSlideDeck.toString())

      setFileList((prev) =>
        prev.map((f) =>
          f.uid === file.uid ? { ...f, status: 'uploading' } : f,
        ),
      )

      runAsyncToast(
        () => API.chatbot.staffOnly.uploadDocument(courseId, formData),
        (result: string, error) => {
          // handle the success/error
          if (error) {
            setFileList((prevFileList) =>
              prevFileList.map((f) =>
                f.uid === file.uid
                  ? { ...f, status: 'error', response: getErrorMessage(error) }
                  : f,
              ),
            )
          } else {
            webSocket
              .subscribe(ChatbotResultEvents.GET_RESULT, {
                type: ChatbotResultEventName.ADD_AGGREGATE,
                resultId: result,
              })
              .then((res) => {
                if (!res.success) {
                  toast.info(
                    `Queued processing for but failed to subscribe for ${file.name}'s results. Queueing next upload.`,
                  )
                  setFileList((prev) =>
                    prev.map((f) =>
                      f.uid === file.uid
                        ? {
                            ...f,
                            status: 'uploaded',
                            response: getErrorMessage(error),
                          }
                        : f,
                    ),
                  )
                  callback()
                  return
                }
                setFileList((prev) =>
                  prev.map((f) =>
                    f.uid === file.uid ? { ...f, resultId: result } : f,
                  ),
                )
              })
          }
        },
        {
          successMsg: `${file.name} uploaded and queued for processing!`,
          errorMsg: `Failed to upload and/or queue processing for ${file.name}`,
          appendApiError: true,
          successDuration: 3500,
        },
      )
    },
    [courseId, fileList, isSlideDeck, runAsyncToast, webSocket],
  )

  const uploadNextUrl = useCallback(
    async (callback: () => Promise<void>) => {
      const next = urlUpload.find((v) => v.status === 'queued')
      if (!next) {
        message.info('All URL uploads have finished processing.')
        return
      }

      runAsyncToast(
        () => API.chatbot.staffOnly.addDocumentFromURL(courseId, next.url),
        (result: string, error) => {
          // handle the success/error
          if (error) {
            setUrlUpload((prev) => prev.filter((v) => v.url != next.url))
          } else {
            webSocket
              .subscribe(ChatbotResultEvents.GET_RESULT, {
                type: ChatbotResultEventName.ADD_AGGREGATE,
                resultId: result,
              })
              .then((res) => {
                if (!res.success) {
                  toast.info(
                    `Queued processing for but failed to subscribe for results of URL "${next.url}".`,
                  )
                  setUrlUpload((prev) => prev.filter((v) => v.url !== next.url))

                  const hasRemainingUrl = urlUpload.some(
                    (v) => v.status !== 'uploading',
                  )

                  if (hasRemainingUrl) {
                    callback()
                  }
                  return
                }
                setUrlUpload((prev) =>
                  prev.map((v) =>
                    v.url === next.url
                      ? { ...v, status: 'uploading', resultId: result }
                      : v,
                  ),
                )
              })
          }
        },
        {
          successMsg: `File at URL "${next.url}" queued for processing. You will be notified of completion.`,
          errorMsg: `Failed to queue processing for URL "${next.url}". Please check the file type of the document at this URL.`,
          appendApiError: true,
          successDuration: 3500,
        },
      )
    },
    [courseId, runAsyncToast, urlUpload, webSocket],
  )

  const listener = useCallback(
    async (data: SocketExpectedReturn) => {
      console.log(data)
      if ('params' in data && 'resultId' in data.params) {
        const { resultId } = data.params
        const response = data.data

        const fileMatch = fileList.find((v) => v.resultId === resultId)
        const urlMatch = urlUpload.find((v) => v.resultId === resultId)

        if ('error' in response) {
          // an error occurred and was transmitted down
          toast.error(
            `Failed to process ${fileMatch?.name ?? urlMatch?.url ?? 'document'} upload: ${response}`,
          )
        } else {
          // success
          getDocumentsProxy()
          if (fileMatch) {
            // file upload
            toast.success(`${fileMatch.name} successfully processed.`)
            // remove the file from the list
            setFileList((prev) =>
              prev.map((v) =>
                v.resultId === resultId ? { ...v, status: 'done' } : v,
              ),
            )
            // queue up the next file (which is technically recursive, I guess)
          } else if (urlMatch) {
            // url upload
            toast.success(
              `URL document at "${urlMatch.url}" successfully processed.`,
            )
            setUrlUpload((prev) => prev.filter((v) => v.resultId !== resultId))
          }
        }
      }
    },
    [fileList, getDocumentsProxy, urlUpload],
  )

  async function uploadNext() {
    const hasRemainingFile = fileList.some((v) => v.status !== 'queued')
    const hasRemainingUrl = urlUpload.some((v) => v.status !== 'uploading')

    if (hasRemainingFile) {
      // arbitrarily prioritize files
      await uploadNextFile(uploadNext)
      return
    }
    if (hasRemainingUrl) {
      await uploadNextUrl(uploadNext)
      return
    }
  }

  const uploadFiles = async () => {
    const uids = fileList.map((f) => f.uid)
    const subset = selectedFiles.filter((s) => !uids.includes(s.uid))
    setFileList((prev) => [
      ...prev,
      ...subset.map((f) => ({ ...f, status: 'queued' as UploadedStatus })),
    ])
    setSelectedFiles([])
    onClose()
  }

  const [prevFileList, setPrevFileList] = useState<UploadedFile[]>([])
  useEffect(() => {
    const uids = prevFileList.map((v) => v.uid)
    const newAmount = fileList.length - prevFileList.length
    const newFiles = fileList.filter((v) => !uids.includes(v.uid))
    if (
      fileList.length > 0 &&
      !fileList.some((v) => v.status === 'uploading')
    ) {
      uploadNextFile(uploadNext).then()
    } else {
      if (newAmount > 1) {
        message.info(
          `There is already a file being uploaded, but the file${newAmount > 1 ? 's' : ''} ${newFiles.map((v) => v.name).join(', ')} ha${newAmount > 1 ? 've' : 's'} been queued.`,
        )
      }
    }
    setPrevFileList(fileList)
  }, [fileList])

  const addUrl = async (url: string) => {
    if (urlUpload.some((v) => v.url == url)) {
      message.warning(
        `The document at ${url} is already being used in an upload operation.`,
      )
      return
    }
    setUrlUpload((prev) => [...prev, { url, status: 'queued' }])
    if (!urlUpload.some((v) => v.status === 'uploading')) {
      uploadNextUrl(uploadNext).then()
    } else {
      message.info(
        `There is already a URL being uploaded, but the URL "${url}" has been queued.`,
      )
    }
    onClose()
  }

  useEffect(() => {
    if (webSocket) {
      webSocket.onMessageEvent.on(ChatbotResultEvents.POST_RESULT, listener)
      return () => {
        webSocket.onMessageEvent.off(ChatbotResultEvents.POST_RESULT, listener)
      }
    }
    return () => {}
  }, [listener, webSocket])

  return (
    <Modal
      centered
      title={
        <div className="flex items-center gap-2">
          <FileAddOutlined />
          <p className="w-full md:flex">
            Add a New Document to the Chatbot
            <ChatbotHelpTooltip
              forPage="add_chatbot_document"
              className="mr-6 inline-block md:ml-auto md:block"
            />
          </p>
        </div>
      }
      open={open}
      onCancel={() => !loading && onClose()}
      closable={!loading}
      destroyOnHidden
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
        loading: loading,
        onClick: async () => {
          await form.validateFields().then(() => {
            addDocument()
          })
        },
      }}
      okText={
        fileList.some((f) => f.status === 'error') ? 'Try Again' : 'Confirm'
      }
      cancelButtonProps={{
        disabled: loading,
        onClick: onClose,
      }}
      width={625}
      footer={(_, { OkBtn, CancelBtn }) => (
        <div className={`flex flex-wrap justify-end gap-2 md:gap-3`}>
          <CancelBtn />
          <OkBtn />
        </div>
      )}
    >
      <>
        <div className="flex items-center justify-center">
          <Segmented
            options={[
              {
                value: 'FILE',
                label: (
                  <div className="flex items-center gap-2">
                    <FileAddOutlined />
                    <p>Upload Files</p>
                  </div>
                ),
              },
              {
                value: 'URL',
                label: (
                  <div className="flex items-center gap-2">
                    <GithubOutlined />
                    <p>GitHub File</p>
                  </div>
                ),
              },
            ]}
            value={documentType}
            size="large"
            className="m-2"
            onChange={(value) => setDocumentType(value)}
          />
        </div>
        <Form form={form}>
          {documentType === 'URL' && (
            <div className="flex flex-col">
              <p>
                <b>Accepted File Types:</b> .pdf, .docx, .pptx, .csv, .txt
              </p>
              <Form.Item
                name="url"
                label="GitHub URL"
                className="mb-2 w-full"
                rules={[
                  {
                    required: true,
                    message: 'Please provide a github document URL.',
                  },
                ]}
              >
                <Input placeholder="https://github.com/.../some_document.pdf" />
              </Form.Item>
            </div>
          )}
          {documentType === 'FILE' && (
            <>
              <p>
                <b>Accepted File Types:</b> .pdf, .docx, .pptx, .xlsx, .csv,
                .txt, .md, most image formats
              </p>
              <Form.Item
                name="files"
                rules={[
                  {
                    required: true,
                    message: 'Please provide document files.',
                  },
                ]}
              >
                <Dragger
                  name="file"
                  multiple={true}
                  accept=".docx,.pptx,.txt,.csv,.pdf,.md,.png,.jpg,.jpeg,.gif,.tiff,.xls,.xlsx,.doc,.rtf,.svg,.ppt,.odt,.ods,.odp,.epub,.vsd,.vsdx"
                  fileList={selectedFiles}
                  onChange={(info: UploadChangeParam) =>
                    setSelectedFiles(info.fileList)
                  }
                  maxCount={10}
                  beforeUpload={() => false} // Prevent automatic upload
                >
                  <p className="ant-upload-drag-icon">
                    <UploadOutlined />
                  </p>
                  <p className="ant-upload-text">
                    Click or drag file to this area to upload
                  </p>
                  <p className="ant-upload-hint">
                    Supports single or bulk upload
                  </p>
                </Dragger>
              </Form.Item>
              <Form.Item
                name="isSlideDeck"
                label="Parse document(s) as slides"
                tooltip="By default images/graphics embedded in your uploaded files will not be detected by the chatbot. Ticking this will transform pages of the document into images and automatically generate AI detailed descriptions of said images (using a UBC-hosted AI model). This is useful for any document that isn't just text. Warning that it will take a lot longer to process."
              >
                <Switch
                  defaultChecked={isSlideDeck}
                  disabled={false}
                  onChange={(checked) => setIsSlideDeck(checked)}
                />
              </Form.Item>

              {fileList.length > 0 && (
                <div className={'mt-2 flex flex-col gap-1'}>
                  <p className={'font-semibold'}>Uploaded Files</p>
                  <List<UploadedFile>
                    dataSource={fileList}
                    bordered={false}
                    renderItem={(item: UploadedFile) => (
                      <List.Item>
                        <div className={'flex gap-2'}>
                          <div
                            className={cn(
                              item.status === 'uploaded'
                                ? 'text-yellow-300'
                                : '',
                              item.status === 'error' ? 'text-red-600' : '',
                              item.status === 'uploading'
                                ? 'text-blue-500'
                                : '',
                              item.status === 'done' ? 'text-green-500' : '',
                            )}
                          >
                            <Tooltip
                              className={'flex gap-2'}
                              title={(() => {
                                switch (item.status) {
                                  case 'uploaded':
                                    return 'This document was uploaded but results were unable to be subscribed for.'
                                  case 'error':
                                    return 'This document failed to upload or process.'
                                  case 'uploading':
                                    return 'This document is in progress of being uploaded'
                                  case 'done':
                                    return 'This document successfully finished processing and uploading.'
                                }
                                return null
                              })()}
                            >
                              {(item.status === 'uploaded' ||
                                item.status === 'error') && <WarningOutlined />}
                              {item.status === 'uploading' && (
                                <LoadingOutlined />
                              )}
                              {item.status === 'done' && <CheckOutlined />}
                              <span>{item.name}</span>
                            </Tooltip>
                          </div>
                          <div>
                            {item.status === 'error' && (
                              <>
                                <button
                                  onClick={() => {
                                    setFileList((prev) => [
                                      ...prev,
                                      { ...item, status: 'queued' },
                                    ])
                                    if (
                                      !fileList.some(
                                        (v) => v.status === 'uploading',
                                      )
                                    ) {
                                      uploadNext()
                                    }
                                  }}
                                >
                                  <RedoOutlined
                                    className={'hover:text-helpmeblue'}
                                  />
                                </button>
                              </>
                            )}
                            {(item.status === 'queued' ||
                              item.status === 'error') && (
                              <>
                                <button
                                  onClick={() =>
                                    setFileList((prev) =>
                                      prev.filter((v) => v.uid !== item.uid),
                                    )
                                  }
                                >
                                  <DeleteOutlined
                                    className={'hover:text-red-500'}
                                  />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </div>
              )}
            </>
          )}
        </Form>
      </>
    </Modal>
  )
}

export default AddChatbotDocumentModal
