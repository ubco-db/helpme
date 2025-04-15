import React, { useState } from 'react'
import {
  Modal,
  Input,
  Form,
  message,
  Checkbox,
  Tooltip,
  Button,
  Popconfirm,
  Upload,
  Image,
} from 'antd'
import { useUserInfo } from '@/app/contexts/userContext'
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'
import { QuestionTagSelector } from '../../../components/QuestionTagElement'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { deleteAsyncQuestion } from '../../utils/commonAsyncFunctions'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import type { GetProp, UploadFile, UploadProps } from 'antd'

// stuff from antd example code for upload and form
type FileType = Parameters<GetProp<UploadProps, 'beforeUpload'>>[0]
const getBase64 = (file: FileType): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
const UploadButton: React.FC = () => (
  <button className="border-none bg-transparent" type="button">
    <PlusOutlined />
    <div className="mt-1">Upload</div>
  </button>
)
/* I think this is just to make sure the file list is an array */
const normFile = (e: any) => {
  if (Array.isArray(e)) {
    return e
  }
  return e?.fileList
}

interface FormValues {
  QuestionAbstract: string
  questionText: string
  questionTypesInput: number[]
  refreshAIAnswer: boolean
  images: UploadFile[]
}

interface CreateAsyncQuestionModalProps {
  courseId: number
  open: boolean
  onCancel: () => void
  onCreateOrUpdateQuestion: () => void
  question?: AsyncQuestion // if it's defined, then it's an edit modal
}

