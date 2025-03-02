'use client'

import { ReactElement } from 'react'
import { Modal, Input, Form, message } from 'antd'
import TextArea from 'antd/es/input/TextArea'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { SourceDocument } from '@koh/common'

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
  chatbotToken: string
}

const EditDocumentChunkModal: React.FC<EditDocumentChunkModalProps> = ({
  editingRecord,
  open,
  courseId,
  onSuccessfulUpdate,
  onCancel,
  chatbotToken,
}): ReactElement => {
  const [form] = Form.useForm()

  const onFinish = async (values: FormValues) => {
    try {
      const response = await fetch(
        `/chat/${courseId}/${editingRecord.id}/documentChunk`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            HMS_API_TOKEN: chatbotToken,
          },
          body: JSON.stringify({
            documentText: values.content,
            metadata: {
              name: values.documentName,
              source: values.source,
            },
          }),
        },
      )

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const updatedDoc = await response.json()
      onSuccessfulUpdate(updatedDoc)
      message.success('Document updated successfully.')
    } catch (e) {
      const errorMessage = getErrorMessage(e)
      message.error('Failed to update document: ' + errorMessage)
    }
  }

  return (
    <Modal
      open={open}
      title="Edit Document Chunk"
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
        rules={[{ required: true, message: 'Please input the document name!' }]}
      >
        <Input />
      </Form.Item>
      <Form.Item label="Content" name="content">
        <TextArea autoSize={{ minRows: 3, maxRows: 10 }} />
      </Form.Item>
      <Form.Item
        label="Source URL"
        name="source"
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
