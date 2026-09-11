'use client'

import { useEffect, useState, type ReactElement } from 'react'
import {
  Button,
  Checkbox,
  Collapse,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Tag,
  message,
} from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import type {
  EmbeddableQuestion,
  GradingCheck,
  QuestionGradingSettings,
  ScoreScale,
  UpsertEmbeddableQuestionParams,
} from '@koh/common'
import {
  createGradingPreset,
  getMaxScore,
  questionGradingSettingsSchema,
} from '@koh/common'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

interface EmbeddableQuestionFormProps {
  courseId: number
  open: boolean
  setOpen: (open: boolean) => void
  editingQuestion?: EmbeddableQuestion
  onSaveCallback: () => void
}

/** New questions start with a blank main grading prompt (placeholder shown). */
const defaultGradingSettings = { ...createGradingPreset('generic'), rubric: '' }

const checkOptions: Array<{ value: GradingCheck['kind']; label: string }> = [
  { value: 'minimum_sentences', label: 'Minimum sentences' },
  { value: 'maximum_sentences', label: 'Maximum sentences' },
  { value: 'capitalization', label: 'Capitalization' },
]

const checkLabels: Record<GradingCheck['kind'], string> = {
  minimum_sentences: 'Minimum sentences',
  maximum_sentences: 'Maximum sentences',
  capitalization: 'Capitalization',
}

function newCheck(kind: GradingCheck['kind']): GradingCheck {
  switch (kind) {
    case 'minimum_sentences':
      return { kind, minimum: 3, scoreCap: null }
    case 'maximum_sentences':
      return { kind, maximum: 5, scoreCap: null }
    case 'capitalization':
      return { kind, term: 'Example', scoreCap: null }
  }
}

function scoreText(scale: ScoreScale): string {
  return scale.kind === 'range'
    ? `0–${scale.max} by ${scale.step}`
    : scale.values.join(', ')
}

