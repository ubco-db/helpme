import Modal from 'antd/lib/modal/Modal'
import { ReactElement, useCallback, useEffect, useState } from 'react'
import { Input, Form, Button, message, Checkbox } from 'antd'
import { BgColorsOutlined } from '@ant-design/icons'
import { QuestionTypeParams } from '@koh/common'
import { QuestionType } from '../Shared/QuestionType'
import { SketchPicker } from 'react-color'
import { useCourse } from '../../../hooks/useCourse'
import { API } from '@koh/api-client'
import { useQuestionTypes } from '../../../hooks/useQuestionTypes'

interface EditAsyncQuestionsModalProps {
  courseId: number
  visible: boolean
  onClose: () => void
}

export function EditAsyncQuestionsModal({
  courseId,
  visible,
  onClose,
}: EditAsyncQuestionsModalProps): ReactElement {
  const [form] = Form.useForm()
  const [questionTypes, mutateQuestionTypes] = useQuestionTypes(courseId, null)
  const [questionTypeAddState, setQuestionTypeAddState] = useState()
  const [color, setColor] = useState(
    '#' + Math.floor(Math.random() * 16777215).toString(16),
  )
  const [pickerVisible, setPickerVisible] = useState(false)
  const [isInputEmpty, setIsInputEmpty] = useState(true)

  const onAddChange = (e) => {
    const inputValue = e.target.value.trim()
    if (inputValue !== '') {
      setIsInputEmpty(false)
      setQuestionTypeAddState(inputValue)
    } else {
      setIsInputEmpty(true)
    }
  }

  const handleColorChange = (color) => {
    setColor(color.hex)
  }

  const onclick = useCallback(
    async (questionTypeId: number) => {
      await API.questionType.deleteQuestionType(courseId, questionTypeId)
      mutateQuestionTypes()
    },
    [courseId, mutateQuestionTypes],
  )

  const addQuestionType = useCallback(async () => {
    if (isInputEmpty) {
      message.error('Please enter a question tag name')
      return
    }
    try {
      await API.questionType.addQuestionType(courseId, {
        name: questionTypeAddState,
        color: color,
        queueId: null,
      })
    } catch (e) {
      message.error('Question tag already exists')
    }
    mutateQuestionTypes()
  }, [isInputEmpty, mutateQuestionTypes, courseId, questionTypeAddState, color])

  return (
    <Modal
      title="Edit Queue"
      open={visible}
      onCancel={onClose}
      onOk={async () => {
        // if we had any other fields that we wanted to validate, we would do it here
        // for now, it's just questionTypes, which get updated as soon as they are changed and not through the OK button
        // const value = await form.validateFields()
        // message.success('Queue updated successfully')
        onClose()
      }}
    >
      <Form form={form} initialValues={{ courseId: courseId }}>
        <Form.Item name="courseId" hidden>
          <Input />
        </Form.Item>
        <h4>Current Question Tags: (click to delete)</h4>
        {questionTypes.length > 0 ? (
          questionTypes.map((questionType, index) => (
            <QuestionType
              key={index}
              typeName={questionType.name}
              typeColor={questionType.color}
              onClick={() => onclick(questionType.id)}
            />
          ))
        ) : (
          <p>No Questions types</p>
        )}
        <Form.Item name="add">
          <Input
            allowClear={true}
            placeholder="Enter New Question tag name"
            onChange={onAddChange}
            maxLength={15}
            style={{ marginBottom: '10px' }}
          />
          <Button onClick={() => setPickerVisible(!pickerVisible)}>
            <BgColorsOutlined />
          </Button>

          {pickerVisible && (
            <SketchPicker color={color} onChangeComplete={handleColorChange} />
          )}

          <Button
            onClick={() => {
              setPickerVisible(false)
              const randomColor =
                '#' + Math.floor(Math.random() * 16777215).toString(16)
              handleColorChange({ hex: randomColor })
              addQuestionType()
            }}
          >
            Add
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
