import {
  ChatbotDocumentResponse,
  CreateDocumentChunkBody,
  DocumentType,
  UpdateDocumentChunkBody,
} from '@koh/common'
import { Form, Input, InputNumber, message, Modal, Switch, Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import { useCallback, useEffect, useMemo } from 'react'

type UpsertDocumentChunkModalProps = {
  open: boolean
  editingChunk?: ChatbotDocumentResponse
  addDocument: (props: CreateDocumentChunkBody) => void
  updateDocument: (id: string, props: UpdateDocumentChunkBody) => void
  onCancel: () => void
}

const UpsertDocumentChunkModal: React.FC<UpsertDocumentChunkModalProps> = ({
  open,
  editingChunk,
  addDocument,
  updateDocument,
  onCancel,
}) => {
  const [form] = Form.useForm<UpdateDocumentChunkBody>()

  const initialValues = useMemo(() => {
    if (editingChunk != undefined) {
      const vals: any = {}
      Object.entries(editingChunk)
        .filter(([key]) =>
          [
            'content',
            'type',
            'disabled',
            'title',
            'source',
            'lines',
            'pageNumber',
          ].includes(key),
        )
        .map(([k, v]) => (vals[k] = v))
      return vals
    } else {
      return {
        type: DocumentType.Inserted,
        title: 'Manually Inserted Information',
        disabled: false,
      }
    }
  }, [editingChunk])

  const resetForm = useCallback(() => {
    form.resetFields()
    form.setFieldsValue(initialValues)
  }, [form, initialValues])

  useEffect(() => {
    resetForm()
  }, [initialValues, resetForm])

  return (
    <>
      <style>{`
        .ant-form-item .ant-form-item-label > label {
          width: 100%;
        }
      `}</style>
      <Modal
        open={open}
        centered
        title={
          <div className="flex items-center justify-start gap-x-3">
            <div>
              {editingChunk != undefined ? 'Edit' : 'Create'} Document Chunk
            </div>
          </div>
        }
        okText={editingChunk != undefined ? 'Save Changes' : 'Create'}
        cancelText={'Cancel'}
        okButtonProps={{
          autoFocus: true,
          htmlType: 'submit',
        }}
        onOk={() => {
          form
            .validateFields()
            .then((values) => {
              if (editingChunk != undefined) {
                updateDocument(editingChunk.id, values)
              } else {
                addDocument(values as any)
              }
            })
            .catch((err) => message.error(err))
        }}
        onCancel={() => {
          onCancel()
          resetForm()
        }}
        destroyOnHidden
      >
        <Form<any>
          form={form}
          initialValues={initialValues}
          layout={'vertical'}
        >
          <div className="flex flex-col gap-1">
            <Form.Item hidden name="type" />
            <Form.Item
              label={
                <div className={'flex w-full justify-between'}>
                  <Tooltip title="This title will appear in the citation when the document is pulled to augment the chatbot response.">
                    Document Title <InfoCircleOutlined />
                  </Tooltip>
                </div>
              }
              name="title"
              rules={[
                {
                  required: true,
                  message: 'Please input the document title!',
                },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label={
                <Tooltip title="This is the information that will be retrieved for augmenting the chatbot response.">
                  Document Content <InfoCircleOutlined />
                </Tooltip>
              }
              name="content"
              rules={[
                {
                  required: true,
                  message: 'Please input the document content!',
                },
              ]}
            >
              <Input.TextArea />
            </Form.Item>
            <Form.Item
              label={
                <Tooltip title="When a student clicks on the citation, a new tab or window will be opened to this link.">
                  Source <InfoCircleOutlined />
                </Tooltip>
              }
              name="source"
              rules={[
                {
                  pattern: new RegExp(/^(https?:\/\/\S+|\/\S*|\.{1,2}\/\S*)$/),
                  message: 'Please enter a valid URL or relative path.',
                },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label={
                <Tooltip title="When the document is cited, this will appear in the citation. If applicable, it may be auto-navigated to when the source link is clicked.">
                  Page Number <InfoCircleOutlined />
                </Tooltip>
              }
              name="pageNumber"
              rules={[
                {
                  type: 'number',
                  message: 'Please enter a valid page number',
                  min: 0,
                },
              ]}
            >
              <InputNumber />
            </Form.Item>
            <Form.Item
              name={'disabled'}
              label={
                <Tooltip title="This will enable or disable the document from being cited by the chatbot.">
                  Disabled <InfoCircleOutlined />
                </Tooltip>
              }
            >
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  )
}

export default UpsertDocumentChunkModal
