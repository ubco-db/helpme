import { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  Button,
  Checkbox,
  message,
  Tooltip,
  Collapse,
} from 'antd'
import axios from 'axios'
import { User } from '@koh/common'
import { ChatbotQuestion, SourceDocument } from '../page'
import { getErrorMessage } from '@/app/utils/generalUtils'
import {
  CloseOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  FileAddOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'

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
  deleteQuestion: (id: string) => void
}

const EditChatbotQuestionModal: React.FC<EditChatbotQuestionModalProps> = ({
  open,
  editingRecord,
  onCancel,
  onSuccessfulUpdate,
  cid,
  profile,
  deleteQuestion,
}) => {
  const [form] = Form.useForm()
  const chatbotToken = profile.chat_token.token

  const [successfulQAInsert, setSuccessfulQAInsert] = useState(false)
  // reset successfulQAInsert when the modal is closed
  useEffect(() => {
    if (!open) {
      setSuccessfulQAInsert(false)
    }
  }, [open])

  const handleOkInsert = async () => {
    const values = await form.validateFields()
    await axios
      .post(
        `/chat/${cid}/documentChunk`,
        {
          documentText: values.question + '\nAnswer:' + values.answer,
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
              throw e
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
        'Are you sure you want to insert this Question and Answer as a new Chatbot Document Chunk?',
      content: (
        <div className="flex flex-col gap-y-2">
          <p>
            This will treat this question and answer as a source that the AI can
            then reference and cite in future questions (a new document chunk).
          </p>
          <p>
            The question and answer text will be whatever you have in the fields
            right now (i.e. you do not have to click &quot;Save Changes&quot;
            first).
          </p>
          <p>The question&apos;s source documents are ignored.</p>
          <p>Once inserted, this action cannot be undone.</p>
        </div>
      ),
      onOk: handleOkInsert,
      width: 600,
      type: 'info',
      icon: <ExclamationCircleFilled className="text-blue-500" />,
      okText: 'Insert',
    })
  }

  const onFinish = async (values: FormValues) => {
    if (values.sourceDocuments) {
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
    }

    const valuesWithId = {
      ...values,
      id: editingRecord.id,
      sourceDocuments: values.sourceDocuments || [],
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
        message.error('Save unsuccessful:' + errorMessage)
      } else {
        message.success('Question updated successfully')
        onSuccessfulUpdate()
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      message.error('Error saving question:' + errorMessage)
    }
  }

  // console.log(editingRecord)
  console.log(form.getFieldsValue())

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
      width={{
        xs: '90%',
        sm: '85%',
        md: '75%',
        lg: '65%',
        xl: '55%',
        xxl: '45%',
      }}
      onCancel={onCancel}
      footer={(_, { OkBtn, CancelBtn }) => (
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => {
              Modal.confirm({
                title: 'Are you sure you want to delete this question?',
                content: 'This action cannot be undone.',
                okText: 'Yes',
                okType: 'danger',
                cancelText: 'No',
                onOk() {
                  deleteQuestion(editingRecord.id)
                },
              })
            }}
          >
            {' '}
            Delete{' '}
          </Button>
          <div className={`flex flex-wrap justify-end gap-2 md:gap-3`}>
            <CancelBtn />
            <OkBtn />
          </div>
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
        tooltip={
          <div className="flex flex-col gap-y-2">
            <p>
              Answers that are marked verified will appear with a green
              &apos;verified&apos; checkmark to students.
            </p>
            <p>
              Incentive: if a future student asks a question that is similar to
              this one, they will get this answer and get reassurance that it
              was human verified.
            </p>
          </div>
        }
      >
        <Checkbox />
      </Form.Item>
      <Form.Item
        label="Mark Q&A as Suggested"
        layout="horizontal"
        name="suggested"
        valuePropName="checked"
        tooltip={
          <div className="flex flex-col gap-y-2">
            <p>
              When a student starts a new interaction with the chatbot, any
              questions marked as &apos;suggested&apos; will appear for them to
              choose if they wish. Upon them clicking a suggested question, they
              instantly get the answer that you set here.
            </p>
            <p>
              Incentive: If someone asks a question you think others might ask
              and are happy with the answer, you can mark it as suggested.
            </p>
          </div>
        }
      >
        <Checkbox />
      </Form.Item>
      <Form.Item
        label="Insert Q&A as new Chatbot Document"
        layout="horizontal"
        tooltip={
          <div className="flex flex-col gap-y-2">
            <p>
              This will treat this question and answer as a source that the AI
              can then reference and cite in future questions (a new document
              chunk).
            </p>
          </div>
        }
      >
        <Tooltip
          title={
            editingRecord.inserted || successfulQAInsert
              ? 'This question and answer has already been inserted as a new source document'
              : ''
          }
        >
          <Button
            type="default"
            onClick={confirmInsert}
            disabled={editingRecord.inserted || successfulQAInsert}
            icon={<FileAddOutlined />}
          >
            Insert
          </Button>
        </Tooltip>
      </Form.Item>
      <h3 className="mb-1 text-base font-semibold">
        Source Documents
        <Tooltip title="These source documents will be displayed underneath the chatbot answer. Note that modifying these fields does NOT update the original source document, and it only modifies how the source looks for students.">
          <QuestionCircleOutlined className="ml-1 text-gray-400" />
        </Tooltip>
      </h3>
      {editingRecord.sourceDocuments &&
        editingRecord.sourceDocuments.length > 0 && (
          <Form.List name="sourceDocuments">
            {(fields, { add, remove }) => (
              <div className="flex flex-col items-center justify-center gap-y-2">
                <Collapse
                  size="small"
                  className="w-full"
                  items={fields.map(({ key, name, ...restField }) => ({
                    key: key,
                    label: (
                      <div className="flex items-center justify-between">
                        <div>
                          {form.getFieldValue([
                            'sourceDocuments',
                            name,
                            'docName',
                          ]) || `Document ${key + 1}`}
                        </div>
                        <Button
                          icon={<CloseOutlined />}
                          onClick={() => remove(name)}
                          size="small"
                        >
                          Remove
                        </Button>
                      </div>
                    ),
                    children: (
                      <>
                        <Form.Item
                          {...restField}
                          name={[name, 'docName']}
                          rules={[
                            {
                              required: true,
                              message: 'Please provide a document name.',
                            },
                          ]}
                          label="Display Document Name"
                          tooltip="Display document name for students for this question"
                        >
                          <Input placeholder="Document Name" />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          name={[name, 'sourceLink']}
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
                          label="Source Link"
                          tooltip="When a student clicks on the citation, they will be redirected to this link"
                        >
                          <Input placeholder="Source Link" />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          name={[name, 'pageNumbers']}
                          rules={[
                            {
                              required: true,
                              message: 'Please provide page numbers.',
                            },
                            {
                              validator: (_, value) => {
                                if (value && typeof value === 'string') {
                                  const pageNumbersArray = value.split(
                                    ',',
                                  ) as string[]
                                  if (
                                    !pageNumbersArray ||
                                    pageNumbersArray.length === 0
                                  ) {
                                    return Promise.reject(
                                      'Please provide page numbers.',
                                    )
                                  }
                                  const invalidPageNumbers = pageNumbersArray
                                    .map((page) => page.trim())
                                    .filter((page) => page !== '')
                                    .map((page) => parseInt(page, 10))
                                    .filter((page) => isNaN(page))
                                  if (invalidPageNumbers.length > 0) {
                                    return Promise.reject(
                                      'Please provide valid page numbers (e.g. 1,2,3).',
                                    )
                                  }
                                }
                                return Promise.resolve()
                              },
                            },
                          ]}
                          tooltip="These page numbers are just to display to the student what page numbers the information came from."
                          label="Display Page Numbers (comma separated)"
                        >
                          <Input placeholder="1,2,3" />
                        </Form.Item>
                      </>
                    ),
                  }))}
                />
                <Button
                  type="dashed"
                  onClick={() => add()}
                  className="mt-2 w-1/3"
                >
                  Add Source Document
                </Button>
              </div>
            )}
          </Form.List>
        )}
    </Modal>
  )
}

export default EditChatbotQuestionModal
