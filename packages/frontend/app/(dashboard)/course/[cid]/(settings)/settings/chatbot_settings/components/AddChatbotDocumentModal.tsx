'use client'

import {
  FileAddOutlined,
  GithubOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Form, Input, message, Modal, Segmented, Switch } from 'antd'
import Dragger from 'antd/es/upload/Dragger'
import { useState } from 'react'
import { RcFile } from 'antd/lib/upload'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { useAsyncToaster } from '@/app/contexts/AsyncToasterContext'

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
  const [useSemanticSplitting, setUseSemanticSplitting] = useState(false)
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

  const uploadFiles = async (files: RcFile[]) => {
    for (const file of files) {
      // if the file is already uploading or done, skip it and inform the user
      if (fileList.find((f) => f.uid === file.uid)?.status === 'uploading') {
        message.info(`${file.name} is still being processed.`)
        continue
      } else if (fileList.find((f) => f.uid === file.uid)?.status === 'done') {
        message.info(`${file.name} is already done being processed.`)
        continue
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('parseAsPng', isSlideDeck.toString())
      formData.append('semanticSplit', useSemanticSplitting.toString())

      setFileList((prevFileList) =>
        prevFileList.map((f) =>
          f.uid === file.uid ? { ...f, status: 'uploading' } : f,
        ),
      )

      runAsyncToast(
        () => API.chatbot.staffOnly.uploadDocument(courseId, formData),
        (result, error) => {
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
    message.info(
      'All documents have been queued for processing. You will be notified of completion.',
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
            </>
          )}
          <Form.Item
            name="isSlideDeck"
            label="Parse document(s) as slides"
            tooltip="By default images/graphics embedded in your uploaded files will not be detected by the chatbot. Ticking this will transform pages of the document into images and automatically generate AI detailed descriptions of said images (using a UBC-hosted AI model). This is useful for any document that isn't just text. Warning that it will take a lot longer to process."
          >
            <Switch
              defaultChecked={isSlideDeck}
              disabled={useSemanticSplitting}
              onChange={(checked) => {
                setIsSlideDeck(checked)
                if (useSemanticSplitting && checked) {
                  setUseSemanticSplitting(false)
                }
              }}
            />
          </Form.Item>
          <Form.Item
            name="useSemanticSplitting"
            label={
              <span>
                Use semantic text splitting
                <span className={'italic text-red-500'}>(Experimental)</span>
              </span>
            }
            tooltip="Uses text embedding and a sliding window algorithm to split the document in optimal places based on 'semantic difference' between adjacent windows. This is not recommended for documents with well-defined structures such as slide decks. Warning that it will take a lot longer to process."
          >
            <Switch
              defaultChecked={useSemanticSplitting}
              disabled={isSlideDeck}
              onChange={(checked) => {
                setUseSemanticSplitting(checked)
                if (isSlideDeck && checked) {
                  setIsSlideDeck(false)
                }
              }}
            />
          </Form.Item>
        </Form>
      </>
    </Modal>
  )
}

export default AddChatbotDocumentModal
