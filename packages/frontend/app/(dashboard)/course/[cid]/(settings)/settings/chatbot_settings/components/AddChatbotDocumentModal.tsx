'use client'

import {
  FileAddOutlined,
  GithubOutlined,
  InboxOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import {
  Modal,
  Form,
  Input,
  Button,
  Tooltip,
  Progress,
  Switch,
  message,
} from 'antd'
import Dragger from 'antd/es/upload/Dragger'
import { useState } from 'react'
import { RcFile } from 'antd/lib/upload'
import { useUserInfo } from '@/app/contexts/userContext'

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

  const addDocument = async () => {
    setLoading(true)
    try {
      const formData = await form.validateFields()

      if (documentType === 'URL') {
        await addUrl(formData.url)
      }

      if (documentType === 'FILE') {
        const files = fileList.map((file) => file.originFileObj)
        await uploadFiles(files, formData.source)
      }

      setLoading(false)
      setFileList([])
      form.resetFields()
      getDocuments()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const uploadFiles = async (files: RcFile[], source: string) => {
    setCountProcessed(0)
    for (const file of files) {
      try {
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

        const response = await fetch(`/chat/${courseId}/document`, {
          method: 'POST',
          body: formData,
          headers: { HMS_API_TOKEN: userInfo.chat_token.token },
        })

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }

        message.success(`${file.name} uploaded.`)
        setCountProcessed((prev) => prev + 1)
      } catch (e) {
        message.error(`Failed to upload ${file.name}`)
      }
    }
    getDocuments()
  }

  const addUrl = async (url: string) => {
    setLoading(true)
    try {
      const data = {
        url: url,
      }

      const response = await fetch(`/chat/${courseId}/document/url/github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: userInfo.chat_token.token,
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        message.success('File uploaded.')
        getDocuments()
      } else {
        message.warning(
          `Failed to upload file, please check the file type of linked document`,
        )
      }
    } catch (e) {
      console.log(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Add a new document for your chatbot to use."
      open={open}
      onCancel={() => !loading && onClose()}
      footer={[
        <Button key="ok" onClick={() => onClose()}>
          Cancel
        </Button>,
        <Button
          key="ok"
          type="primary"
          onClick={addDocument}
          disabled={loading}
        >
          Submit
        </Button>,
      ]}
    >
      <>
        <div>
          <p>
            <strong>Accepted File Types:</strong> .docx, .pptx, .txt, .csv, .pdf
          </p>
        </div>
        <div className="mb-2 flex h-fit w-full items-center justify-center gap-2">
          <div
            className={`${
              documentType == 'FILE'
                ? 'border-blue-300 text-black'
                : 'border-blue-100 text-gray-600'
            } flex flex-grow cursor-pointer items-center justify-center gap-2 rounded-lg  border-2 p-5 hover:bg-blue-50`}
            onClick={() => setDocumentType('FILE')}
          >
            <FileAddOutlined />
            <p className="text-md font-semibold">Upload Files</p>
          </div>
          <div
            className={`${
              documentType == 'URL'
                ? 'border-blue-300 text-black'
                : 'border-blue-100 text-gray-600'
            } flex flex-grow cursor-pointer items-center  justify-center gap-2 rounded-lg border-2  p-5 hover:bg-blue-50`}
            onClick={() => setDocumentType('URL')}
          >
            <GithubOutlined />
            <p className="text-md font-semibold">GitHub File</p>
          </div>
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
                    Support for a single or bulk upload. Strictly prohibited
                    from uploading company data or other banned files.
                  </p>
                </Dragger>
              </Form.Item>
              {loading && (
                <Progress
                  percent={Math.round((countProcessed / fileList.length) * 100)}
                />
              )}
              <div className="flex items-center justify-between align-middle">
                <div className="flex">
                  Parse document as slides{' '}
                  <Tooltip
                    title={
                      'This will generate descriptions for images, which is particularly useful if the document is a slide deck or another image-heavy component'
                    }
                  >
                    <QuestionCircleOutlined className="ml-2" />
                  </Tooltip>
                </div>
                <Switch
                  defaultChecked={isSlideDeck}
                  className="mt-0 pt-0"
                  disabled={false}
                  onChange={(checked) => setIsSlideDeck(checked)}
                />
              </div>
              <p>
                Preview URL{' '}
                <Tooltip
                  title={
                    'This preview URL will be used to redirect your students to view this file. Make sure to include http header unless you want to redirect route on this site.'
                  }
                >
                  <QuestionCircleOutlined className="ml-2" />{' '}
                </Tooltip>
              </p>
              <Form.Item
                name="source"
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
                tooltip="When this is cited by the chatbot and a student clicks on the citation, they will be redirected to this link"
              >
                <Input placeholder="Enter document preview URL..." />
              </Form.Item>
            </>
          )}
        </Form>
      </>
    </Modal>
  )
}

export default AddChatbotDocumentModal
