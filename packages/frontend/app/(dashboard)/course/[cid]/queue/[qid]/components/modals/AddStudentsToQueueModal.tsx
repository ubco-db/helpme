import { useCallback } from 'react'
import Modal from 'antd/lib/modal/Modal'
import { Form, message, Checkbox, Input, Select, Segmented } from 'antd'
import { useEffect, useState } from 'react'
import { OpenQuestionStatus, QuestionLocations, UserTiny } from '@koh/common'
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'
import { QuestionTagSelector } from '../../../../components/QuestionTagElement'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import CenteredSpinner from '@/app/components/CenteredSpinner'

interface FormValues {
  studentId: number
  questionTypesInput: number[]
  questionText: string
  location: QuestionLocations
  help: boolean
}

interface AddStudentsToQueueModalProps {
  queueId: number
  courseId: number
  isQueueHybrid: boolean
  open: boolean
  onAddStudent: () => void
  onCancel: () => void
}

const AddStudentsToQueueModal: React.FC<AddStudentsToQueueModalProps> = ({
  queueId,
  courseId,
  isQueueHybrid,
  open,
  onAddStudent,
  onCancel,
}) => {
  const [form] = Form.useForm()
  const [questionTypes] = useQuestionTypes(courseId, queueId)
  const [isloading, setIsLoading] = useState(false)
  //studentState stores all students
  const [studentsState, setStudentsState] = useState<UserTiny[]>()
  const [selectedStudent, setSelectedStudent] = useState<UserTiny>()

  const populateStudents = useCallback(async () => {
    await API.course
      .getAllStudentsNotInQueue(courseId)
      .then((students) => {
        setStudentsState(students)
      })
      .catch((err) => {
        const errorMessage = getErrorMessage(err)
        message.error(errorMessage)
      })
  }, [courseId])

  useEffect(() => {
    if (open) {
      populateStudents()
    }
  }, [populateStudents, open])

  const onFinish = async (values: FormValues) => {
    if (studentsState?.length == 0) {
      onCancel()
      return
    }
    if (!selectedStudent) {
      message.error('Please select a student')
      return
    }

    setIsLoading(true)
    const newQuestionTypeInput =
      values.questionTypesInput && questionTypes
        ? questionTypes.filter((questionType) =>
            values.questionTypesInput.includes(questionType.id),
          )
        : []
    await API.questions
      .TAcreate(
        {
          text: values.questionText ?? '',
          queueId: queueId,
          location: values.location,
          force: true,
          groupable: false,
          questionTypes: newQuestionTypeInput,
          isTaskQuestion: false,
        },
        selectedStudent.id,
      )
      .then(async (response) => {
        message.success(`${selectedStudent.name} has been added to the queue`)
        if (values.help) {
          await API.questions
            .update(response.id, {
              status: OpenQuestionStatus.Helping,
            })
            .catch(() => {
              message.error('Failed to help student')
            })
        }
        onAddStudent()
      })
      .catch((err) => {
        const errorMessage = getErrorMessage(err)
        message.error(errorMessage)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  return (
    <Modal
      open={open}
      title="Add Students To Queue"
      okText="Finish"
      cancelText={
        !studentsState || studentsState.length === 0 ? 'Close' : 'Cancel'
      }
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
        disabled: !studentsState || studentsState.length === 0,
        loading: isloading,
      }}
      cancelButtonProps={{
        danger: studentsState && studentsState.length > 0,
      }}
      onCancel={onCancel}
      destroyOnClose
      modalRender={(dom) => (
        <Form
          layout="vertical"
          form={form}
          name="form_in_modal"
          initialValues={{
            location: isQueueHybrid ? 'Online' : undefined,
          }}
          onValuesChange={(changedValues, allValues) => {
            if (changedValues.studentId) {
              setSelectedStudent(
                studentsState?.find(
                  (student) => student.id === changedValues.studentId,
                ),
              )
            }
          }}
          clearOnDestroy
          onFinish={(values) => onFinish(values)}
        >
          {dom}
        </Form>
      )}
    >
      {studentsState === undefined ? (
        <CenteredSpinner tip="Loading Students" />
      ) : studentsState.length == 0 ? (
        <p>There are no students or all students are in queue</p>
      ) : (
        <>
          <Form.Item
            name="studentId"
            label="Select Student"
            rules={[{ required: true, message: 'Please select a student' }]}
          >
            <Select
              showSearch
              placeholder="Select Student"
              optionFilterProp="label"
              options={studentsState?.map((student) => ({
                value: student.id,
                label: student.name,
              }))}
            />
          </Form.Item>
          {questionTypes && questionTypes.length > 0 && (
            <Form.Item
              name="questionTypesInput"
              label="What categories does the question fall under?"
            >
              <QuestionTagSelector questionTags={questionTypes} />
            </Form.Item>
          )}
          <Form.Item name="questionText" label="Question Text">
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} allowClear />
          </Form.Item>

          {isQueueHybrid && (
            <Form.Item
              name="location"
              label="How would you like them to meet you?"
            >
              <Segmented
                options={[
                  { label: 'Online', value: 'Online' },
                  { label: 'In-Person', value: 'In-Person' },
                ]}
              />
            </Form.Item>
          )}
          <Form.Item name="help" valuePropName="checked">
            <Checkbox>
              Help {selectedStudent ? selectedStudent.name : 'Student'}?
            </Checkbox>
          </Form.Item>
        </>
      )}
    </Modal>
  )
}

export default AddStudentsToQueueModal
