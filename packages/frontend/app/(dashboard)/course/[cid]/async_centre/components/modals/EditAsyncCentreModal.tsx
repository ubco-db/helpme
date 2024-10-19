import Modal from 'antd/lib/modal/Modal'
import {
  Input,
  Form,
  Button,
  message,
  GetProp,
  ColorPickerProps,
  Space,
} from 'antd'
import { CloseOutlined, PlusOutlined } from '@ant-design/icons'
import { API } from '@/app/api'
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { QuestionTypeParams } from '@koh/common'
import { QuestionTagDeleteSelector } from '../../../components/QuestionTagElement'
import ColorPickerWithPresets from '@/app/components/ColorPickerWithPresets'

type Color = GetProp<ColorPickerProps, 'value'>

type QuestionTypeForCreation = {
  name: string
  color: string | Color
}
interface FormValues {
  notes: string
  questionTypesForDeletion: number[]
  questionTypesForCreation: QuestionTypeForCreation[]
}

interface EditAsyncCentreModalProps {
  courseId: number
  open: boolean
  onCancel: () => void
  onEditSuccess: () => void
}

const EditAsyncCentreModal: React.FC<EditAsyncCentreModalProps> = ({
  courseId,
  open,
  onCancel,
  onEditSuccess,
}) => {
  const [form] = Form.useForm()
  const [questionTypes, mutateQuestionTypes] = useQuestionTypes(courseId, null)

  const onFinish = async (values: FormValues) => {
    let errorsHaveOccurred = false

    const deletePromises =
      values.questionTypesForDeletion?.map((tagID) =>
        API.questionType
          .deleteQuestionType(courseId, tagID)
          .then((responseMessage) => {
            message.success(responseMessage)
          })
          .catch((e) => {
            errorsHaveOccurred = true
            const errorMessage = getErrorMessage(e)
            message.error(`Error deleting question tag: ${errorMessage}`)
          }),
      ) || []

    const createPromises =
      values.questionTypesForCreation?.map((questionType) => {
        const newQuestionType: QuestionTypeParams = {
          cid: courseId,
          queueId: null,
          name: questionType.name,
          color:
            typeof questionType.color === 'string'
              ? questionType.color
              : questionType.color.toHexString(),
        }
        return API.questionType
          .addQuestionType(courseId, newQuestionType)
          .then((responseMessage) => {
            message.success(responseMessage)
          })
          .catch((e) => {
            errorsHaveOccurred = true
            const errorMessage = getErrorMessage(e)
            message.error(`Error creating question tag: ${errorMessage}`)
          })
      }) || []

    await Promise.all([...deletePromises, ...createPromises])
    mutateQuestionTypes()
    if (!errorsHaveOccurred) {
      onEditSuccess()
    }
  }

  return (
    <Modal
      open={open}
      title="Edit Queue Details"
      okText="Save Changes"
      cancelText="Cancel"
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
      }}
      onCancel={onCancel}
      destroyOnClose
      modalRender={(dom) => (
        <Form
          layout="vertical"
          form={form}
          name="form_in_modal"
          initialValues={{
            questionTypesForDeletion: [],
          }}
          clearOnDestroy
          onFinish={(values) => onFinish(values)}
        >
          {dom}
        </Form>
      )}
    >
      <Form.Item
        label="Question Tags (Click to be marked for deletion)"
        name="questionTypesForDeletion"
      >
        <QuestionTagDeleteSelector currentTags={questionTypes ?? []} />
      </Form.Item>
      <Form.List
        name="questionTypesForCreation"
        // initialValue={[{name: 'test', color: '#' + Math.floor(Math.random() * 16777215).toString(16) }]}
      >
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => {
              const defaultColor =
                '#' + Math.floor(Math.random() * 16777215).toString(16)
              return (
                <Space key={key} className="flex" align="center">
                  <Form.Item
                    {...restField}
                    name={[name, 'name']}
                    rules={[
                      { required: true, message: 'Please input a tag name' },
                      {
                        max: 20,
                        message: 'Tag name must be less than 20 characters',
                      },
                      {
                        validator: (_: any, value: string) => {
                          if (!value || value.trim() === '') {
                            return Promise.reject(
                              'Tag name cannot be empty or spaces only',
                            )
                          }
                          // make sure no other tags have the same name
                          else if (
                            value &&
                            questionTypes?.find((tag) => tag.name === value)
                          ) {
                            return Promise.reject('Duplicate tag name')
                          }
                          return Promise.resolve()
                        },
                      },
                    ]}
                  >
                    <Input
                      allowClear={true}
                      placeholder="Tag Name"
                      maxLength={20}
                    />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    valuePropName="color"
                    name={[name, 'color']}
                    rules={[{ required: true, message: 'Missing color' }]}
                    initialValue={defaultColor}
                  >
                    <ColorPickerWithPresets
                      defaultValue={defaultColor}
                      format="hex"
                      defaultFormat="hex"
                      disabledAlpha
                    />
                  </Form.Item>
                  <CloseOutlined
                    className="text-md mb-[1.5rem] text-gray-600"
                    onClick={() => remove(name)}
                  />
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
                Add Question Type
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>
    </Modal>
  )
}

export default EditAsyncCentreModal
