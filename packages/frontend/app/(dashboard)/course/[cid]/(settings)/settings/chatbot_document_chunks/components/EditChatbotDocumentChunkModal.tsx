'use client'

import { ReactElement } from 'react'
import { Modal, Input, Form, message } from 'antd'
import TextArea from 'antd/es/input/TextArea'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { SourceDocument } from '@koh/common'
import { API } from '@/app/api'
import ChunkHelpTooltip from './ChunkHelpTooltip'

interface FormValues {
  documentName: string
  content: string
  source: string
}

interface EditDocumentChunkModalProps {
  editingRecord: SourceDocument
  open: boolean
  courseId: number
  onSuccessfulUpdate: (value: SourceDocument) => void
  onCancel: () => void
}

const EditDocumentChunkModal: React.FC<EditDocumentChunkModalProps> = ({
  editingRecord,
  open,
  courseId,
  onSuccessfulUpdate,
  onCancel,
}): ReactElement => {
  const [form] = Form.useForm()

  const onFinish = async (values: FormValues) => {
    await API.chatbot.staffOnly
      .updateDocumentChunk(courseId, editingRecord.id || '', {
        documentText: values.content,
        metadata: {
          name: values.documentName,
          source: values.source,
        },
      })
      .then((updatedDoc) => {
        onSuccessfulUpdate(updatedDoc)
        message.success('Document updated successfully.')
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to update document: ' + errorMessage)
      })
  }

  return (
    <Modal
      open={open}
      title={
        <div className="flex items-center justify-start gap-x-3">
          <div>Edit Document Chunk</div>
          <ChunkHelpTooltip />
        </div>
      }
      okText="Save Changes"
      cancelText="Cancel"
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
      }}
      onCancel={onCancel}
      width={800}
      destroyOnClose
      modalRender={(dom) => (
        <Form
          layout="vertical"
          form={form}
          name="form_in_modal"
          initialValues={{
            documentName: editingRecord.metadata?.name,
            content: editingRecord.pageContent,
            source: editingRecord.metadata?.source,
          }}
          clearOnDestroy
          onFinish={(values) => onFinish(values)}
        >
          {dom}
        </Form>
      )}
    >
      <Form.Item
        label="Document Name"
        name="documentName"
        tooltip={`This is the "name" of the document that this chunk came from `}
        rules={[{ required: true, message: 'Please input the document name' }]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Content"
        name="content"
        tooltip={`This is the text that was parsed during the document upload process. The Retrieval Augmented Generation (RAG) system searches through this content to find relevant information for the chatbot to use in its response.`}
      >
        <TextArea autoSize={{ minRows: 3, maxRows: 10 }} />
      </Form.Item>
      <Form.Item
        label="Source Link"
        name="source"
        tooltip="When a student clicks on the citation, they will be redirected to this link"
        rules={[
          {
            type: 'url',
            message: 'Please enter a valid URL',
          },
        ]}
      >
        <Input />
      </Form.Item>
    </Modal>
  )
}

export default EditDocumentChunkModal
