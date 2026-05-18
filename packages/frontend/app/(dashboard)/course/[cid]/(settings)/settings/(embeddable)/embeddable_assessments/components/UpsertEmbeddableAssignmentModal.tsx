import { Button, DatePicker, Divider, Form, Input, message, Modal, Tooltip } from 'antd'
import { SetStateAction, useCallback, useEffect, useMemo, useState } from 'react'
import { InfoCircleOutlined, PlusOutlined } from '@ant-design/icons'
import {
  EmbeddableAssignment,
  EmbeddableQuestion,
  UpsertEmbeddableAssignmentParams,
  UpsertEmbeddableAssignmentQuestionParams,
  UpsertEmbeddableQuestionParams,
} from '@koh/common'
import { pick } from 'lodash'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import dayjs from 'dayjs'
import SelectEmbeddableQuestionModal
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/SelectEmbeddableQuestionModal'
import UpsertEmbeddableQuestionModal
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/embeddable_questions/components/UpsertEmbeddableQuestionModal'
import SortableEmbeddableQuestionList
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/embeddable_assessments/components/SortableEmbeddableQuestionList'

type UpsertEmbeddableAssignmentModalProps = {
  courseId: number,
  open: boolean,
  setOpen: React.Dispatch<SetStateAction<boolean>>,
  editingAssignment?: EmbeddableAssignment,
  onSaveCallback: () => void,
}

export type AssignmentQuestionEntry = UpsertEmbeddableAssignmentQuestionParams & { key: number }

