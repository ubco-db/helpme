import { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  Button,
  Checkbox,
  Collapse,
  Select,
  message,
  Tooltip,
  Space,
} from 'antd'
import axios from 'axios'
import { User } from '@koh/common'
import { ChatbotQuestion, SourceDocument } from '../page'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'

interface FormValues {
  question: string
  answer: string
  verified: boolean
  suggested: boolean
  sourceDocuments: SourceDocument[]
  selectedDocuments: {
    docId: string
    pageNumbersString: string
  }[]
}

interface EditChatbotQuestionModalProps {
  open: boolean
  editingRecord: ChatbotQuestion
  onCancel: () => void
  onSuccessfulUpdate: () => void
  cid: number
  profile: User
}

const EditChatbotQuestionModal: React.FC<EditChatbotQuestionModalProps> = ({
  open,
  editingRecord,
  onCancel,
  onSuccessfulUpdate,
  cid,
  profile,
}) => {
  const [form] = Form.useForm()
  const [successfulQAInsert, setSuccessfulQAInsert] = useState(false)
  const chatbotToken = profile.chat_token.token

  // stores all related documents in db
  const [existingDocuments, setExistingDocuments] = useState<SourceDocument[]>(
    [],
  )
  // stores selected documents for the question
  const [selectedDocuments, setSelectedDocuments] = useState<SourceDocument[]>(
    [],
  )

  useEffect(() => {
    if (open) {
      fetch(`/chat/${cid}/aggregateDocuments`, {
        headers: { HMS_API_TOKEN: chatbotToken },
      })
        .then((res) => res.json())
        .then((json) => {
          // Convert the json to the expected format
          const formattedDocuments = json.map((doc: SourceDocument) => ({
            docId: doc.id,
            docName: doc.pageContent,
            sourceLink: doc.metadata?.source,
            pageNumbers: [],
          }))
          setExistingDocuments(formattedDocuments)
        })
    }
  }, [cid, open, chatbotToken])

  const handleOkInsert = async () => {
    const values = await form.validateFields()
    await axios
      .post(
        `/chat/${cid}/documentChunk`,
        {
          documentText: values.question + '\n' + values.answer,
          metadata: {
            name: 'inserted Q&A',
            type: 'inserted_question',
            id: editingRecord.id,
            courseId: cid,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            HMS_API_TOKEN: chatbotToken,
          },
        },
      )
      .then(async (res) => {
        if (res.status !== 200 && res.status !== 201) {
          const errorMessage = getErrorMessage(res)
          message.error('Insert unsuccessful:' + errorMessage)
        } else {
          await axios
            .patch(
              `/chat/${cid}/question`,
              {
                id: editingRecord.id,
                inserted: true,
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  HMS_API_TOKEN: chatbotToken,
                },
              },
            )
            .then((res) => {
              if (res.status !== 200 && res.status !== 201) {
                const errorMessage = getErrorMessage(res)
                message.error('Insert unsuccessful:' + errorMessage)
              } else {
                message.success(
                  'Document inserted successfully. You can now cancel or save the changes you made to the Q&A',
                  6,
                )
                setSuccessfulQAInsert(true)
              }
            })
            .catch((e) => {
              const errorMessage = getErrorMessage(e)
              message.error('Failed to insert document:' + errorMessage)
            })
        }
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to insert document:' + errorMessage)
      })
  }
  const confirmInsert = () => {
    Modal.confirm({
      title:
        'Are you sure you want to insert this Question and Answer into the DocumentStore?',
      content:
        'This will treat this question and answer as a source that the AI can then reference and cite in future questions. \nOnce inserted, this action cannot be undone.',
      onOk: handleOkInsert,
    })
  }

  const onFinish = async (values: FormValues) => {
    values.sourceDocuments.forEach((doc) => {
      // Convert string to array of numbers, trimming spaces and ignoring empty entries
      if (doc.pageNumbersString) {
        doc.pageNumbers = doc.pageNumbersString
          .split(',')
          .map((page) => page.trim())
          .filter((page) => page !== '')
          .map((page) => parseInt(page, 10))
      }
    })

    const sourceDocumentsWithSelected = [
      ...(values.sourceDocuments || []),
      ...selectedDocuments,
    ]

    const valuesWithId = {
      ...values,
      id: editingRecord.id,
      sourceDocuments: sourceDocumentsWithSelected,
    }

    try {
      const response = await fetch(`/chat/${cid}/question`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: chatbotToken,
        },
        body: JSON.stringify(valuesWithId),
      })
      if (!response.ok) {
        const errorMessage = getErrorMessage(response)
        console.error('Save unsuccessful:' + errorMessage)
      } else {
        message.success('Question updated successfully')
        onSuccessfulUpdate()
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      console.error('Error saving question:' + errorMessage)
    }
  }

  return (
    <Modal
      open={open}
      title="Edit Chatbot Question"
      okText="Save Changes"
      cancelText="Cancel"
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
      }}
      cancelButtonProps={{
        danger: true,
      }}
      width={800}
      onCancel={onCancel}
      footer={(_, { OkBtn, CancelBtn }) => (
        <div className={`flex justify-end gap-2`}>
          <CancelBtn />
          <Tooltip
            title={
              editingRecord.inserted || successfulQAInsert
                ? 'This question and answer has already been inserted as a new source document'
                : "This will treat this question and answer as a source that the AI can then reference and cite in future questions (a new document chunk). The question's source documents are ignored"
            }
          >
            <Button
              type="default"
              onClick={confirmInsert}
              disabled={editingRecord.inserted || successfulQAInsert}
            >
              Insert Q&A into DocumentStore
            </Button>
          </Tooltip>
          <OkBtn />
        </div>
      )}
      destroyOnClose
      modalRender={(dom) => (
        <Form
          layout="vertical"
          form={form}
          name="form_in_modal"
          initialValues={{
            answer: editingRecord.answer,
            question: editingRecord.question,
            verified: editingRecord.verified,
            suggested: editingRecord.suggested,
            sourceDocuments: editingRecord.sourceDocuments,
          }}
          clearOnDestroy
          onFinish={(values) => onFinish(values)}
        >
          {dom}
        </Form>
      )}
    >
      <Form.Item
        name="question"
        label="Question"
        rules={[{ required: true, message: 'Please input the question text' }]}
      >
        <Input.TextArea autoSize={{ minRows: 1, maxRows: 5 }} />
      </Form.Item>
      <Form.Item
        name="answer"
        label="Answer"
        rules={[{ required: true, message: 'Please input the answer text' }]}
      >
        <Input.TextArea autoSize={{ minRows: 1, maxRows: 8 }} />
      </Form.Item>
      <Form.Item
        label="Mark Q&A as Verified by Human"
        layout="horizontal"
        name="verified"
        valuePropName="checked"
      >
        <Checkbox />
      </Form.Item>
      <Form.Item
        label="Mark Q&A as Suggested"
        layout="horizontal"
        name="suggested"
        valuePropName="checked"
      >
        <Checkbox />
      </Form.Item>
      <span className="text-lg font-bold">Source Documents</span>
      <Form.List name="sourceDocuments">
        {(fields, { add, remove }) => (
          <Collapse
            size="small"
            items={fields.map((field, index) => ({
              label:
                (
                  form.getFieldValue([
                    'sourceDocuments',
                    field.name,
                    'docName',
                  ]) || `Document ${index + 1}`
                ).substring(0, 100) +
                ((
                  form.getFieldValue([
                    'sourceDocuments',
                    field.name,
                    'docName',
                  ]) || ''
                ).length > 100
                  ? '...'
                  : ''),
              key: field.key,
              children: (
                <div className="mb-2">
                  <Form.Item
                    name={[field.name, 'docName']}
                    rules={[
                      {
                        required: true,
                        message: 'Please input the document name',
                      },
                    ]}
                    label="Document Name"
                  >
                    <Input placeholder="Document Name" />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'sourceLink']}
                    label="Source Link"
                  >
                    <Input placeholder="Source Link" />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'pageNumbers']}
                    label="Page Numbers (comma separated)"
                  >
                    <Input placeholder="1,2,3" />
                  </Form.Item>
                  <Button onClick={() => remove(field.name)} className="mb-2">
                    Remove Document
                  </Button>
                </div>
              ),
            }))}
          />
        )}
      </Form.List>
      <span className="text-md font-bold">Add New Source Document</span>
      <Form.List name="selectedDocuments">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => {
              // Get the IDs of the documents that have already been selected
              const selectedDocIds = fields.map((field) => field.name.docId)

              // Filter the existing documents to exclude the selected ones
              const availableDocuments = existingDocuments.filter(
                (doc) => !selectedDocIds.includes(doc.docId),
              )

              return (
                <Space key={key} className="flex" align="center">
                  <Form.Item
                    {...restField}
                    name={[name, 'docId']}
                    rules={[{ required: true, message: 'Select a document' }]}
                  >
                    <Select
                      className="w-3/4"
                      placeholder="Select a document to add"
                      options={availableDocuments.map((doc) => ({
                        label: doc.docName,
                        value: doc.docId,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    label="Page Numbers (comma separated e.g. 1,2,3)"
                    {...restField}
                    name={[name, 'pageNumbersString']}
                    rules={[
                      {
                        validator: (_: any, value: string) => {
                          const regex = /^(\d+)(,\d+)*$/
                          if (value && !regex.test(value)) {
                            return Promise.reject(
                              new Error(
                                'Page numbers must be in format 1,2,3,...',
                              ),
                            )
                          }
                          return Promise.resolve()
                        },
                      },
                    ]}
                  >
                    <Input className="w-1/4" type="text" placeholder="1,2,3" />
                  </Form.Item>
                  <MinusCircleOutlined onClick={() => remove(name)} />
                </Space>
              )
            })}
            <Form.Item>
              <Button
                type="dashed"
                onClick={() => add()}
                block
                icon={<PlusOutlined />}
              >
                Add Document
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>
      {selectedDocuments.map((doc) => (
        <div key={doc.docId}>
          <span className="font-bold">{doc.docName}</span>
        </div>
      ))}
    </Modal>
  )
}

export default EditChatbotQuestionModal
