import { ReactElement, useRef } from 'react'
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
} from 'antd'
import styled from 'styled-components'
import { API } from '@koh/api-client'
import { useQueue } from '../../../hooks/useQueue'
import {
  QueueConfig,
  UpdateQueueParams,
  validateQueueConfigInput,
} from '@koh/common'
import { pick } from 'lodash'
import { default as React, useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/router'
import { useCourse } from '../../../hooks/useCourse'
import { QuestionType } from '../../Questions/Shared/QuestionType'
import {
  DisableQueueButton,
  ClearQueueButton,
  clearQueue,
  confirmDisable,
} from '../../Questions/Queue/QueueInfoColumn'
import { SketchPicker } from 'react-color'
import { BgColorsOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import QueueConfigHelp from '../Shared/QueueConfigHelp'
import { useQuestionTypes } from '../../../hooks/useQuestionTypes'

const NotesInput = styled(Input.TextArea)`
  border-radius: 6px;
  border: 1px solid #b8c4ce;
`

const { TextArea } = Input

const CustomFormItem = styled(Form.Item)`
  padding-bottom: 1.75rem;
  margin-bottom: 1.75rem;

  @media (max-width: 650px) {
    padding-bottom: 1rem;
    margin-bottom: 1rem;
    &:last-child {
      padding-bottom: 0;
      margin-bottom: 0;
    }
  }

  @media (min-width: 650px) {
    // the last child on desktop is actually the second last child (since the last child is the delete and clear queue buttons)
    &:nth-last-child(2) {
      padding-bottom: 0;
      margin-bottom: 0;
    }
  }
`

interface EditQueueModalProps {
  queueId: number
  visible: boolean
  onClose: () => void
}

export function EditQueueModal({
  queueId,
  visible,
  onClose,
}: EditQueueModalProps): ReactElement {
  const { queue, mutateQueue } = useQueue(queueId)
  const [form] = Form.useForm()
  const [questionTypeAddState, setQuestionTypeAddState] = useState()
  const router = useRouter()
  const courseId = Number(router.query['cid'])
  const course = useCourse(courseId)
  const [questionTypes, mutateQuestionTypes] = useQuestionTypes(
    courseId,
    queueId,
  )
  const [currentZoomLink, setCurrentZoomLink] = useState(
    course.course?.zoomLink,
  )
  const [color, setColor] = useState(
    '#' + Math.floor(Math.random() * 16777215).toString(16),
  )
  const [pickerVisible, setPickerVisible] = useState(false)
  const [isInputEmpty, setIsInputEmpty] = useState(true)

  const handleColorChange = (color) => {
    setColor(color.hex)
  }
  const [zoomLink, setZoomLink] = useState('')

  const lastSavedQueueConfig = useRef<QueueConfig | null>(queue?.config || null)
  // gets updated whenever the config text box changes. Just stores the string
  const [localQueueConfigString, setLocalQueueConfigString] = useState(
    JSON.stringify(lastSavedQueueConfig.current, null, 2),
  )
  // both of these are used to determine if the "Save Queue Changes" button should be enabled
  const [isValidConfig, setIsValidConfig] = useState(true)
  const [configHasChanges, setConfigHasChanges] = useState(false)

  const editQueue = async (updateQueue: UpdateQueueParams) => {
    const newQueue = { ...queue, ...updateQueue }
    mutateQueue(newQueue, false)
    await API.queues.update(
      newQueue.id,
      pick(newQueue, ['notes', 'allowQuestions']),
    )
    mutateQueue()
  }

  const onclick = useCallback(
    async (questionTypeId: number) => {
      API.questionType
        .deleteQuestionType(courseId, questionTypeId)
        .then((responseMessage) => {
          message.success(responseMessage)
          mutateQueue()
          mutateQuestionTypes()
        })
        .catch((e) => {
          const errorMessage = e.response?.data || 'Unknown error occurred'
          message.error(`Error creating question tag: ${errorMessage}`)
        })
    },
    [courseId, mutateQuestionTypes, mutateQueue],
  )

  const onAddChange = (e) => {
    const inputValue = e.target.value.trim()
    if (inputValue !== '') {
      setIsInputEmpty(false)
      setQuestionTypeAddState(inputValue)
    } else {
      setIsInputEmpty(true)
    }
  }

  const onZoomLinkChange = (e) => {
    setZoomLink(e.target.value)
  }

  const addQuestionType = useCallback(async () => {
    if (isInputEmpty) {
      message.error('Please enter a question tag name')
      return
    }
    API.questionType
      .addQuestionType(courseId, {
        name: questionTypeAddState,
        color: color,
        queueId: queueId,
      })
      .then((responseMessage) => {
        mutateQueue()
        mutateQuestionTypes()
        message.success(responseMessage)
        return
      })
      .catch((e) => {
        const errorMessage = e.response?.data || 'Unknown error occurred'
        message.error(`Error creating question tag: ${errorMessage}`)
      })
  }, [
    isInputEmpty,
    courseId,
    questionTypeAddState,
    color,
    queueId,
    mutateQueue,
    mutateQuestionTypes,
  ])

  // any changes to the queue config (such as adding/deleted a question type) will update the queue config  text box
  useEffect(() => {
    if (queue.config && visible) {
      const newConfigString = JSON.stringify(queue.config, null, 2)
      if (
        newConfigString !==
        JSON.stringify(lastSavedQueueConfig.current, null, 2)
      ) {
        // this check is needed otherwise *any* updates to the queue (including creating/modifying questions) will cause this to run and reset the user's changes
        setLocalQueueConfigString(newConfigString)
        setConfigHasChanges(false)
        lastSavedQueueConfig.current = queue.config
        form.setFieldsValue({ queue_config: newConfigString })
      }
    }
  }, [queue.config, form, visible])

  const changeZoomLink = async () => {
    await API.course
      .editCourseInfo(courseId, {
        courseId: courseId,
        zoomLink: zoomLink,
      })
      .then(() => {
        message.success('Zoom link Changed')
        setCurrentZoomLink(zoomLink)
      })
  }

  // this form is really weird. It's a form with an OK button but most form elements have their own setter buttons.
  // TODO: maybe refactor this so that it works like a regular form (nothing is set until they hit the form's OK button)
  return (
    <Modal
      title="Edit Queue Details"
      open={visible}
      onCancel={onClose}
      onOk={async () => {
        const value = await form.validateFields()
        await editQueue(value)
        onClose()
      }}
      width={800}
    >
      {queue && (
        <Form
          form={form}
          initialValues={{ queue_config: localQueueConfigString, ...queue }}
        >
          <CustomFormItem
            label="Queue Notes"
            className="font-medium"
            name="notes"
          >
            <NotesInput
              className="font-normal"
              allowClear={true}
              placeholder={''}
            />
          </CustomFormItem>

          <CustomFormItem
            label="Allow New Questions"
            className="font-medium"
            name="allowQuestions"
            valuePropName="checked"
          >
            <Switch />
          </CustomFormItem>
          <h4 className="font-medium">
            Current Question Tags: (click to delete)
          </h4>
          <div className="my-1">
            {questionTypes?.length > 0 ? (
              questionTypes?.map((questionType, index) => (
                <QuestionType
                  key={index}
                  typeName={questionType.name}
                  typeColor={questionType.color}
                  onClick={() => onclick(questionType.id)}
                />
              ))
            ) : (
              <p>No Question Tags</p>
            )}
          </div>
          <CustomFormItem name="add">
            <div className="flex justify-between">
              <Button onClick={() => setPickerVisible(!pickerVisible)}>
                <BgColorsOutlined />
              </Button>

              <Input
                allowClear={true}
                placeholder="Enter New Question Tag Name"
                onChange={onAddChange}
                maxLength={15}
                className="mx-2 mb-2"
              />

              <Button
                disabled={isInputEmpty}
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
            </div>

            {pickerVisible && (
              <SketchPicker
                className=""
                color={color}
                onChangeComplete={handleColorChange}
              />
            )}
          </CustomFormItem>
          <h4 className="mt-2 font-medium">Current Zoom link:</h4>
          {currentZoomLink ? (
            <a className="block text-sky-800" href={currentZoomLink}>
              {currentZoomLink}
            </a>
          ) : (
            <p>[No Zoomlink set]</p>
          )}
          <CustomFormItem>
            <Input
              className="my-1"
              allowClear={true}
              onChange={onZoomLinkChange}
            />
            <Button className="my-1" onClick={changeZoomLink}>
              Change Link
            </Button>
          </CustomFormItem>
          {/* Delete Queue and Clear Queue buttons for mobile only (normally shown on QueueListShareComponents.tsx) */}
          <CustomFormItem className="block sm:hidden">
            <div className="flex flex-row space-x-4">
              <DisableQueueButton
                onClick={() => confirmDisable(queueId, queue)}
                disabled={queue?.isDisabled}
                className="!w-fit"
              >
                {queue?.isDisabled ? `Queue deleted` : `Delete Queue`}
              </DisableQueueButton>
              <Popconfirm
                title={
                  'Are you sure you want to clear all students from the queue?'
                }
                okText="Yes"
                cancelText="No"
                placement="top"
                arrowPointAtCenter={true}
                onConfirm={() => clearQueue(queueId, queue)}
              >
                <ClearQueueButton className="!w-fit">
                  Clear Queue
                </ClearQueueButton>
              </Popconfirm>
            </div>
          </CustomFormItem>
          <Collapse bordered={false}>
            <Collapse.Panel
              key="1"
              header={
                <label className="mt-2 font-medium" htmlFor="queue_config">
                  <span className="mr-1">Queue Config</span>
                  <Tooltip
                    title={
                      'Here you can specify a JSON config to automatically set up question tags, tasks, and other settings for the queue. For example, you can use this to set up a chemistry lab that requires certain tasks to be checked off (e.g. have the TA look at the experiment before continuing). It is recommended to create a new queue for each lab assignment. You can also easily externally save this config and copy/paste this config to other queues and courses.'
                    }
                  >
                    <QuestionCircleOutlined style={{ color: 'gray' }} />
                  </Tooltip>
                </label>
              }
            >
              <CustomFormItem
                className="!mb-0 !pb-0"
                name="queue_config"
                rules={[
                  {
                    // using this as an onChange for the textArea. The validator promises will show nice error messages
                    validator: (_, value) => {
                      setLocalQueueConfigString(value)
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
                        setConfigHasChanges(
                          JSON.stringify(
                            lastSavedQueueConfig.current,
                            null,
                            2,
                          ) != value,
                        )
                        setIsValidConfig(true)
                        return Promise.resolve()
                      } catch (error) {
                        setIsValidConfig(false)
                        return Promise.reject(
                          new Error('Invalid JSON: ' + error.message),
                        )
                      }
                    },
                  },
                ]}
                extra={
                  <>
                    <Button
                      className="my-2"
                      disabled={!isValidConfig || !configHasChanges}
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
                                queue.id,
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
                            const errorMessage =
                              error?.response?.data?.message ?? error.message
                            message.error(
                              `Failed to save queue config: ${errorMessage}`,
                            )
                          }
                        } catch (error) {
                          message.error('Invalid JSON: ' + error.message)
                        }
                      }}
                    >
                      Save Config Changes
                    </Button>
                    <QueueConfigHelp />
                  </>
                }
              >
                <TextArea className="!h-[30rem] w-full" spellCheck="false" />
              </CustomFormItem>
            </Collapse.Panel>
          </Collapse>
        </Form>
      )}
    </Modal>
  )
}