function GradingSettingsEditor({
  value,
  onChange,
}: {
  value?: QuestionGradingSettings
  onChange?: (settings: QuestionGradingSettings) => void
}): ReactElement {
  const settings = value ?? defaultGradingSettings
  // The typed score text is owned by this editor and only stored once the
  // user edits it; until then it derives from the incoming settings, so an
  // externally replaced value (e.g. editing another question) always shows.
  const [editedScoreText, setEditedScoreText] = useState<string | null>(null)
  const valuesScale =
    settings.scoreScale.kind === 'values' ? settings.scoreScale : null
  const explicitScoreText =
    editedScoreText ?? (valuesScale ? valuesScale.values.join(', ') : '')

  const update = (changes: Partial<QuestionGradingSettings>) =>
    onChange?.({ ...settings, ...changes })

  const updateCheck = (
    index: number,
    change: (check: GradingCheck) => GradingCheck,
  ) =>
    update({
      checks: settings.checks.map((check, checkIndex) =>
        checkIndex === index ? change(check) : check,
      ),
    })

  const addCheck = (kind: GradingCheck['kind']) => {
    if (kind) {
      update({ checks: [...settings.checks, newCheck(kind)] })
    }
  }

  const removeCheck = (index: number) =>
    update({
      checks: settings.checks.filter((_, checkIndex) => checkIndex !== index),
    })

  const setScoreKind = (kind: ScoreScale['kind']) => {
    if (kind === settings.scoreScale.kind) return
    // Any typed score text belongs to the previous scale, so reset it and
    // derive from the new scale instead.
    setEditedScoreText(null)
    update({
      scoreScale:
        kind === 'range'
          ? { kind, max: 10, step: 1 }
          : { kind, values: [0, 1, 2] },
    })
  }

  const checkRows = (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="mb-0 text-sm text-gray-500">
          These requirements are checked automatically. A blank answer is always
          handled for you.
        </p>
        <Select
          value={undefined}
          placeholder="Add requirement"
          options={checkOptions}
          onChange={addCheck}
          aria-label="Add answer requirement"
          className="min-w-44"
        />
      </div>
      {settings.checks.map((check, index) => (
        <div key={`${check.kind}-${index}`} className="rounded border p-3">
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="mb-0 font-medium">{checkLabels[check.kind]}</p>
            <Button
              danger
              icon={<DeleteOutlined />}
              aria-label={`Remove ${checkLabels[check.kind].toLowerCase()} requirement`}
              onClick={() => removeCheck(index)}
            />
          </div>
          {check.kind === 'minimum_sentences' && (
            <InputNumber
              min={1}
              max={1000}
              value={check.minimum}
              addonBefore="At least"
              addonAfter="sentences"
              aria-label="Minimum sentence count"
              onChange={(minimum) =>
                updateCheck(index, (current) =>
                  current.kind === 'minimum_sentences'
                    ? { ...current, minimum: minimum ?? current.minimum }
                    : current,
                )
              }
              className="w-full"
            />
          )}
          {check.kind === 'maximum_sentences' && (
            <InputNumber
              min={1}
              max={1000}
              value={check.maximum}
              addonBefore="At most"
              addonAfter="sentences"
              aria-label="Maximum sentence count"
              onChange={(maximum) =>
                updateCheck(index, (current) =>
                  current.kind === 'maximum_sentences'
                    ? { ...current, maximum: maximum ?? current.maximum }
                    : current,
                )
              }
              className="w-full"
            />
          )}
          {check.kind === 'capitalization' && (
            <Input
              value={check.term}
              addonBefore="Term"
              aria-label="Term to capitalize"
              onChange={(event) =>
                updateCheck(index, (current) =>
                  current.kind === 'capitalization'
                    ? { ...current, term: event.target.value }
                    : current,
                )
              }
            />
          )}
          <Space className="mt-2" wrap>
            <Checkbox
              checked={check.scoreCap === null}
              onChange={(event) =>
                updateCheck(index, (current) => ({
                  ...current,
                  scoreCap: event.target.checked
                    ? null
                    : Math.min(1, getMaxScore(settings.scoreScale)),
                }))
              }
            >
              Reminder only (no score cap)
            </Checkbox>
            {check.scoreCap !== null && (
              <InputNumber
                min={0}
                max={getMaxScore(settings.scoreScale)}
                step={
                  settings.scoreScale.kind === 'range'
                    ? settings.scoreScale.step
                    : undefined
                }
                value={check.scoreCap}
                addonBefore="Cap score at"
                aria-label="Score cap"
                onChange={(scoreCap) =>
                  updateCheck(index, (current) => ({
                    ...current,
                    scoreCap: scoreCap ?? current.scoreCap,
                  }))
                }
              />
            )}
          </Space>
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <Form.Item
        label="Main grading prompt"
        required
        tooltip="Describe what earns each score. Feedback instructions are added to this prompt."
      >
        <Input.TextArea
          value={settings.rubric}
          onChange={(event) => update({ rubric: event.target.value })}
          rows={6}
          maxLength={15000}
          aria-label="Main grading prompt"
          placeholder="Explain what a strong, partial, and inadequate answer looks like."
        />
      </Form.Item>

      <Form.Item
        label="Feedback instructions"
        tooltip="Added to the main grading prompt when giving students feedback."
      >
        <Input.TextArea
          value={settings.feedbackInstructions}
          onChange={(event) =>
            update({ feedbackInstructions: event.target.value })
          }
          rows={3}
          maxLength={15000}
          aria-label="Feedback instructions"
          placeholder="How should the feedback comment be written?"
        />
      </Form.Item>

      <div>
        <p className="mb-1 font-medium">Score scale</p>
        <p className="mb-2 text-sm text-gray-500">
          Choose a regular range or list the exact scores this question allows.
        </p>
        <Radio.Group
          value={settings.scoreScale.kind}
          onChange={(event) => setScoreKind(event.target.value)}
          options={[
            { value: 'range', label: 'Range' },
            { value: 'values', label: 'Explicit scores' },
          ]}
        />
        {settings.scoreScale.kind === 'range' ? (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Form.Item label="Maximum score" className="mb-0">
              <InputNumber
                min={0.01}
                max={100000}
                step={settings.scoreScale.step}
                value={settings.scoreScale.max}
                aria-label="Maximum score"
                onChange={(max) => {
                  if (settings.scoreScale.kind !== 'range') return
                  update({
                    scoreScale: {
                      kind: 'range',
                      max: max ?? settings.scoreScale.max,
                      step: settings.scoreScale.step,
                    },
                  })
                }}
                className="w-full"
              />
            </Form.Item>
            <Form.Item label="Score increment" className="mb-0">
              <InputNumber
                min={0.01}
                max={100000}
                value={settings.scoreScale.step}
                aria-label="Score increment"
                onChange={(step) => {
                  if (settings.scoreScale.kind !== 'range') return
                  update({
                    scoreScale: {
                      kind: 'range',
                      max: settings.scoreScale.max,
                      step: step ?? settings.scoreScale.step,
                    },
                  })
                }}
                className="w-full"
              />
            </Form.Item>
          </div>
        ) : (
          <Form.Item label="Allowed scores" className="mb-0 mt-2">
            <Input
              value={explicitScoreText}
              aria-label="Allowed scores"
              onChange={(event) => {
                const text = event.target.value
                setEditedScoreText(text)
                update({
                  scoreScale: {
                    kind: 'values',
                    values: text.split(',').map((part) => {
                      const trimmed = part.trim()
                      return trimmed === '' ? Number.NaN : Number(trimmed)
                    }),
                  },
                })
              }}
              placeholder="0, 1, 2, 3"
            />
          </Form.Item>
        )}
        <Tag className="mt-2">
          Current scale: {scoreText(settings.scoreScale)}
        </Tag>
      </div>

      <Collapse
        className="border border-gray-200"
        items={[
          {
            key: 'requirements',
            label: 'Answer requirements (optional)',
            children: checkRows,
          },
        ]}
      />
    </div>
  )
}

export default function EmbeddableQuestionForm({
  courseId,
  open,
  setOpen,
  editingQuestion,
  onSaveCallback,
}: EmbeddableQuestionFormProps): ReactElement {
  const [form] = Form.useForm<UpsertEmbeddableQuestionParams>()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    form.setFieldsValue(
      editingQuestion
        ? {
            title: editingQuestion.title,
            questionText: editingQuestion.questionText,
            gradingSettings: editingQuestion.gradingSettings,
          }
        : {
            title: '',
            questionText: '',
            gradingSettings: structuredClone(defaultGradingSettings),
          },
    )
  }, [editingQuestion, form, open])

  const handleSave = async (values: UpsertEmbeddableQuestionParams) => {
    if (isLoading) return
    setIsLoading(true)
    try {
      await (editingQuestion
        ? API.lti.embeddableQuestion.update(
            courseId,
            editingQuestion.id,
            values,
          )
        : API.lti.embeddableQuestion.create(courseId, values))
      message.success(
        `Successfully ${editingQuestion ? 'updated' : 'created'} embeddable question!`,
      )
      setOpen(false)
      onSaveCallback()
    } catch (err) {
      message.error(`Could not save question: ${getErrorMessage(err)}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      title={editingQuestion ? 'Edit Question' : 'Create Question'}
      open={open}
      width={850}
      okButtonProps={{ htmlType: 'submit', loading: isLoading }}
      onCancel={() => setOpen(false)}
      okText={editingQuestion ? 'Save' : 'Create'}
      destroyOnClose
      modalRender={(dom) => (
        <Form
          form={form}
          onFinish={handleSave}
          layout="vertical"
          clearOnDestroy
        >
          {dom}
        </Form>
      )}
    >
      <Form.Item
        name="title"
        label="Question title"
        rules={[
          { required: true, whitespace: true, message: 'A title is required.' },
        ]}
      >
        <Input maxLength={255} placeholder="e.g. Explain the main argument" />
      </Form.Item>

      <Form.Item
        name="questionText"
        label="Question"
        rules={[
          {
            required: true,
            whitespace: true,
            message: 'Question text is required.',
          },
        ]}
      >
        <Input.TextArea
          rows={4}
          maxLength={15000}
          placeholder="Write the question students will answer."
        />
      </Form.Item>

      <Form.Item
        name="gradingSettings"
        rules={[
          {
            validator: async (_, value: unknown) => {
              const result = questionGradingSettingsSchema.safeParse(value)
              if (!result.success) {
                throw new Error(
                  result.error.issues[0]?.message ??
                    'Check the question grading settings.',
                )
              }
            },
          },
        ]}
      >
        <GradingSettingsEditor />
      </Form.Item>
    </Modal>
  )
}
