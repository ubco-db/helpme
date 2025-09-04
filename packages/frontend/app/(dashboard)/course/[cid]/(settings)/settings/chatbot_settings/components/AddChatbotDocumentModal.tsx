'use client'

import {
  ExclamationCircleFilled,
  FileAddOutlined,
  GithubOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Segmented,
  Switch,
} from 'antd'
import Dragger from 'antd/es/upload/Dragger'
import { useState } from 'react'
import { RcFile } from 'antd/lib/upload'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { useAsyncToaster } from '@/app/contexts/AsyncToasterContext'
import ChatbotHelpTooltip from '../../components/ChatbotHelpTooltip'

interface AddChatbotDocumentModalProps {
  courseId: number
  open: boolean
  onClose: () => void
  getDocuments: () => void
}

const AddChatbotDocumentModal: React.FC<AddChatbotDocumentModalProps> = ({
  courseId,
  open,
  onClose,
  getDocuments,
}) => {
  const [documentType, setDocumentType] = useState('FILE')
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [isSlideDeck, setIsSlideDeck] = useState(false)
  const [fileList, setFileList] = useState<any[]>([])
  const { runAsyncToast } = useAsyncToaster()

  const addDocument = async () => {
    setLoading(true)
    try {
      const formData = await form.validateFields()

      if (documentType === 'URL') {
        await addUrl(formData.url)
      } else if (documentType === 'FILE') {
        const files = fileList.map((file) => file.originFileObj)
        await uploadFiles(files)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSuccess = () => {
    setFileList([])
    form.resetFields()
    getDocuments()
    onClose()
  }

  const uploadNextFile = async (i: number, files: RcFile[]) => {
    const file = files[i]
    // if the file is already uploading or done, skip it and inform the user
    if (fileList.find((f) => f.uid === file.uid)?.status === 'uploading') {
      message.info(`${file.name} is still being processed.`)
      return
    } else if (fileList.find((f) => f.uid === file.uid)?.status === 'done') {
      message.info(`${file.name} is already done being processed.`)
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('parseAsPng', isSlideDeck.toString())

    setFileList((prevFileList) =>
      prevFileList.map((f) =>
        f.uid === file.uid ? { ...f, status: 'uploading' } : f,
      ),
    )

    runAsyncToast(
      () => API.chatbot.staffOnly.uploadDocument(courseId, formData),
      (result, error) => {
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
          // success
          getDocuments()
          // remove the file from the list
          setFileList((prevFileList) =>
            prevFileList.filter((f) => f.uid !== file.uid),
          )
          // if it's the last file (and there's more than 1 document being uploaded), say that all documents have finished
          if (i >= files.length - 1 && files.length > 1) {
            message.info(
              `All ${files.length} uploaded chatbot documents have finished processing`,
              3.5,
            )
          }
        }
        // queue up the next file (which is technically recursive, I guess)
        if (i < files.length - 1) {
          uploadNextFile(i + 1, files)
        }
      },
      {
        successMsg: `${file.name} uploaded and processed!`,
        errorMsg: `Failed to upload/process ${file.name}`,
        appendApiError: true,
        successDuration: 3500,
      },
    )
  }

  const uploadFiles = async (files: RcFile[]) => {
    uploadNextFile(0, files)
    message.info(
      `${files.length === 1 ? 'The document' : `All ${files.length} documents`} have been queued for processing. You will be notified of completion.`,
      3.5,
    )
    onClose()
  }

  const addUrl = async (url: string) => {
    await API.chatbot.staffOnly
      .addDocumentFromGithub(courseId, url)
      .then(async () => {
        message.success('File successfully uploaded')
        handleSuccess()
      })
      .catch((e) => {
        message.error(
          `Failed to upload file (${getErrorMessage(e)}). Please check the file type of linked document`,
        )
      })
  }

  return (
    <Modal
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
                  fileList={fileList}
                  onChange={(info: any) => {
                    setFileList(info.fileList)
                  }}
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
            </>
          )}
        </Form>
      </>
    </Modal>
  )
}

export default AddChatbotDocumentModal