const CreateAsyncQuestionModal: React.FC<CreateAsyncQuestionModalProps> = ({
  courseId,
  open,
  onCancel,
  onCreateOrUpdateQuestion,
  question,
}) => {
  const { userInfo, setUserInfo } = useUserInfo()
  const [questionTypes] = useQuestionTypes(courseId, null)
  const [form] = Form.useForm()
  const [isLoading, setIsLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const courseFeatures = useCourseFeatures(courseId)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState('')

  const handlePreviewImage = async (file: UploadFile) => {
    if (!file.url && !file.preview) {
      file.preview = await getBase64(file.originFileObj as FileType)
    }

    setPreviewImage(file.url || (file.preview as string))
    setPreviewOpen(true)
  }

  const onFinish = async (values: FormValues) => {
    setIsLoading(true)
    const newQuestionTypeInput =
      values.questionTypesInput && questionTypes
        ? questionTypes.filter((questionType) =>
            values.questionTypesInput.includes(questionType.id),
          )
        : []

    // If editing a question, update the question. Else create a new one
    if (question) {
      // create FormData for the request
      const formData = new FormData()
      formData.append('questionText', values.questionText || '')
      formData.append('questionAbstract', values.QuestionAbstract)
      formData.append('questionTypes', JSON.stringify(newQuestionTypeInput))
      if (values.refreshAIAnswer) {
        formData.append('refreshAIAnswer', 'true')
      }

      // to find out what images are deleted, compare question.images.imageId with values.images.uid
      const deletedImageIds = question.images
        .filter(
          (image) =>
            !values.images.some((file) => Number(file.uid) === image.imageId),
        )
        .map((image) => image.imageId)
      formData.append('deletedImageIds', JSON.stringify(deletedImageIds))
      console.log(deletedImageIds)

      // to find out what images are new, get all values.images where uid is NaN
      const newImages = values.images.filter((file) => isNaN(Number(file.uid)))
      console.log(newImages)

      // Append each new image file
      if (newImages) {
        newImages.forEach((file: any) => {
          // Only append if it's a real file (antd's Upload component adds some metadata we don't want)
          if (file.originFileObj) {
            formData.append('newImages', file.originFileObj)
          }
        })
      }

      await API.asyncQuestions
        .studentUpdate(question.id, formData)
        .then(() => {
          message.success('Question Updated')
          onCreateOrUpdateQuestion()
        })
        .catch((e) => {
          const errorMessage = getErrorMessage(e)
          message.error('Error updating question:' + errorMessage)
        })
        .finally(() => {
          if (values.refreshAIAnswer) {
            setUserInfo({
              ...userInfo,
              chat_token: {
                ...userInfo.chat_token,
                used: userInfo.chat_token.used + 1,
              },
            })
          }
          setIsLoading(false)
        })
    } else {
      // Create FormData for the request
      const formData = new FormData()
      formData.append('questionText', values.questionText || '')
      formData.append('questionAbstract', values.QuestionAbstract)
      formData.append('questionTypes', JSON.stringify(newQuestionTypeInput))
      formData.append(
        'status',
        courseFeatures?.asyncCentreAIAnswers
          ? asyncQuestionStatus.AIAnswered
          : asyncQuestionStatus.AIAnsweredNeedsAttention,
      )

      // Append each image file
      if (values.images) {
        values.images.forEach((file: any) => {
          // Only append if it's a real file (antd's Upload component adds some metadata we don't want)
          if (file.originFileObj) {
            formData.append('images', file.originFileObj)
          }
        })
      }

      await API.asyncQuestions
        .create(formData, courseId)
        .then(() => {
          message.success('Question Posted')
          onCreateOrUpdateQuestion()
        })
        .catch((e) => {
          const errorMessage = getErrorMessage(e)
          message.error('Error creating question:' + errorMessage)
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }

  return (
    <Modal
      open={open}
      title={question ? 'Edit Question' : 'What do you need help with?'}
      okText="Finish"
      cancelText="Cancel"
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
        loading: isLoading,
      }}
      cancelButtonProps={{
        danger: !question,
      }}
      onCancel={onCancel}
      // display delete button for mobile in footer
      footer={(_, { OkBtn, CancelBtn }) => (
        <div
          className={`flex md:justify-end ${question ? 'justify-between' : 'justify-end'}`}
        >
          {question && (
            <Popconfirm
              className="flex md:hidden"
              title="Are you sure you want to delete your question?"
              okText="Yes"
              cancelText="No"
              getPopupContainer={(trigger) => trigger.parentNode as HTMLElement}
              okButtonProps={{ loading: deleteLoading }}
              onConfirm={async () => {
                setDeleteLoading(true)
                await deleteAsyncQuestion(
                  question.id,
                  false,
                  onCreateOrUpdateQuestion,
                )
                setDeleteLoading(false)
              }}
            >
              <Button danger type="primary" icon={<DeleteOutlined />}>
                {' '}
                Delete Question{' '}
              </Button>
            </Popconfirm>
          )}
          <div className="ml-1 flex gap-2">
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
            QuestionAbstract: question?.questionAbstract,
            questionText: question?.questionText,
            questionTypesInput:
              questionTypes && questionTypes.length > 0
                ? question?.questionTypes?.map(
                    (questionType) => questionType.id,
                  )
                : [],
            images: question?.images.map((image) => ({
              uid: image.imageId,
              name: image.originalFileName,
              url: `/api/v1/asyncQuestions/${courseId}/image/${image.imageId}`,
            })),
          }}
          clearOnDestroy
          onFinish={(values) => onFinish(values)}
        >
          {dom}
        </Form>
      )}
    >
      <Form.Item
        name="QuestionAbstract"
        label="Question Abstract"
        tooltip="A short summary/description of the question (or the question itself)"
        required={true}
        rules={[
          { required: true, message: 'Please input your question abstract' },
          {
            max: 100,
            message: 'Question abstract must be less than 100 characters',
          },
        ]}
      >
        <Input
          placeholder="Stuck on Lab 3 part C"
          count={{
            show: true,
            max: 100,
          }}
        />
      </Form.Item>
      <Form.Item
        name="questionText"
        label="Question Text"
        tooltip="Your full question text. The placeholder text is just an example"
      >
        <Input.TextArea
          placeholder="It's asking me to... but I got an incorrect answer. Here is my work:..."
          autoSize={{ minRows: 3, maxRows: 6 }}
          allowClear
        />
      </Form.Item>
      <Form.Item
        label="Images (optional)"
        tooltip="When the AI is generating an answer, it will use these images to help. You can upload up to 8 images"
        name="images"
        valuePropName="fileList"
        getValueFromEvent={normFile}
      >
        <Upload
          name="files"
          listType="picture-card"
          accept="image/*"
          onPreview={handlePreviewImage}
          maxCount={8}
          multiple={true}
        >
          {form.getFieldValue('images')?.length >= 8 ? null : <UploadButton />}
        </Upload>
      </Form.Item>
      {previewImage && (
        <Image
          wrapperStyle={{ display: 'none' }}
          width={200}
          preview={{
            visible: previewOpen,
            onVisibleChange: (visible) => setPreviewOpen(visible),
            afterOpenChange: (visible) => !visible && setPreviewImage(''),
          }}
          src={previewImage}
          alt={`Preview of ${previewImage}`}
        />
      )}
      {questionTypes && questionTypes.length > 0 && (
        <Form.Item
          name="questionTypesInput"
          label="What categories does your question fall under?"
        >
          <QuestionTagSelector questionTags={questionTypes} />
        </Form.Item>
      )}
      {question && courseFeatures?.asyncCentreAIAnswers && (
        <Tooltip
          placement="topLeft"
          title={
            userInfo.chat_token.used >= userInfo.chat_token.max_uses
              ? 'You are out of AI answers for today. Please try again tomorrow.'
              : null
          }
        >
          <Form.Item name="refreshAIAnswer" valuePropName="checked">
            <Checkbox
              disabled={
                userInfo.chat_token.used >= userInfo.chat_token.max_uses
              }
            >
              Get a new AI answer?
            </Checkbox>
          </Form.Item>
        </Tooltip>
      )}
      <div className="text-gray-500">
        Only you and faculty will be able to see your question unless a faculty
        member chooses to mark it public, in which case it will appear fully
        anonymous to other students.
      </div>
    </Modal>
  )
}

export default CreateAsyncQuestionModal
