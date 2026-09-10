'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { Form, Input, Modal, message } from 'antd'
import type { EmbeddableQuiz, UpsertEmbeddableQuizParams } from '@koh/common'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

interface EmbeddableQuizFormProps {
  courseId: number
  open: boolean
  setOpen: (open: boolean) => void
  editingQuiz?: EmbeddableQuiz
  onSaveCallback: () => void
}

export default function EmbeddableQuizForm({
  courseId,
  open,
  setOpen,
  editingQuiz,
  onSaveCallback,
}: EmbeddableQuizFormProps): ReactElement {
  const [form] = Form.useForm<UpsertEmbeddableQuizParams>()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    form.setFieldsValue(
      editingQuiz
        ? {
            title: editingQuiz.title,
            objective: editingQuiz.objective,
            background: editingQuiz.background,
          }
        : { title: '', objective: '', background: '' },
    )
  }, [editingQuiz, form, open])

  const handleSave = async (values: UpsertEmbeddableQuizParams) => {
    if (isLoading) return
    setIsLoading(true)
    try {
      const payload: UpsertEmbeddableQuizParams = {
        title: values.title.trim(),
        objective: values.objective.trim(),
        background: values.background.trim(),
      }
      await (editingQuiz
        ? API.lti.embeddableQuiz.update(courseId, editingQuiz.id, payload)
        : API.lti.embeddableQuiz.create(courseId, payload))
      message.success(
        `Quiz ${editingQuiz ? 'updated' : 'created'} successfully.`,
      )
      setOpen(false)
      onSaveCallback()
    } catch (err) {
      message.error(`Could not save quiz: ${getErrorMessage(err)}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      title={editingQuiz ? 'Edit Quiz' : 'Create Quiz'}
      open={open}
      okText={editingQuiz ? 'Save' : 'Create'}
      okButtonProps={{ htmlType: 'submit', loading: isLoading }}
      onCancel={() => setOpen(false)}
      destroyOnClose
      modalRender={(dom) => (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          clearOnDestroy
        >
          {dom}
        </Form>
      )}
    >
      <Form.Item
        name="title"
        label="Quiz title"
        rules={[
          {
            required: true,
            whitespace: true,
            message: 'A quiz title is required.',
          },
        ]}
      >
        <Input maxLength={255} placeholder="e.g. Week 3 reflection" />
      </Form.Item>
      <Form.Item
        name="objective"
        label="Quiz objective"
        extra="Optional shared context about what this quiz is testing."
      >
        <Input.TextArea
          rows={3}
          maxLength={15000}
          placeholder="What should students demonstrate across this quiz?"
        />
      </Form.Item>
      <Form.Item
        name="background"
        label="Shared background"
        extra="Optional context shared with each question's grader."
      >
        <Input.TextArea
          rows={5}
          maxLength={15000}
          placeholder="Add a reading summary or other shared context."
        />
      </Form.Item>
    </Modal>
  )
}
