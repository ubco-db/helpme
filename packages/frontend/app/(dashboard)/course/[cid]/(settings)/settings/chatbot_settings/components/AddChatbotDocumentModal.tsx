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
import { useState } from 'react'
import { RcFile } from 'antd/lib/upload'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import ChatbotHelpTooltip from '../../components/ChatbotHelpTooltip'
import styles from './AddChatbotDocumentModal.module.css'

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
  const [fileList, setFileList] = useState<UploadFile<any>[]>([])

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
    files: RcFile[],
    errorDuringUploadObject: { value: string | null },
  ) => {
    const file = files[i]
    // if the file is already uploading or done, skip it and inform the user
    if (fileList.find((f) => f.uid === file.uid)?.status === 'uploading') {
      message.info(`${file.name} is still being processed.`)
      if (i < files.length - 1) {
        await uploadNextFile(i + 1, files, errorDuringUploadObject)
      }
      return
    } else if (fileList.find((f) => f.uid === file.uid)?.status === 'done') {
      if (i < files.length - 1) {
        await uploadNextFile(i + 1, files, errorDuringUploadObject)
      }
      return
    }

    setFileList((prevFileList) =>
      prevFileList.map((f) =>
        f.uid === file.uid ? { ...f, status: 'uploading' } : f,
      ),
    )

    console.log('file', file)

    await API.chatbot.staffOnly
      .uploadDocument(
        courseId,
        file,
        { parseAsPng: isSlideDeck, uploadId: file.uid },
        (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            )
            setFileList((prevFileList) =>
              prevFileList.map((f) =>
                f.uid === file.uid ? { ...f, percent } : f,
              ),
            )
          }
        },
      )
      .then((res) => {
        setFileList((prevFileList) =>
          prevFileList.map((f) =>
            f.uid === file.uid ? { ...f, status: 'done', percent: 100 } : f,
          ),
        )
      })
      .catch((error) => {
        setFileList((prevFileList) =>
          prevFileList.map((f) =>
            f.uid === file.uid
              ? { ...f, status: 'error', response: getErrorMessage(error) }
              : f,
          ),
        )
        errorDuringUploadObject.value = getErrorMessage(error)
      })
    // queue up the next file (which is technically recursive, I guess)
    if (i < files.length - 1) {
      await uploadNextFile(i + 1, files, errorDuringUploadObject)
    }

    // runAsyncToast(
    //   () => API.chatbot.staffOnly.uploadDocument(courseId, formData),
    //   (result, error) => {
    //     // handle the success/error
    //     if (error) {
    //       setFileList((prevFileList) =>
    //         prevFileList.map((f) =>
    //           f.uid === file.uid
    //             ? { ...f, status: 'error', response: getErrorMessage(error) }
    //             : f,
    //         ),
    //       )
    //     } else {
    //       // success
    //       getDocuments()
    //       // remove the file from the list
    //       setFileList((prevFileList) =>
    //         prevFileList.filter((f) => f.uid !== file.uid),
    //       )
    //       // if it's the last file (and there's more than 1 document being uploaded), say that all documents have finished
    //       if (i >= files.length - 1 && files.length > 1) {
    //         message.info(
    //           `All ${files.length} uploaded chatbot documents have finished processing`,
    //           3.5,
    //         )
    //       }
    //     }
    //     // queue up the next file (which is technically recursive, I guess)
    //     if (i < files.length - 1) {
    //       uploadNextFile(i + 1, files)
    //     }
    //   },
    //   {
    //     successMsg: `${file?.name || 'A file'} was uploaded and processed!`,
    //     errorMsg: `Failed to upload/process ${file?.name || 'a file'}`,
    //     appendApiError: true,
    //     successDuration: 3500,
    //   },
    // )
  }

  const uploadFiles = async (files: RcFile[]) => {
    const errorDuringUploadObject = { value: null } // object that we pass by reference to stop the modal from closing if any of the uploads fail
    await uploadNextFile(0, files, errorDuringUploadObject)
    if (!errorDuringUploadObject.value) {
      const numFilesProcessed = fileList.filter(
        (f) => f.status !== 'done',
      ).length
      message.info(
        `${numFilesProcessed === 1 ? 'The document has' : `All ${numFilesProcessed} documents have`} been queued for processing. You will be notified upon completion. It is safe to close this tab.`,
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
          fileList.every((f) => f.status === 'done') && documentType === 'FILE',
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
                  fileList={fileList}
                  onChange={(info) => {
                    setFileList(info.fileList)
                  }}
                  onRemove={(file) => {
                    const index = fileList.indexOf(file)
                    const newFileList = fileList.slice()
                    newFileList.splice(index, 1)
                    setFileList(newFileList)
                  }}
                  maxCount={10}
                  beforeUpload={(file) => {
                    console.log('new file added', file)
                    // setFileList([...fileList, { ...file, status: 'adding' }]);
                    return false
                  }}
                  showUploadList={{
                    extra: ({ size = 0 }) => (
                      <span className="ml-1 text-zinc-400">
                        ({(size / 1024 / 1024).toFixed(2)}MB)
                      </span>
                    ),
                  }}
                  iconRender={(file) => {
                    if (file.status === 'done') {
                      return <CheckCircleFilled style={{ color: '#16a34a' }} />
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
