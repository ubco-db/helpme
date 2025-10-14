import {
  ChatbotDocumentAggregateResponse,
  UpdateDocumentAggregateBody,
} from '@koh/common'
import { Form, Input, message, Modal, Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import { useCallback, useEffect, useMemo, useState } from 'react'

type EditChatbotDocumentModalProps = {
  editingDocument: ChatbotDocumentAggregateResponse
  updateDocument: (id: string, props: UpdateDocumentAggregateBody) => void
  onCancel: () => void
}

const EditingChatbotDocumentModal: React.FC<EditChatbotDocumentModalProps> = ({
  editingDocument,
  updateDocument,
  onCancel,
}) => {
  const [form] = Form.useForm<UpdateDocumentAggregateBody>()
  const [canUpdateSource, setCanUpdateSource] = useState(true)

  const initialValues = useMemo(() => {
    const vals: Record<string, any> = {}
    Object.entries(editingDocument)
      .filter(([key]) => ['title', 'source'].includes(key))
      .map(([k, v]) => (vals[k] = v))
    if (vals['source'] && vals['source'].startsWith('/')) {
      setCanUpdateSource(false)
    }
    return vals
  }, [editingDocument])

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
        open={editingDocument != undefined}
        centered
        title={
          <div className="flex items-center justify-start gap-x-3">
            <div>Edit Document</div>
          </div>
        }
        okText={'Save Changes'}
        cancelText={'Cancel'}
        okButtonProps={{
          autoFocus: true,
          htmlType: 'submit',
        }}
        onOk={() => {
          form
            .validateFields()
            .then((values) => updateDocument(editingDocument.id, values))
            .catch((err) => message.error(err))
        }}
        onCancel={() => {
          onCancel()
          resetForm()
        }}
        destroyOnHidden
      >
        <Form<UpdateDocumentAggregateBody>
          form={form}
          initialValues={initialValues}
          layout={'vertical'}
        >
          <div className="flex flex-col gap-1">
            <Form.Item
              label={
                <div className={'flex w-full justify-between'}>
                  <Tooltip
                    title={
                      'This is the title for the document. Updates apply to all chunks that have not had their title customized.'
                    }
                  >
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
            <Tooltip
              title={
                !canUpdateSource
                  ? 'This document points to an upload to the HelpMe system. Its source cannot be updated for this reason.'
                  : undefined
              }
            >
              <Form.Item
                label={
                  <Tooltip
                    title={
                      'This is the source link for the document. Updates apply to all chunks that have not had their source link customized.'
                    }
                  >
                    Source <InfoCircleOutlined />
                  </Tooltip>
                }
                required={false}
                name="source"
                rules={[
                  {
                    pattern: new RegExp(
                      /^(https?:\/\/\S+|\/\S*|\.{1,2}\/\S*)$/,
                    ),
                    message: 'Please enter a valid URL or relative path.',
                  },
                ]}
              >
                <Input disabled={!canUpdateSource} />
              </Form.Item>
            </Tooltip>
          </div>
        </Form>
      </Modal>
    </>
  )
}

export default EditingChatbotDocumentModal
