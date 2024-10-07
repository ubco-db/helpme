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
  Checkbox,
  Select,
} from 'antd'
import {
  ConfigTasks,
  isCycleInTasks,
  QuestionTypeParams,
  QueueConfig,
  UpdateQueueParams,
  validateQueueConfigInput,
} from '@koh/common'
import { debounce, pick } from 'lodash'
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
import TaskDeleteSelector from '../TaskDisplay'

const { TextArea } = Input
type Color = GetProp<ColorPickerProps, 'value'>

type TaskParams = {
  id: string
  display_name: string
  short_display_name: string
  blocking: boolean
  color_hex: string
  precondition?: string
}
type QuestionTypeForCreation = {
  name: string
  color: string | Color
}
interface FormValues {
  notes: string
  allowQuestions: boolean
  questionTypesForDeletion: number[]
  questionTypesForCreation: QuestionTypeForCreation[]
  tasks: TaskParams[]
  zoomLink: string
  queue_config: string
  minTags: string
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
  const [saveChangesLoading, setSaveChangesLoading] = useState(false)
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

  const [assignmentIdEmpty, setAssignmentIdEmpty] = useState(
    lastSavedQueueConfig.current?.assignment_id === undefined,
  )
  const [localTaskIds, setLocalTaskIds] = useState<string[]>(
    lastSavedQueueConfig.current?.tasks
      ? Object.keys(lastSavedQueueConfig.current.tasks)
      : [],
  )

  // reset localTaskIds back to normal when re-opening modal
  useEffect(() => {
    if (open) {
      setLocalTaskIds(
        lastSavedQueueConfig.current?.tasks
          ? Object.keys(lastSavedQueueConfig.current.tasks)
          : [],
      )
    }
  }, [open])

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

