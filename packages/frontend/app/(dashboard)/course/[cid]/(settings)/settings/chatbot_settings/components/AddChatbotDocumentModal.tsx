'use client'

import {
  ExclamationCircleFilled,
  FileAddOutlined,
  GithubOutlined,
  UploadOutlined,
  CheckCircleFilled,
  PaperClipOutlined,
} from '@ant-design/icons'
import {
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Segmented,
  Switch,
  UploadFile,
} from 'antd'
import Dragger from 'antd/es/upload/Dragger'
import { useEffect, useState } from 'react'
import { RcFile } from 'antd/lib/upload'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import ChatbotHelpTooltip from '../../components/ChatbotHelpTooltip'
import styles from './AddChatbotDocumentModal.module.css'
import { useAlerts } from '@/app/contexts/AlertsContext'
import {
  AlertDeliveryMode,
  AlertType,
  ChatbotDocumentProcessedPayload,
  ToastType,
} from '@koh/common'
import { UploadFileStatus } from 'antd/es/upload/interface'

type UploadFileCustom = Omit<UploadFile, 'status'> & {
  status?: UploadFileStatus | 'processed'
}

interface AddChatbotDocumentModalProps {
  courseId: number
  open: boolean
  setModalOpen: (open: boolean) => void
  getDocuments: () => void
}

