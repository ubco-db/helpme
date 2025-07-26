import {
  ChatbotProvider,
  CourseChatbotSettings,
  LLMType,
  OrganizationChatbotSettings,
  UpsertCourseChatbotSettings,
} from '@koh/common'
import React, { useMemo, useState } from 'react'
import {
  Button,
  Form,
  FormRule,
  Input,
  InputNumber,
  message,
  Pagination,
  Table,
  TableProps,
  Tooltip,
} from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { CoursePartial } from '@/middlewareType'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import LLMSelect from '@/app/(dashboard)/organization/ai/components/LLMSelect'

type OrganizationChatbotSettingsFormProps = {
  organizationId: number
  organizationSettings: OrganizationChatbotSettings
  courseSettingsInstances: CourseChatbotSettings[]
  onUpdate: (courseSettings: CourseChatbotSettings) => void
}

const CourseSettingTable: React.FC<OrganizationChatbotSettingsFormProps> = ({
  organizationId,
  organizationSettings,
  courseSettingsInstances,
  onUpdate,
}) => {
  const [form] = Form.useForm<UpsertCourseChatbotSettings>()
  const [search, setSearch] = useState<string>('')
  const [page, setPage] = useState<number>(1)

  const [editingRows, setEditingRows] = useState<{ [key: string]: boolean }>({})
  const [isCreating, setIsCreating] = useState(false)

  const isEditing = (record: CourseChatbotSettings) =>
    editingRows[record.id] === true

  const columns = [
    {
      title: 'Course',
      dataIndex: 'course',
      editable: false,
    },
    {
      title: 'Model',
      dataIndex: 'llmId',
      editable: true,
    },
    {
      title: 'Prompt',
      dataIndex: 'prompt',
      editable: true,
    },
    {
      title: 'Temperature',
      dataIndex: 'temperature',
      editable: true,
    },
    {
      title: 'Top-K',
      dataIndex: 'topK',
      editable: true,
    },
    {
      title: 'Similarity Threshold (Documents)',
      dataIndex: 'similarityThresholdDocuments',
      editable: true,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      editable: false,
      render: (_: any, record: CourseChatbotSettings) => {
        return (
          <div className={'grid grid-cols-1 gap-2'}>
            {isEditing(record) ? (
              <>
                <Button
                  icon={<CheckOutlined />}
                  type={'default'}
                  onClick={() => handleUpdate(record.courseId)}
                >
                  Confirm
                </Button>
                <Button
                  icon={<CloseOutlined />}
                  color={'default'}
                  onClick={() => cancelUpdate(record)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  icon={<EditOutlined />}
                  type={'default'}
                  onClick={() => toggleUpdate(record)}
                >
                  Edit
                </Button>
                <Button
                  icon={<SyncOutlined />}
                  danger
                  onClick={() => handleReset(record.courseId)}
                >
                  Reset
                </Button>
              </>
            )}
          </div>
        )
      },
    },
  ]

  const getColumnRules = (dataIndex: string): FormRule[] => {
    switch (dataIndex) {
      case 'llmId':
        return []
      case 'prompt':
        return []
      case 'temperature':
        return [
          {
            required: false,
            type: 'number',
            min: 0,
            max: 1,
            message: 'Temperature must be between 0 and 1.',
          },
        ]
      case 'topK':
        return [
          {
            type: 'number',
            required: false,
            min: 1,
            message:
              'If Top-K is defined, it must cause at least 1 document to be retrieved.',
          },
        ]
      case 'similarityThresholdDocuments':
        return [
          {
            required: false,
            type: 'number',
            min: 0,
            max: 1,
            message:
              'Similarity threshold for documents must be between 0 and 1.',
          },
        ]
    }
    return []
  }

  const getColumnLabel = (dataIndex: string): React.ReactNode => {
    switch (dataIndex) {
      case 'llmId':
        return (
          <Tooltip title="Set the base large language model (LLM) you want to use for the chatbot. Any recommended models run entirely on UBC hardware and are safe for student data">
            <InfoCircleOutlined />
          </Tooltip>
        )
      case 'prompt':
        return (
          <Tooltip title="Set the prompt that is attached with any chatbot question. You can specify what the course is, what the goals of your course are, how you want the chatbot to answer questions, etc.">
            <InfoCircleOutlined />
          </Tooltip>
        )
      case 'temperature':
        return (
          <Tooltip title="Adjust the temperature to control the randomness of the generation. Lower values make responses more predictable. Only applies for some models.">
            <InfoCircleOutlined />
          </Tooltip>
        )
      case 'topK':
        return (
          <Tooltip title="This number determines the maximum number of text chunks the chatbot can retrieve and cite per question. Consider increasing it if the questions for your course generally require more chunks of context to answer properly.">
            <InfoCircleOutlined />
          </Tooltip>
        )
      case 'similarityThresholdDocuments':
        return (
          <Tooltip title="Set the minimum similarity threshold when retrieving relevant information blocks. You can increase this if you notice that the chatbot is retrieving irrelevant documents, or decrease it if it's not grabbing the chunks that it should have. In general, this threshold should be left default or at a low value so the AI has more information to work with, rather than too little.">
            <InfoCircleOutlined />
          </Tooltip>
        )
    }
    return null
  }

  const mergedColumns: TableProps<CourseChatbotSettings>['columns'] =
    columns.map((col) => {
      if (!col.editable) {
        return col
      }
      return {
        ...col,
        onCell: (record: CourseChatbotSettings) => ({
          record,
          usingDefaultIndex:
            col.dataIndex == 'llmId'
              ? 'usingDefaultModel'
              : `usingDefault${col.dataIndex.substring(0, 1).toUpperCase() + col.dataIndex.substring(1)}`,
          dataIndex: col.dataIndex,
          editing: isEditing(record),
          providers: organizationSettings.providers,
          rules: getColumnRules(col.dataIndex),
          tooltipLabel: getColumnLabel(col.dataIndex),
          title: col.title,
        }),
      }
    })

  const toggleUpdate = (record: CourseChatbotSettings) => {
    form.setFieldsValue({
      ...record,
    })
    setEditingRows((prev) => ({ ...prev, [record.id]: true }))
  }

  const cancelUpdate = (record: CourseChatbotSettings) => {
    setEditingRows((prev) => ({ ...prev, [record.id]: false }))
  }

  const handleUpdate = (courseId: number) => {
    form
      .validateFields()
      .then((values) => {
        API.chatbot.staffOnly
          .upsertCourseSettings(organizationId, courseId, {
            ...values,
          })
          .then((response) => {
            message.success('Successfully updated course chatbot settings!')
            onUpdate(response)
          })
          .catch((err) => {
            message.error(
              `Failed to update course chatbot settings: ${getErrorMessage(err)}`,
            )
          })
      })
      .catch(() => {
        message.error('Invalid parameters')
      })
  }

  const handleReset = (courseId: number) => {
    API.chatbot.staffOnly
      .resetCourseSettings(organizationId, courseId)
      .then((response) => {
        message.success('Successfully reset course chatbot settings!')
        onUpdate(response)
      })
      .catch((err) => {
        message.error(
          `Failed to reset course chatbot settings: ${getErrorMessage(err)}`,
        )
      })
  }

  const searchedCourseSettings = useMemo(
    () =>
      courseSettingsInstances
        ? search.trim() != ''
          ? courseSettingsInstances.filter((c) =>
              c.course?.name
                ?.toLowerCase()
                .includes(search.trim().toLowerCase()),
            )
          : courseSettingsInstances
        : undefined,
    [courseSettingsInstances, search],
  )

  const paginatedCourseSettings = useMemo(
    () =>
      searchedCourseSettings
        ? searchedCourseSettings.slice((page - 1) * 50, page * 50)
        : undefined,
    [searchedCourseSettings, page],
  )

  return (
    <div className={'flex flex-col gap-4'}>
      <div>
        <Input
          placeholder={'Search for courses'}
          prefix={<SearchOutlined />}
          value={search}
          onChange={(event) => setSearch(event.target.value ?? '')}
          className="my-3"
        />
        <Pagination
          style={{ float: 'right' }}
          current={page}
          pageSize={25}
          total={searchedCourseSettings!.length}
          onChange={(page) => setPage(page)}
          showSizeChanger={false}
        />
      </div>
      <Table
        locale={{ emptyText: 'No headers defined' }}
        components={{
          body: { cell: CourseSettingTableCell },
        }}
        bordered
        dataSource={paginatedCourseSettings}
        columns={mergedColumns}
        rowClassName="editable-row"
        pagination={false}
      />
    </div>
  )
}

export default CourseSettingTable

type CourseSettingsTableCellProps = {
  customValue?: string | React.ReactNode
  editing: boolean
  dataIndex: string
  record: CourseChatbotSettings
  index: number
  title: string
  className?: string
  providers: ChatbotProvider[]
  rules: FormRule[]
  tooltipLabel: React.ReactNode
  usingDefaultIndex: string
}

const CourseSettingTableCell: React.FC<CourseSettingsTableCellProps> = ({
  customValue,
  editing,
  dataIndex,
  record,
  index,
  usingDefaultIndex,
  providers,
  tooltipLabel,
  rules,
  ...restProps
}) => {
  const isDefaultSynced = (record as Record<string, any>)[usingDefaultIndex]
  const inputType: 'LLM' | 'text' | 'number' =
    dataIndex == 'llmId' ? 'LLM' : dataIndex == 'prompt' ? 'text' : 'number'
  return (
    <div {...restProps}>
      {!editing ? (
        <div
          className={'flex justify-between'}
          key={`settings-${dataIndex}-${index}`}
        >
          <div>{customValue ?? (record as Record<string, any>)[dataIndex]}</div>
          {usingDefaultIndex != undefined && (
            <Tooltip
              title={
                isDefaultSynced
                  ? 'This parameter is synchronized with the organization settings.'
                  : 'This parameter is not synchronized with the organization settings.'
              }
            >
              {isDefaultSynced ? (
                <StarFilled className={'text-helpmeblue text-lg'} />
              ) : (
                <StarOutlined className={'text-lg text-gray-500'} />
              )}
            </Tooltip>
          )}
        </div>
      ) : (
        <div>
          <Form.Item name={dataIndex} label={tooltipLabel} rules={rules}>
            {inputType == 'LLM' ? (
              <LLMSelect providers={providers} />
            ) : inputType == 'text' ? (
              <Input.TextArea />
            ) : (
              <InputNumber />
            )}
          </Form.Item>
        </div>
      )}
    </div>
  )
}