  const onFinish = async (values: FormValues) => {
    setSaveChangesLoading(true)
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
    const newQueueConfig: QueueConfig = {
      ...lastSavedQueueConfig.current,
      minimum_tags: Number(values.minTags),
      // iterate over each task and accumulate them into an object
      tasks: values.tasks.reduce((acc, task) => {
        acc[task.id] = {
          display_name: task.display_name,
          short_display_name: task.short_display_name,
          blocking: task.blocking,
          color_hex: task.color_hex,
          precondition: task.precondition ?? null,
        }
        return acc
      }, {} as ConfigTasks),
    }

    const tasksChanged =
      JSON.stringify(newQueueConfig.tasks || {}) !==
      JSON.stringify(lastSavedQueueConfig.current?.tasks || {})
    const minimumTagsChanged =
      lastSavedQueueConfig.current?.minimum_tags !== Number(values.minTags)

    // if the tasks changed, make sure there's no cycle in the new tasks
    if (
      tasksChanged &&
      newQueueConfig.tasks &&
      isCycleInTasks(newQueueConfig.tasks)
    ) {
      message.error(
        'Error: Cycle detected in task preconditions. Please fix this before saving.',
      )
      setSaveChangesLoading(false)
      return
    }
    const queueConfigPromise =
      tasksChanged || minimumTagsChanged
        ? API.queues
            .updateConfig(queueId, newQueueConfig)
            .then(() => {
              if (minimumTagsChanged) {
                message.success('Minimum Tags updated to ' + values.minTags)
              }
              if (tasksChanged) {
                message.success('Tasks updated successfully')
              }
            })
            .catch((e) => {
              errorsHaveOccurred = true
              console.log(JSON.stringify(e))
              const errorMessage = getErrorMessage(e)
              console.log(JSON.stringify(errorMessage))
              message.error(`Update failed: ${errorMessage}`)
            })
        : Promise.resolve()
    const updateQueueParams: UpdateQueueParams = pick(values, [
      'notes',
      'allowQuestions',
    ])
    const updateQueuePromise =
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
      queueConfigPromise,
      updateQueuePromise,
    ])
    mutateQuestionTypes()
    mutateQueue()
    if (!errorsHaveOccurred) {
      onEditSuccess()
    }
    setSaveChangesLoading(false)
  }

  // Debounce the form values change to prevent too many updates (e.g. when typing)
  const handleValuesChange = debounce(
    (changedValues: any, allValues: FormValues) => {
      if (changedValues.assignmentId !== undefined) {
        setAssignmentIdEmpty(!changedValues.assignmentId)
      }
      // Whenever one of the taskIds changes, update localTaskIds to reflect the new taskIds
      // This will be used to check for duplicate taskIds
      const taskWithId = changedValues.tasks?.find(
        (task: any) => task?.id !== undefined,
      )
      if (taskWithId) {
        setLocalTaskIds(allValues.tasks.map((task) => task?.id))
      }
    },
    300,
  ) // Adjust the debounce delay as needed

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
        loading: saveChangesLoading,
      }}
      width={800}
      onCancel={onCancel}
      loading={!queue || !course}
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
            assignmentId: lastSavedQueueConfig.current?.assignment_id,
            zoomLink: course?.zoomLink,
            minTags: queue?.config?.minimum_tags ?? 0,
            tasks: Object.entries(
              lastSavedQueueConfig.current?.tasks || {},
            ).map(([taskID, task]) => ({
              id: taskID,
              display_name: task.display_name,
              short_display_name: task.short_display_name,
              blocking: task.blocking,
              color_hex: task.color_hex,
              precondition: task.precondition,
            })),
          }}
          onValuesChange={handleValuesChange}
          clearOnDestroy
          onFinish={(values) => onFinish(values)}
        >
          {dom}
        </Form>
      )}
    >
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
      <Form.Item
        label="Minimum Question Tags"
        name="minTags"
        layout="horizontal"
        tooltip="This allows you to force your students to select a number of question tags when creating a question. Setting to 0 will make selecting a question tag optional"
      >
        <Input type="number" min={0} max={20} />
      </Form.Item>
      <Form.Item
        label="Assignment Id"
        name="assignmentId"
        layout="horizontal"
        tooltip={`The assignment ID for the queue (e.g. "lab1", "lab2", "assignment1", etc.). This is used to track the assignment progress for students. Only set if you want to define tasks to keep track of.`}
      >
        <Input allowClear={true} placeholder="[No Assignment Id set]" />
      </Form.Item>
      {!assignmentIdEmpty && (
        <>
          <Form.Item
            label="Tasks"
            tooltip={`The tasks for the queue. A task is similar to a tag except it is 'check-able'. For example, a lab may have many parts or questions that require a TA to look at before the end of the lab. Students will then be able to Create a Demo which you can then help and select which parts to mark correct.`}
            name="tasksForDeletion"
          >
            <TaskDeleteSelector
              configTasks={lastSavedQueueConfig.current?.tasks || {}}
            />
          </Form.Item>
          <Form.List name="tasks">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }, index) => {
                  const defaultColor =
                    form.getFieldValue(['tasks', name, 'color_hex']) ||
                    '#' + Math.floor(Math.random() * 16777215).toString(16)
                  return (
                    <Space key={key} className="flex flex-wrap" align="center">
                      <Form.Item
                        {...restField}
                        name={[name, 'id']}
                        label={index === 0 ? 'Task ID' : ''}
                        tooltip={
                          'The unique task ID for this task (e.g. task1).'
                        }
                        validateTrigger="onBlur"
                        rules={[
                          {
                            required: true,
                            message: 'Task ID required',
                          },
                          {
                            max: 50,
                            message: 'Task IDs must be less than 50 characters',
                          },
                          {
                            validator: (_, value) => {
                              // make sure there are no duplicate task IDs
                              // The reason we check for 2 is because it includes the current task ID
                              const duplicateCount = localTaskIds.filter(
                                (id) => id === value,
                              ).length
                              if (duplicateCount >= 2) {
                                return Promise.reject('Duplicate Task ID')
                              }
                              return Promise.resolve()
                            },
                          },
                        ]}
                        className="w-32"
                      >
                        <Input
                          allowClear={true}
                          placeholder="task1"
                          maxLength={50}
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'display_name']}
                        label={index === 0 ? 'Display Name' : ''}
                        tooltip={`The name of the task (e.g. "Task 1", "Task 2", etc.)`}
                        rules={[
                          { required: true, message: 'Name required' },
                          {
                            max: 20,
                            message:
                              'Task names must be less than 20 characters',
                          },
                        ]}
                        className="w-[8.5rem]"
                      >
                        <Input
                          allowClear={true}
                          placeholder="Task 1"
                          maxLength={20}
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'short_display_name']}
                        label={index === 0 ? 'Short Name' : ''}
                        className="min-w-[7.5rem]"
                        tooltip={`The short display name of the task (e.g. "1", "2", etc.) used in certain parts of the UI. Try to keep this no more than 1 or 2 characters.`}
                        rules={[
                          {
                            max: 3,
                            message:
                              'Short task names must be less than 3 characters',
                          },
                          {
                            required: true,
                            message: 'Short Required',
                          },
                        ]}
                      >
                        <Input
                          className="ml-7 w-12"
                          placeholder="1"
                          maxLength={3}
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        label={index === 0 ? 'Blocking?' : ''}
                        name={[name, 'blocking']}
                        valuePropName="checked"
                        className="min-w-24"
                        tooltip={`Whether the task is blocking (i.e. the student cannot complete the next task until this task is completed). For example, a blocking task could be a potentially dangerous chemistry experiment or circuit that requires the TA to look over before the students can continue with the lab. A non-blocking task could be a part of the lab that is just some calculations or coding, where the student can still progress forward with the lab even though they haven't had their work checked yet. A list of tasks where none are blocking essentially allows students to wait until the end of the lab to have every one of their tasks checked off. Default = false`}
                      >
                        <Checkbox className="ml-5" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        valuePropName="color"
                        label={index === 0 ? 'Color' : ''}
                        className="min-w-16"
                        name={[name, 'color_hex']}
                        rules={[{ required: true, message: 'Missing color' }]}
                        // This will give an antd warning in the console but won't work otherwise
                        initialValue={defaultColor}
                      >
                        <ColorPickerWithPresets
                          // This will give an antd warning in the console but won't work otherwise
                          defaultValue={defaultColor}
                          format="hex"
                          className="ml-3"
                          defaultFormat="hex"
                          disabledAlpha
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        label={index === 0 ? 'Precondition' : ''}
                        name={[name, 'precondition']}
                        tooltip={`The key of the task (e.g. "task1") that must be completed before this task can be completed. This allows you to define the order in which tasks are completed. It is recommended to keep this empty if your students can do tasks out of order.`}
                      >
                        <Select
                          allowClear
                          placeholder="None"
                          options={localTaskIds.map((taskID) => ({
                            label: taskID,
                            value: taskID,
                          }))}
                          className="w-28"
                        />
                      </Form.Item>
                      <CloseOutlined
                        className={`text-md mb-[1.5rem] ml-6 text-gray-600 ${index === 0 ? 'mt-7' : ''}`}
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
                    Add Task
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </>
      )}
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
      <Collapse
        bordered={false}
        items={[
          {
            key: '1',
            label: (
              <label className="mt-2 font-medium" htmlFor="queue_config">
                <span className="mr-1">Queue Config JSON</span>
                <Tooltip
                  title={
                    'Here is a JavaScript Object Notation version of all the configurations above. You can easily externally save this config and copy/paste this config to other queues and courses, or share it with other professors!'
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
                          if (
                            parsedConfig.tasks &&
                            isCycleInTasks(parsedConfig.tasks)
                          ) {
                            message.error(
                              'Error: Cycle detected in task preconditions. Please fix this before saving.',
                            )
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
      />
    </Modal>
  )
}

export default EditQueueModal
