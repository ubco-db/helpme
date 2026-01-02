import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Switch,
  Tabs,
  Tooltip,
} from 'antd'
import {
  ChatbotDocumentResponse,
  ChatbotQuestionResponse,
  CreateDocumentChunkBody,
  CreateQuestionBody,
  DocumentType,
  HelpMeChatbotQuestionResponse,
  UpdateQuestionBody,
} from '@koh/common'
import { getErrorMessage } from '@/app/utils/generalUtils'
import {
  DeleteOutlined,
  ExclamationCircleFilled,
  FileAddOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import MarkdownGuideTooltipBody from './MarkdownGuideTooltipBody'
import { API } from '@/app/api'
import ChatbotSelectCitations from '../../components/ChatbotSelectCitations'

interface FormValues {
  question: string
  answer: string
  verified: boolean
  suggested: boolean
  sourceDocumentIds: string[]
}

interface UpsertChatbotQuestionModalProps {
  courseId: number
  open: boolean
  editingRecord?: Omit<HelpMeChatbotQuestionResponse, 'chatbotQuestion'> & {
    chatbotQuestion: ChatbotQuestionResponse
  }
  onCancel: () => void
  onUpsert: () => void
  deleteQuestion: (id: string) => void
}

const UpsertChatbotQuestionModal: React.FC<UpsertChatbotQuestionModalProps> = ({
  courseId,
  open,
  editingRecord,
  onCancel,
  onUpsert,
  deleteQuestion,
}) => {
  const [form] = Form.useForm()
  const [saveLoading, setSaveLoading] = useState(false)

  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([])
  const [baseDocuments, setBaseDocuments] = useState<ChatbotDocumentResponse[]>(
    [],
  )

  useEffect(() => {
    if (editingRecord && editingRecord.chatbotQuestion.citations) {
      setSelectedDocuments(
        editingRecord.chatbotQuestion.citations.map((c) => c.documentId),
      )
      setBaseDocuments(
        editingRecord.chatbotQuestion.citations.map((c) => c.document),
      )
    } else {
      setSelectedDocuments([])
      setBaseDocuments([])
    }
  }, [editingRecord, editingRecord?.chatbotQuestion.citations])

  useEffect(() => {
    if (!open) {
      form.resetFields()
      setSelectedDocuments([])
      setBaseDocuments([])
    }
  }, [form, open])

  useEffect(() => {
    if (editingRecord) {
      form.setFieldsValue({
        answer: editingRecord.chatbotQuestion.answer,
        question: editingRecord.chatbotQuestion.question,
        verified: editingRecord.chatbotQuestion.verified,
        suggested: editingRecord.chatbotQuestion.suggested,
      })
    } else {
      form.resetFields()
    }
  }, [editingRecord, form])

  const [successfulQAInsert, setSuccessfulQAInsert] = useState(false)
  // reset successfulQAInsert when the modal is closed
  useEffect(() => {
    if (!open) {
      setSuccessfulQAInsert(false)
    }
  }, [open])

  const handleInsert = async () => {
    if (!editingRecord) return

    const values = await form.validateFields()
    setSaveLoading(true)

    const newChunk: CreateDocumentChunkBody = {
      content: values.question + '\nAnswer:' + values.answer,
      title: 'inserted Q&A',
      type: DocumentType.InsertedQuestion,
      questionId: editingRecord.vectorStoreId,
    }

    await API.chatbot.staffOnly
      .addDocumentChunk(courseId, newChunk)
      .then(async (docChunks: ChatbotDocumentResponse[]) => {
        message.success(
          `Document${docChunks.length > 1 ? 's' : ''} inserted successfully. You can now cancel or save the changes you made to the Q&A`,
          6,
        )
        if (docChunks.length > 1)
          message.info(
            `Question text was too large! Inserted document was split into ${docChunks.length} document chunks.`,
            6,
          )
        setSuccessfulQAInsert(true)
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to add document: ' + errorMessage)
      })
      .finally(() => {
        setSaveLoading(false)
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
          <p>The question&apos;s document citations are ignored.</p>
          <p>Once inserted, this action cannot be undone.</p>
        </div>
      ),
      onOk: handleInsert,
      width: 600,
      type: 'info',
      icon: <ExclamationCircleFilled className="text-blue-500" />,
      okText: 'Insert',
    })
  }

  const onFinish = async (values: FormValues) => {
    const params: UpdateQuestionBody = {
      ...values,
      sourceDocumentIds: values.sourceDocumentIds || [],
    }

    const thenFx = () => {
      message.success(
        `Question ${editingRecord != undefined ? 'updated' : 'created'} successfully`,
      )
      onUpsert()
    }
    const errFx = (e: any) => {
      const errorMessage = getErrorMessage(e)
      message.error(
        `Error ${editingRecord != undefined ? 'updating' : 'creating'} question:` +
          errorMessage,
      )
    }

    if (editingRecord != undefined) {
      return await API.chatbot.staffOnly
        .updateQuestion(courseId, editingRecord.vectorStoreId, params)
        .then(thenFx)
        .catch(errFx)
    } else {
      return await API.chatbot.staffOnly
        .addQuestion(courseId, params as CreateQuestionBody)
        .then(thenFx)
        .catch(errFx)
    }
  }

  const actionsTab = useMemo(() => {
    if (editingRecord == undefined) return undefined
    return {
      key: 'actions',
      label: 'Actions',
      children: (
        <>
          <Form.Item
            label="Insert Q&A into Chatbot Knowledge Base"
            layout="horizontal"
            tooltip={
              <div className="flex flex-col gap-y-2">
                <p>
                  This will treat this question and answer as a source that the
                  AI can then reference and cite in future questions (a new
                  document chunk).
                </p>
              </div>
            }
          >
            <Tooltip
              title={
                (editingRecord.chatbotQuestion.insertedDocuments?.length ?? 0) >
                  0 || successfulQAInsert
                  ? 'This question and answer has already been inserted as a new document chunk'
                  : ''
              }
            >
              <Button
                type="default"
                onClick={confirmInsert}
                disabled={
                  (editingRecord.chatbotQuestion.insertedDocuments?.length ??
                    0) > 0 || successfulQAInsert
                }
                icon={<FileAddOutlined />}
              >
                Insert
              </Button>
            </Tooltip>
          </Form.Item>
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
                  deleteQuestion(editingRecord.vectorStoreId)
                  onCancel()
                },
              })
            }}
          >
            {' '}
            Delete{' '}
          </Button>
        </>
      ),
    }
  }, [
    confirmInsert,
    deleteQuestion,
    editingRecord,
    onCancel,
    successfulQAInsert,
  ])

  return (
    <Modal
      centered
      open={open}
      title={`${editingRecord != undefined ? 'Edit' : 'Create'} Chatbot Question`}
      okText="Save Changes"
      cancelText="Cancel"
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
        loading: saveLoading,
        onClick: () => form.validateFields().then(onFinish).catch(),
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
        <div className={`flex flex-wrap justify-end gap-2 md:gap-3`}>
          <CancelBtn />
          <OkBtn />
        </div>
      )}
      destroyOnHidden
    >
      <Form layout="vertical" form={form} name="form_in_modal" clearOnDestroy>
        <Tabs
          destroyOnHidden={false}
          items={[
            {
              key: 'properties',
              label: (
                <span>
                  Properties
                  <Tooltip title="These are the main properties of the question, e.g., the question, the answer itself, and whether it is suggested.">
                    <QuestionCircleOutlined className="ml-1 text-gray-400" />
                  </Tooltip>
                </span>
              ),
              children: (
                <>
                  <Form.Item
                    name="question"
                    label="Question"
                    rules={[
                      {
                        required: true,
                        message: 'Please input the question text',
                      },
                    ]}
                  >
                    <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} />
                  </Form.Item>
                  <Form.Item
                    name="answer"
                    tooltip={{
                      title: <MarkdownGuideTooltipBody />,
                      classNames: {
                        body: 'min-w-[420px]',
                      },
                    }}
                    label="Answer"
                    rules={[
                      {
                        required: true,
                        message: 'Please input the answer text',
                      },
                    ]}
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
                          Answers that are marked verified will appear with a
                          green &apos;verified&apos; checkmark to students.
                        </p>
                        <p>
                          Incentive: if a future student asks a question that is
                          similar to this one, they will get this answer and get
                          reassurance that it was human verified.
                        </p>
                      </div>
                    }
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    label="Mark Q&A as Suggested"
                    layout="horizontal"
                    name="suggested"
                    valuePropName="checked"
                    tooltip={
                      <div className="flex flex-col gap-y-2">
                        <p>
                          When a student starts a new interaction with the
                          chatbot, any questions marked as &apos;suggested&apos;
                          will appear for them to choose if they wish. Upon
                          clicking a suggested question, they instantly get the
                          answer that you set here.
                        </p>
                        <p>
                          Incentive: If someone asks a question you think others
                          might ask and are happy with the answer, you can mark
                          it as suggested.
                        </p>
                      </div>
                    }
                  >
                    <Switch />
                  </Form.Item>
                </>
              ),
            },
            {
              key: 'citations',
              label: (
                <span>
                  Document Citations
                  <Tooltip title="These are the 'citations' that will be displayed underneath the chatbot answer. Adjusting these does not alter the AI answer itself as it is not re-generated.">
                    <QuestionCircleOutlined className="ml-1 text-gray-400" />
                  </Tooltip>
                </span>
              ),
              children: (
                <ChatbotSelectCitations
                  courseId={courseId}
                  selectedDocuments={selectedDocuments}
                  setSelectedDocuments={setSelectedDocuments}
                  preloadedDocuments={baseDocuments}
                />
              ),
            },
            ...(actionsTab != undefined ? [actionsTab] : []),
          ]}
        ></Tabs>
      </Form>
    </Modal>
  )
}

export default UpsertChatbotQuestionModal