const UpsertEmbeddableAssignmentModal: React.FC<UpsertEmbeddableAssignmentModalProps> = ({
  courseId,
  open,
  setOpen,
  editingAssignment,
  onSaveCallback,
}) => {
  const [form] = Form.useForm<UpsertEmbeddableAssignmentParams>()
  const [isLoading, setIsLoading] = useState(false)
  const [selectEmbeddableQuestionOpen, setSelectEmbeddableQuestionOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)


  const [allQuestions, setAllQuestions] = useState<EmbeddableQuestion[]>([])

  const retrieveQuestions = useCallback(async () => {
    if (!courseId) return
    await API.lti.embeddableQuestion.getAll(courseId).then(setAllQuestions).catch((err) => message.error(getErrorMessage(err)))
  }, [courseId])

  useEffect(() => {
    retrieveQuestions().then()
  }, [retrieveQuestions])

  const [questions, setQuestions] = useState<AssignmentQuestionEntry[]>([])

  function addExistingQuestions(questions: EmbeddableQuestion[]) {
    setQuestions(prev => [...prev, ...questions.map((q,i) => ({ questionId: q.id, order: 0, key: prev.length+i }))])
  }

  function addNewQuestion(createParams: UpsertEmbeddableQuestionParams) {
    setQuestions(prev => [...prev, { createParams, order: 0, key: prev.length }])
  }

  const handleSave = async (values: UpsertEmbeddableAssignmentParams) => {
    if (isLoading) return
    setIsLoading(true)

    if (questions.length <= 0) {
      message.warning('Please select or create at least one question for this assessment.')
    }

    try {
      const sanitized: Record<string,any> = pick(values,['name','availableUntil','availableFrom'])
      Object.keys(sanitized).forEach((k) => {
        if (k === 'name') {
          sanitized[k] = sanitized[k]?.trim() ?? undefined
          if (typeof sanitized[k] === 'string' && !sanitized[k]) sanitized[k] = null
        } else {
          if (sanitized[k] === undefined) sanitized[k] = null
          else sanitized[k] = sanitized[k].toDate()
        }
      })
      values = sanitized as any

      values.questions = questions.map((v, i) => {
        return {
          ...pick(v,['questionId','createParams']),
          order: i
        } as UpsertEmbeddableAssignmentQuestionParams
      })

      if (editingAssignment) {
        await API.lti.embeddableQuestion.assignment.update(courseId, editingAssignment.id, values)
        message.success('Successfully updated assessment!')
      } else {
        await API.lti.embeddableQuestion.assignment.create(courseId, values)
        message.success('Successfully created assessment!')
      }

      form.resetFields()
      setOpen(false)
      onSaveCallback()
    } catch (err) {
      message.error(`Could not save assessment: ${getErrorMessage(err)}`)
    } finally {
      setIsLoading(false)
    }
  }

  const defaults = useMemo(() => {
    if (!editingAssignment) return undefined
    const values = pick(editingAssignment,['name','availableFrom','availableUntil'])
    if (values.availableFrom) values.availableFrom = dayjs(new Date(values.availableFrom)) as any
    else delete values.availableFrom
    if (values.availableUntil) values.availableUntil = dayjs(new Date(values.availableUntil)) as any
    else delete values.availableUntil
    return values
  }, [editingAssignment])

  useEffect(() => {
    if (!editingAssignment) {
      setQuestions([])
      return
    }
    setQuestions(editingAssignment.questions.map((v,i) => ({
      questionId: v.questionId,
      order: v.order!,
      key: i,
    })))
  }, [editingAssignment])

  useEffect(() => {
    if (!open)
      setQuestions([])
  }, [open])

  return (
    <Modal
      title={editingAssignment ? 'Edit Assessment' : 'Create Assessment'}
      open={open}
      okButtonProps={{ htmlType: 'submit', autoFocus: true, loading: isLoading }}
      onCancel={() => setOpen(false)}
      okText={editingAssignment ? 'Save' : 'Create'}
      destroyOnHidden
      modalRender={(dom) => (
        <Form
          clearOnDestroy
          form={form}
          onFinish={(values) => handleSave(values)}
          initialValues={defaults}
          layout="vertical"
        >
          {dom}
        </Form>
      )}
    >
      <div className={'flex flex-col'}>
        <Form.Item
          name="name"
          label={
            <div className={'flex w-full'}>
              <Tooltip title="A custom name/identifier for the assessment so it can be easily identified in a list.">
                Name <InfoCircleOutlined />
              </Tooltip>
            </div>
          }
          required={true}
          rules={[
            {
              required: true,
              message: 'Name is required.',
            },
            {
              type: 'string',
              whitespace: true,
              message: 'Name should contain more than just whitespace characters.',
            }
          ]}
        >
          <Input placeholder={'e.g., Assignment 1'}/>
        </Form.Item>
        <div className={'grid grid-cols-2 gap-4'}>
          <Form.Item
            name={'availableFrom'}
            label={
              <div className={'flex w-full'}>
                <Tooltip title="(Optional) When this question will be available for student interaction.">
                  Available From <InfoCircleOutlined />
                </Tooltip>
              </div>
            }
            getValueProps={(i) => ({ value: i !== undefined ? dayjs(i) : undefined })}
          >
            <DatePicker
              showTime
              allowClear
            />
          </Form.Item>
          <Form.Item
            name={'availableUntil'}
            label={
              <div className={'flex w-full'}>
                <Tooltip title="(Optional) When this question will stop being available for student interaction.">
                  Available From <InfoCircleOutlined />
                </Tooltip>
              </div>
            }
            getValueProps={(i) => ({ value: i !== undefined ? dayjs(i) : undefined })}
          >
            <DatePicker
              showTime
              allowClear
            />
          </Form.Item>
        </div>
        <Divider>Questions</Divider>
        <div>
          <SortableEmbeddableQuestionList
            questions={questions}
            setQuestions={setQuestions}
            allQuestions={allQuestions}
          />
          <div className={'flex justify-end gap-2'}>
            <Button icon={<PlusOutlined/>} onClick={() => setSelectEmbeddableQuestionOpen(true)}>
              Add existing Question
            </Button>
            <Button icon={<PlusOutlined/>} onClick={() => setCreateModalOpen(true)}>
              Create new Question
            </Button>
          </div>
        </div>
        <SelectEmbeddableQuestionModal
          open={selectEmbeddableQuestionOpen}
          onClose={() => setSelectEmbeddableQuestionOpen(false)}
          questions={allQuestions}
          onMultiSelect={(n) => addExistingQuestions(allQuestions.filter(v => n.includes(v.id)))}
          disabled={questions.map(v => v.questionId!).filter(v => v != undefined)}
          mode={'multi'}
          showDates={false}
        />
        <UpsertEmbeddableQuestionModal
          courseId={courseId}
          open={createModalOpen}
          setOpen={setCreateModalOpen}
          saveProxy={(values) => addNewQuestion(values)}
        />
      </div>
    </Modal>
  )
}

export default UpsertEmbeddableAssignmentModal;