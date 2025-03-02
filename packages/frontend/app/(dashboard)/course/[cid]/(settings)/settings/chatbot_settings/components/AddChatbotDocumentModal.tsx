'use client'

import {
  ExclamationCircleFilled,
  FileAddOutlined,
  GithubOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import {
  Modal,
  Form,
  Input,
  Progress,
  Switch,
  message,
  Popconfirm,
  Alert,
  Segmented,
} from 'antd'
import Dragger from 'antd/es/upload/Dragger'
import { useState } from 'react'
import { RcFile } from 'antd/lib/upload'
import { useUserInfo } from '@/app/contexts/userContext'
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
  const { userInfo } = useUserInfo()
  const [fileList, setFileList] = useState<any[]>([])
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [confirmPopoverOpen, setConfirmPopoverOpen] = useState(false)

  const addDocument = async () => {
    setLoading(true)
    try {
      const formData = await form.validateFields()

      if (documentType === 'URL') {
        await addUrl(formData.url)
      } else if (documentType === 'FILE') {
        const files = fileList.map((file) => file.originFileObj)
        await uploadFiles(files, formData.source)
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

  const uploadFiles = async (files: RcFile[], source: string) => {
    setCountProcessed(0)
    let wasError = false
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      // Create a JSON object and convert it to a string
      const jsonData = {
        source: source,
        parseAsPng: isSlideDeck,
      }
      formData.append(
        'source',
        new Blob([JSON.stringify(jsonData)], { type: 'application/json' }),
      )

      await fetch(`/chat/${courseId}/document`, {
        method: 'POST',
        body: formData,
        headers: { HMS_API_TOKEN: userInfo.chat_token.token },
      })
        .then(async (res) => {
          if (!res.ok) {
            let error
            if (res.headers.get('Content-Type')?.includes('application/json')) {
              error = getErrorMessage(await res.json())
            } else {
              error = await res.text()
            }
            throw new Error(`${res.status} ${res.statusText} ${error}`)
          }
          message.success(`${file.name} uploaded and processed!`)
          setCountProcessed((prev) => prev + 1)
        })
        .catch((e) => {
          uploadErrors.push(`Failed to upload/process ${file.name}: ${e}`)
          wasError = true
        })
    }
    if (!wasError) handleSuccess()
  }

  const addUrl = async (url: string) => {
    const data = {
      url: url,
    }

    await fetch(`/chat/${courseId}/document/url/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        HMS_API_TOKEN: userInfo.chat_token.token,
      },
      body: JSON.stringify(data),
    })
      .then(async (res) => {
        if (!res.ok) {
          let error
          if (res.headers.get('Content-Type')?.includes('application/json')) {
            error = getErrorMessage(await res.json())
          } else {
            error = await res.text()
          }
          throw new Error(`${res.status} ${res.statusText} ${error}`)
        }
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
      destroyOnClose
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
        loading: loading,
        onClick: async () => {
          await form.validateFields().then(() => {
            setConfirmPopoverOpen(true)
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
            onOpenChange={(open) => setConfirmPopoverOpen(open)}
            okButtonProps={{ className: 'px-4' }}
            cancelButtonProps={{ className: 'px-4' }}
          >
            <OkBtn />
          </Popconfirm>
        </div>
      )}
    >
      <>
        <div className="flex items-center justify-between">
          <p>
            <b>Accepted File Types:</b> .docx, .pptx, .txt, .csv, .pdf
          </p>
          <Segmented
            options={[
              {
                value: 'FILE',
                label: (
                  <div className="flex items-center gap-2">
                    <FileAddOutlined />
                    <p className="d">Upload Files</p>
                  </div>
                ),
              },
              {
                value: 'URL',
                label: (
                  <div className="flex items-center gap-2">
                    <GithubOutlined />
                    <p className="">GitHub File</p>
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
            <Form.Item
              name="url"
              rules={[
                {
                  required: true,
                  message: 'Please provide a document URL.',
                },
              ]}
            >
              <Input placeholder="Enter URL for a pdf file..." />
            </Form.Item>
          )}
          {documentType === 'FILE' && (
            <>
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
                  accept=".docx,.pptx,.txt,.csv,.pdf"
                  fileList={fileList}
                  onChange={(info: any) => {
                    setFileList(info.fileList)
                  }}
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
                tooltip="This will generate descriptions for images, which is particularly useful if the document is a slide deck or another image-heavy component"
              >
                <Switch
                  defaultChecked={isSlideDeck}
                  disabled={false}
                  onChange={(checked) => setIsSlideDeck(checked)}
                />
              </Form.Item>
              <Form.Item
                name="source"
                label="Display URL"
                rules={[
                  {
                    required: true,
                    message: 'Please provide a document preview URL.',
                  },
                  {
                    type: 'url',
                    message: 'Please enter a valid URL.',
                  },
                ]}
                tooltip="When this source is cited by the chatbot and a student clicks on the citation, they will be redirected to this link. If you are uploading multiple files, they will all get this same source link."
              >
                <Input placeholder="https://canvas.ubc.ca/courses/..." />
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
