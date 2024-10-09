'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Modal from 'antd/lib/modal/Modal'
import {
  Input,
  Form,
  Button,
  message,
  Popconfirm,
  Switch,
  Tooltip,
  Collapse,
  Space,
  ColorPickerProps,
  GetProp,
  Dropdown,
  Segmented,
} from 'antd'
import {
  QuestionTypeParams,
  QueueConfig,
  UpdateQueueParams,
  validateQueueConfigInput,
} from '@koh/common'
import { pick } from 'lodash'
import {
  ClearOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { API } from '@/app/api'
import { useCourse } from '@/app/hooks/useCourse'
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'
import { useQueue } from '@/app/hooks/useQueue'
import QueueConfigHelp from '../../../../components/QueueConfigHelp'
import {
  DisableQueueButton,
  ClearQueueButton,
} from '../../../../components/QueueInfoColumnButton'
import {
  confirmDisable,
  clearQueue,
} from '../../../../utils/commonCourseFunctions'
import { QuestionTagDeleteSelector } from '../../../../components/QuestionTagElement'
import { useRouter } from 'next/navigation'
import { getErrorMessage } from '@/app/utils/generalUtils'
import ColorPickerWithPresets from '@/app/components/ColorPickerWithPresets'
import exampleConfig from '@/public/exampleQueueConfig.json'
import exampleLabConfig from '@/public/exampleQueueLabConfig.json'

const { TextArea } = Input
type Color = GetProp<ColorPickerProps, 'value'>

type QuestionTypeForCreation = {
  name: string
  color: string | Color
}
interface FormValues {
  notes: string
  allowQuestions: boolean
  questionTypesForDeletion: number[]
  questionTypesForCreation: QuestionTypeForCreation[]
  zoomLink: string
  queue_config: string
}

interface EditQueueModalProps {
  queueId: number
  courseId: number
  open: boolean
  onCancel: () => void
  onEditSuccess: () => void
}

const EditQueueModal: React.FC<EditQueueModalProps> = ({
  queueId,
  courseId,
  open,
  onCancel,
  onEditSuccess,
}) => {
  const { queue, mutateQueue } = useQueue(queueId)
  const [form] = Form.useForm()
  const { course, mutateCourse } = useCourse(courseId)
  const [questionTypes, mutateQuestionTypes] = useQuestionTypes(
    courseId,
    queueId,
  )
  const router = useRouter()
  const lastSavedQueueConfig = useRef<QueueConfig | null>(queue?.config || null)
  // gets updated whenever the config text box changes. Just stores the string
  const [localQueueConfigString, setLocalQueueConfigString] = useState(
    JSON.stringify(lastSavedQueueConfig.current, null, 2),
  )
  // both of these are used to determine if the "Save Queue Changes" button should be enabled
  const [isValidConfig, setIsValidConfig] = useState(true)
  const [configHasChanges, setConfigHasChanges] = useState(false)

  const resetQueueConfig = useCallback(() => {
    if (open && queue && queue.config) {
      const currentConfigString = JSON.stringify(queue.config, null, 2)
      setLocalQueueConfigString(currentConfigString)
      setConfigHasChanges(false)
      lastSavedQueueConfig.current = queue.config
      form.setFieldsValue({ queue_config: currentConfigString })
    }
  }, [open, queue, form])

  // if someone or something else updates the queue config, reset the queue config
  useEffect(() => {
    if (open && queue?.config) {
      const newConfigString = JSON.stringify(queue.config, null, 2)
      // this check is needed otherwise *any* updates to the queue (including creating/modifying questions) will cause this to run and reset the user's changes
      if (
        newConfigString !==
        JSON.stringify(lastSavedQueueConfig.current, null, 2)
      ) {
        resetQueueConfig()
      }
    }
  }, [open, queue?.config, resetQueueConfig])

  // Values and labels for Segmented component for queue types
  const queueTypeOptions = [
    { label: 'Online', value: 'online' },
    { label: 'Hybrid', value: 'hybrid' },
    { label: 'In-Person', value: 'inPerson' },
  ]

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
          queueId: queueId,
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
    const zoomLinkPromise =
      values.zoomLink !== course?.zoomLink
        ? API.course
            .editCourseInfo(courseId, {
              courseId: courseId,
              zoomLink: values.zoomLink,
            })
            .then(() => {
              message.success('Zoom link Changed')
              mutateCourse()
            })
            .catch((e) => {
              errorsHaveOccurred = true
              const errorMessage = getErrorMessage(e)
              message.error(`Failed to change zoom link: ${errorMessage}`)
            })
        : Promise.resolve()
    const updateQueueParams: UpdateQueueParams = pick(values, [
      'type',
      'notes',
      'allowQuestions',
    ])
    const updateQueuePromise =
      updateQueueParams.type !== queue?.type ||
      updateQueueParams.notes !== queue?.notes ||
      updateQueueParams.allowQuestions !== queue?.allowQuestions
        ? API.queues
            .update(queueId, updateQueueParams)
            .then(() => {
              message.success('Queue details saved')
            })
            .catch((e) => {
              errorsHaveOccurred = true
              const errorMessage = getErrorMessage(e)
              message.error(`Failed to save queue details: ${errorMessage}`)
            })
        : Promise.resolve()
    await Promise.all([
      ...deletePromises,
      ...createPromises,
      zoomLinkPromise,
      updateQueuePromise,
    ])
    mutateQuestionTypes()
    mutateQueue()
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
        disabled: configHasChanges,
      }}
      width={800}
      onCancel={onCancel}
      destroyOnClose
      modalRender={(dom) => (
        <Form
          layout="vertical"
          form={form}
          name="form_in_modal"
          initialValues={{
            queue_config: localQueueConfigString,
            notes: queue?.notes,
            allowQuestions: queue?.allowQuestions,
            questionTypesForDeletion: [],
            zoomLink: course?.zoomLink,
          }}
          clearOnDestroy
          onFinish={(values) => onFinish(values)}
        >
          {dom}
        </Form>
      )}
    >
      <Form.Item label="Queue Type" name="type">
        <Segmented
          options={queueTypeOptions}
          defaultValue={queue?.type ?? ''}
        />
      </Form.Item>

      <Form.Item label="Queue Notes" name="notes">
        <TextArea
          className="rounded-md border border-gray-400 font-normal"
          allowClear={true}
          placeholder="Ex. Lab name, lab section, physical room location, any announcements, links to external resources, a mix of these, or any other details"
        />
      </Form.Item>

      <Form.Item
        label="Allow New Questions"
        name="allowQuestions"
        valuePropName="checked"
        layout="horizontal"
      >
        <Switch />
      </Form.Item>
      <Form.Item
        label="Question Tags (Click to be marked for deletion)"
        name="questionTypesForDeletion"
      >
        <QuestionTagDeleteSelector currentTags={questionTypes ?? []} />
      </Form.Item>
      <Form.List name="questionTypesForCreation">
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
                        validator: (_, value) => {
                          // make sure no other tags have the same name
                          if (
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
      <Form.Item label="Zoom/Teams Link" name="zoomLink">
        <Input
          allowClear={true}
          className="text-sky-800"
          placeholder="[No Zoom/Teams link set]"
        />
      </Form.Item>
      {/* Delete Queue and Clear Queue buttons for mobile only (normally shown on QueueInfoColumn.tsx) */}
      <div className="flex flex-row space-x-4 md:hidden">
        <DisableQueueButton
          onClick={() =>
            confirmDisable(queueId, queue, router, `/course/${courseId}`)
          }
          disabled={queue?.isDisabled}
          icon={<DeleteOutlined />}
        >
          {queue?.isDisabled ? `Queue deleted` : `Delete Queue`}
        </DisableQueueButton>
        <Popconfirm
          title={'Are you sure you want to clear all students from the queue?'}
          okText="Yes"
          cancelText="No"
          placement="top"
          arrow={{ pointAtCenter: true }}
          onConfirm={() => clearQueue(queueId, queue)}
        >
          <ClearQueueButton icon={<ClearOutlined />}>
            Clear Queue
          </ClearQueueButton>
        </Popconfirm>
      </div>
      {/* TODO: update this to the new collapse api */}
      <Collapse
        bordered={false}
        items={[
          {
            key: '1',
            label: (
              <label className="mt-2 font-medium" htmlFor="queue_config">
                <span className="mr-1">Queue Config</span>
                <Tooltip
                  title={
                    'Here you can specify a JSON config to automatically set up question tags, tasks, and other settings for the queue. For example, you can use this to set up a chemistry lab that requires certain tasks to be checked off (e.g. have the TA look at the experiment before continuing). You can also easily externally save this config and copy/paste this config to other queues and courses.'
                  }
                >
                  <QuestionCircleOutlined style={{ color: 'gray' }} />
                </Tooltip>
              </label>
            ),
            children: (
              <Form.Item
                className="!mb-0 !pb-0"
                name="queue_config"
                rules={[
                  {
                    // using this as an onChange for the textArea. The validator promises will show nice error messages
                    validator: (_, value) => {
                      setLocalQueueConfigString(value)
                      setConfigHasChanges(
                        JSON.stringify(lastSavedQueueConfig.current, null, 2) !=
                          value,
                      )
                      try {
                        // parse the config (any errors will be caught by the try-catch)
                        const parsedConfig = JSON.parse(value)
                        // TODO: figure out a way to warn the user if there are duplicate keys in the config (JSON.parse will not throw an error, it will just overwrite the first object with the second one. It'd just be for UX)
                        // Hours spent trying to do so without success: 3.5
                        // For something so simple, I could not find a simple way to do it. At this point. it might be worth just getting a proper JSON editor component or make the UI to build the config instead of a json

                        // More error checking
                        const configError =
                          validateQueueConfigInput(parsedConfig)
                        if (configError) {
                          setIsValidConfig(false)
                          return Promise.reject(new Error(configError))
                        }
                        // config is good
                        setIsValidConfig(true)
                        return Promise.resolve()
                      } catch (error) {
                        setIsValidConfig(false)
                        if (error instanceof Error) {
                          return Promise.reject(
                            new Error('Invalid JSON: ' + error.message),
                          )
                        } else {
                          return Promise.reject(new Error('Invalid JSON'))
                        }
                      }
                    },
                  },
                ]}
                extra={
                  <>
                    <Button
                      className="my-2 mr-4"
                      disabled={!isValidConfig || !configHasChanges}
                      type="primary"
                      onClick={async () => {
                        // technically, i don't need to parse the JSON again since it's already parsed in the validator, but in case that fails this also checks for errors.
                        try {
                          const parsedConfig = JSON.parse(
                            localQueueConfigString,
                          )
                          const configError =
                            validateQueueConfigInput(parsedConfig)
                          if (configError) {
                            message.error(configError)
                            return
                          }
                          try {
                            const updatedTagsMessages =
                              await API.queues.updateConfig(
                                queueId,
                                parsedConfig,
                              )
                            message.success('Queue config saved')
                            lastSavedQueueConfig.current = parsedConfig
                            setConfigHasChanges(false)
                            // if any of the questionTypes were created/updated/deleted, update the questionTypes and message the user
                            if (
                              updatedTagsMessages.questionTypeMessages.length >
                              0
                            ) {
                              mutateQuestionTypes()
                              for (const tagMessage of updatedTagsMessages.questionTypeMessages) {
                                message.info(tagMessage)
                              }
                            }
                          } catch (error) {
                            const errorMessage = getErrorMessage(error)
                            message.error(
                              `Failed to save queue config: ${errorMessage}`,
                            )
                          }
                        } catch (error) {
                          if (error instanceof Error) {
                            return Promise.reject(
                              new Error('Invalid JSON: ' + error.message),
                            )
                          } else {
                            return Promise.reject(new Error('Invalid JSON'))
                          }
                        }
                      }}
                    >
                      Save Config Changes
                    </Button>
                    <Button
                      className="my-2 mr-4"
                      disabled={!configHasChanges}
                      onClick={() => resetQueueConfig()}
                    >
                      Reset
                    </Button>
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: [
                          {
                            key: '1',
                            label: 'Load Example Config',
                            onClick: () => {
                              const exampleConfigString = JSON.stringify(
                                exampleConfig,
                                null,
                                2,
                              )
                              setLocalQueueConfigString(exampleConfigString)
                              form.setFieldsValue({
                                queue_config: exampleConfigString,
                              })
                              setConfigHasChanges(true)
                            },
                          },
                          {
                            key: '2',
                            label: 'Load Example Lab Config',
                            onClick: () => {
                              const exampleLabConfigString = JSON.stringify(
                                exampleLabConfig,
                                null,
                                2,
                              )
                              setLocalQueueConfigString(exampleLabConfigString)
                              form.setFieldsValue({
                                queue_config: exampleLabConfigString,
                              })
                              setConfigHasChanges(true)
                            },
                          },
                        ],
                      }}
                    >
                      <a onClick={(e) => e.preventDefault()}>
                        Example Configs <DownOutlined />
                      </a>
                    </Dropdown>
                    <QueueConfigHelp />
                  </>
                }
              >
                <TextArea className="!h-[30rem] w-full" spellCheck="false" />
              </Form.Item>
            ),
          },
        ]}
      ></Collapse>
    </Modal>
  )
}

export default EditQueueModal
