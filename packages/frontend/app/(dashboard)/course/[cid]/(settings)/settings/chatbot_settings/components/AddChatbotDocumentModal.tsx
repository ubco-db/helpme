'use client'

import {
  ExclamationCircleFilled,
  FileAddOutlined,
  GithubOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Progress,
  Segmented,
  Switch,
} from 'antd'
import Dragger from 'antd/es/upload/Dragger'
import { useState } from 'react'
import { RcFile } from 'antd/lib/upload'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

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
  const [countProcessed, setCountProcessed] = useState(0)
  const [fileList, setFileList] = useState<any[]>([])
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [confirmPopoverOpen, setConfirmPopoverOpen] = useState(false)

  const addDocument = async () => {
    setConfirmPopoverOpen(false)
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

  const uploadFiles = async (files: RcFile[]) => {
    setCountProcessed(0)
    let wasError = false
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('parseAsPng', isSlideDeck.toString())

      await API.chatbot.staffOnly
        .uploadDocument(courseId, formData)
        .then(async () => {
          message.success(`${file.name} uploaded and processed!`)
          setCountProcessed((prev) => prev + 1)
        })
        .catch((e) => {
          uploadErrors.push(
            `Failed to upload/process ${file.name}: ${getErrorMessage(e)}`,
          )
          wasError = true
        })
    }
    if (!wasError) handleSuccess()
  }

  const addUrl = async (url: string) => {
    await API.chatbot.staffOnly
      .addDocumentFromGithub(courseId, url)
      .then(async () => {
        message.success('File successfully uploaded')
        handleSuccess()
      })
      .catch((e) => {
        uploadErrors.push(
          `Failed to upload file (${e}). Please check the file type of linked document`,
        )
      })
  }

  return (
    <Modal
      title="Add a new document for your chatbot to use."
      open={open}
      onCancel={() => !loading && onClose()}
      closable={!loading}
      destroyOnHidden
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
        loading: loading,
        onClick: async () => {
          await form.validateFields().then((formData) => {
            if (documentType === 'FILE' && formData.isSlideDeck) {
              setConfirmPopoverOpen(true)
            } else {
              addDocument()
            }
          })
        },
      }}
      okText="Confirm"
      cancelButtonProps={{
        disabled: loading,
        onClick: onClose,
      }}
      width={625}
      footer={(_, { OkBtn, CancelBtn }) => (
        <div className={`flex flex-wrap justify-end gap-2 md:gap-3`}>
          <CancelBtn />
          <div>
            <OkBtn />
            <Popconfirm
              title={
                <div className="flex max-w-80 flex-col gap-y-2">
                  <p>
                    <b className="font-semibold">
                      This may take a few minutes to process
                    </b>
                    ; feel free to open a new tab and do something else during
                    that time.
                  </p>
                  <p>
                    Any errors that occur during processing will be shown here.
                  </p>
                  <p>Would you like to continue?</p>
                </div>
              }
              onConfirm={addDocument}
              okText="Yes"
              icon={<ExclamationCircleFilled className="text-blue-500" />}
              cancelText="No"
              open={confirmPopoverOpen}
              onCancel={() => setConfirmPopoverOpen(false)}
              okButtonProps={{ className: 'px-4' }}
              cancelButtonProps={{ className: 'px-4' }}
              placement={'bottomRight'}
            ></Popconfirm>
          </div>
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
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">
                    Click or drag file to this area to upload
                  </p>
                  <p className="ant-upload-hint">
                    Supports single or bulk upload
                  </p>
                </Dragger>
              </Form.Item>
              {loading && fileList.length > 1 && (
                <Progress
                  percent={Math.round((countProcessed / fileList.length) * 100)}
                />
              )}
              <Form.Item
                name="isSlideDeck"
                label="Parse document as slides"
                tooltip="By default images/graphics embedded in your uploaded files will not be detected by the chatbot. Ticking this will transform pages of the document into images and automatically generate AI summaries of said images. This is useful for any document that isn't just text. Warning that it will take a lot longer to process."
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
        {uploadErrors.length > 0 &&
          uploadErrors.map((uploadError, idx) => (
            <Alert
              key={idx}
              description={
                'There was an error uploading or processing your document: ' +
                uploadError
              }
              type="error"
              showIcon
              closable
              onClose={() =>
                setUploadErrors(uploadErrors.filter((_, i) => i !== idx))
              }
            />
          ))}
      </>
    </Modal>
  )
}

export default AddChatbotDocumentModal