const AddChatbotDocumentModal: React.FC<AddChatbotDocumentModalProps> = ({
  courseId,
  open,
  setModalOpen,
  getDocuments,
}) => {
  const [documentType, setDocumentType] = useState('FILE')
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [isSlideDeck, setIsSlideDeck] = useState(false)
  const [fileList, setFileList] = useState<UploadFileCustom[]>([])

  const { registerNewAlertHandler, unregisterNewAlertHandler } = useAlerts()

  useEffect(() => {
    console.log('reguistering things')

    registerNewAlertHandler(
      'add-chatbot-document-handler',
      (alert) => {
        console.log('New alert for file processing', alert)
        const payload = alert.payload as ChatbotDocumentProcessedPayload
        if (payload.toastType === ToastType.ERROR) {
          setFileList((prevFileList) =>
            prevFileList.map((file) =>
              file.uid === payload.uploadId
                ? { ...file, status: 'error', response: payload.description }
                : file,
            ),
          )
        } else if (payload.toastType === ToastType.SUCCESS) {
          setFileList((prevFileList) =>
            prevFileList.map((file) =>
              file.uid === payload.uploadId
                ? { ...file, status: 'processed' }
                : file,
            ),
          )
          getDocuments()
        }
      },
      AlertDeliveryMode.TOAST,
      AlertType.CHATBOT_DOCUMENT_PROCESSED,
    )

    return () => {
      unregisterNewAlertHandler('add-chatbot-document-handler')
      console.log('unregistering things')
    }
  }, [registerNewAlertHandler, unregisterNewAlertHandler])

  const addDocument = async () => {
    setLoading(true)
    try {
      const formData = await form.validateFields()

      if (documentType === 'URL') {
        await addUrl(formData.url)
      } else if (documentType === 'FILE') {
        const files = fileList
          .map((file) => file.originFileObj)
          .filter((f) => f !== undefined && f !== null)
        await uploadFiles(files)
      }
    } finally {
      setLoading(false)
    }
  }

  const uploadNextFile = async (
    i: number,
    filesToUpload: RcFile[],
    errorDuringUploadObject: { value: string | null },
  ) => {
    const fileToUpload = filesToUpload[i]
    // if the file is already uploading or done, skip it and inform the user
    const existingFile = fileList.find((f) => f.uid === fileToUpload.uid)
    if (existingFile?.status === 'uploading') {
      message.info(`${fileToUpload.name} is still being uploaded.`)
      if (i < filesToUpload.length - 1) {
        await uploadNextFile(i + 1, filesToUpload, errorDuringUploadObject)
      }
      return
    } else if (
      existingFile?.status === 'done' ||
      existingFile?.status === 'processed'
    ) {
      if (i < filesToUpload.length - 1) {
        await uploadNextFile(i + 1, filesToUpload, errorDuringUploadObject)
      }
      return
    }

    setFileList((prevFileList) =>
      prevFileList.map((f) =>
        f.uid === fileToUpload.uid ? { ...f, status: 'uploading' } : f,
      ),
    )

    console.log('fileToUpload', fileToUpload)

    await API.chatbot.staffOnly
      .uploadDocument(
        courseId,
        fileToUpload,
        { parseAsPng: isSlideDeck, uploadId: fileToUpload.uid },
        (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            )
            setFileList((prevFileList) =>
              prevFileList.map((f) =>
                f.uid === fileToUpload.uid ? { ...f, percent } : f,
              ),
            )
          }
        },
      )
      .then((res) => {
        setFileList((prevFileList) =>
          prevFileList.map((f) =>
            f.uid === fileToUpload.uid
              ? { ...f, status: 'done', percent: 100 }
              : f,
          ),
        )
      })
      .catch((error) => {
        setFileList((prevFileList) =>
          prevFileList.map((f) =>
            f.uid === fileToUpload.uid
              ? { ...f, status: 'error', response: getErrorMessage(error) }
              : f,
          ),
        )
        errorDuringUploadObject.value = getErrorMessage(error)
      })
    // queue up the next file (which is technically recursive, I guess)
    if (i < filesToUpload.length - 1) {
      await uploadNextFile(i + 1, filesToUpload, errorDuringUploadObject)
    }
  }

  const uploadFiles = async (files: RcFile[]) => {
    const errorDuringUploadObject = { value: null } // object that we pass by reference to stop the modal from closing if any of the uploads fail
    await uploadNextFile(0, files, errorDuringUploadObject)
    if (!errorDuringUploadObject.value) {
      const numFilesToUpload = fileList.filter(
        (f) => f.status !== 'done' && f.status !== 'processed',
      ).length
      message.info(
        `${numFilesToUpload === 1 ? 'The document has' : `All ${numFilesToUpload} documents have`} been queued for processing. You will be notified upon completion. It is safe to close this tab.`,
        4.5,
      )
      setModalOpen(false)
    }
  }

  const addUrl = async (url: string) => {
    await API.chatbot.staffOnly
      .addDocumentFromGithub(courseId, url)
      .then(async () => {
        message.success('File successfully uploaded')
        setFileList([])
        form.resetFields()
        getDocuments()
        setModalOpen(false)
      })
      .catch((e) => {
        message.error(
          `Failed to upload file (${getErrorMessage(e)}). Make sure the link points directly to the file on github and it's a supported file type.`,
        )
      })
  }

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <FileAddOutlined />
          <div className="w-full md:flex">
            Add a New Document to the Chatbot
            <ChatbotHelpTooltip
              forPage="add_chatbot_document"
              className="mr-6 inline-block md:ml-auto md:block"
            />
          </div>
        </div>
      }
      open={open}
      maskClosable={!loading}
      onCancel={() => {
        if (!loading) {
          setModalOpen(false)
        }
      }}
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
        disabled:
          fileList.every(
            (f) => f.status === 'done' || f.status === 'processed',
          ) && documentType === 'FILE',
      }}
      okText={
        fileList.some((f) => f.status === 'error') ? 'Try Again' : 'Confirm'
      }
      cancelButtonProps={{
        disabled: loading,
        onClick: () => setModalOpen(false),
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
                  className={styles.chatbotDragger}
                  name="file"
                  multiple={true}
                  accept=".docx,.pptx,.txt,.csv,.pdf,.md,.png,.jpg,.jpeg,.gif,.tiff,.xls,.xlsx,.doc,.rtf,.svg,.ppt,.odt,.ods,.odp,.epub,.vsd,.vsdx"
                  fileList={fileList as UploadFile<any>[]} // so that we can have custom 'processed' status
                  onChange={(info) => {
                    setFileList(info.fileList)
                  }}
                  onRemove={(file) => {
                    setFileList((prev) =>
                      prev.filter((f) => f.uid !== file.uid),
                    )
                  }}
                  maxCount={10}
                  beforeUpload={(file) => {
                    console.log('new file added', file)
                    // setFileList([...fileList, { ...file, status: 'adding' }]);
                    return false
                  }}
                  showUploadList={{
                    extra: ({ size = 0, status: rawStatus }) => {
                      const status = rawStatus as UploadFileCustom['status']
                      return (
                        <>
                          <span className="ml-1 text-zinc-400">
                            ({(size / 1024 / 1024).toFixed(2)}MB)
                          </span>
                          {status === 'done' && (
                            <span className="ml-1 text-blue-500">
                              Uploaded & Processing
                            </span>
                          )}
                          {status === 'error' && (
                            <span className="ml-1 text-red-500">Error</span>
                          )}
                          {status === 'processed' && (
                            <span className="ml-1 text-green-500">
                              Processed Successfully
                            </span>
                          )}
                        </>
                      )
                    },
                  }}
                  iconRender={({ status: rawStatus }) => {
                    const status = rawStatus as UploadFileCustom['status']
                    if (status === 'done') {
                      return <CheckCircleFilled className="text-blue-500" />
                    } else if (status === 'processed') {
                      return <CheckCircleFilled className="text-green-500" />
                    }
                    return <PaperClipOutlined />
                  }}
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
            </>
          )}
        </Form>
      </>
    </Modal>
  )
}

export default AddChatbotDocumentModal
