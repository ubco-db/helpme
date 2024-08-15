'use client'

import { API } from '@/app/api'
import { SearchOutlined } from '@ant-design/icons'
import {
  Button,
  Form,
  Input,
  InputRef,
  message,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  TableColumnType,
  TableProps,
  Typography,
} from 'antd'
import { useEffect, useRef, useState } from 'react'
import type { ColumnType, FilterConfirmProps } from 'antd/es/table/interface'
import { questions, QuestionType, UpdateQuestionParams } from '@koh/common'
import { getErrorMessage } from '@/app/utils/generalUtils'
import Highlighter from 'react-highlight-words'
import {
  QuestionTagElement,
  QuestionTagSelector,
} from '../../../components/QuestionTagElement'
import { formatDateAndTimeForExcel } from '@/app/utils/timeFormatUtils'

type EditQuestionsPageProps = {
  params: {
    cid: string
  }
}

interface ExtendedQuestion extends questions {
  questionTypeNames: string[]
  QuestionTypeIds?: number[]
}
type QuestionAttributes = keyof ExtendedQuestion

interface EditableCellProps extends React.HTMLAttributes<HTMLElement> {
  editing: boolean
  dataIndex: string
  title: any
  inputType: 'questionType' | 'text'
  record: ExtendedQuestion | undefined
  index: number
  courseId: number
  questionTypesForThisQueue: QuestionType[]
}

const EditableCell: React.FC<React.PropsWithChildren<EditableCellProps>> = ({
  editing,
  dataIndex,
  title,
  inputType,
  record,
  index,
  courseId,
  questionTypesForThisQueue,
  children,
  ...restProps
}) => {
  const inputNode =
    inputType === 'text' ? (
      <Input />
    ) : (
      <QuestionTagSelector questionTags={questionTypesForThisQueue} />
    )

  return (
    <td {...restProps}>
      {editing ? (
        <Form.Item
          name={dataIndex}
          style={{ margin: 0 }}
          initialValue={
            inputType === 'questionType' ? record?.QuestionTypeIds : undefined
          }
        >
          {inputNode}
        </Form.Item>
      ) : (
        children
      )}
    </td>
  )
}

const EditQuestionsPage: React.FC<EditQuestionsPageProps> = ({
  params,
}: {
  params: { cid: string }
}) => {
  const cid = Number(params.cid)
  const [editingKey, setEditingKey] = useState(-1)

  const [data, setData] = useState<ExtendedQuestion[]>([])
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([])
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchedColumn, setSearchedColumn] = useState('')
  const searchInput = useRef<InputRef>(null)

  //
  // populate table data and also get questionTypes
  //
  useEffect(() => {
    async function fetchData() {
      await API.questions
        .getAllQuestions(cid)
        .then((d) => {
          const newQuestions = d.map((question) => {
            const questionTypeNamesArray = question.questionTypes
              ? question.questionTypes.map((type) => type.name)
              : []
            const questionTypeIdsArray = question.questionTypes
              ? question.questionTypes.map((type) => type.id ?? -1)
              : []
            return {
              id: question.id,
              queueId: question.queueId,
              text: question.text,
              createdAt: question.createdAt, //formatDateAndTimeForExcel(question.createdAt),
              status: question.status,
              location: question.location,
              creatorName: question.creatorName,
              helpName: question.helpName,
              questionTypeNames: questionTypeNamesArray,
              QuestionTypeIds: questionTypeIdsArray,
            }
          })
          setData(newQuestions)
        })
        .catch((e) => {
          const errorMessage = getErrorMessage(e)
          message.error(`Error fetching questions: ${errorMessage}`)
        })
      await API.course
        .getAllQuestionTypes(cid)
        .then((d) => {
          setQuestionTypes(d)
        })
        .catch((e) => {
          const errorMessage = getErrorMessage(e)
          message.error(`Error fetching question types: ${errorMessage}`)
        })
    }
    fetchData()
  }, [cid])

  //
  // For editing questions
  //
  const isEditing = (record: ExtendedQuestion) => record.id === editingKey
  const edit = (record: Partial<ExtendedQuestion>) => {
    form.setFieldsValue({ questionTypes: [], text: '', ...record })
    if (record.id) {
      // if statement just here to get rid of typescript error
      setEditingKey(record.id)
    }
  }
  const save = async (key: React.Key) => {
    try {
      const row = (await form.validateFields()) as ExtendedQuestion
      const newData = [...data]
      const index = newData.findIndex((item) => key === item.id)
      // send update request to backend
      // I think typescript is having a stroke
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const newQuestionTypes = row.QuestionTypeIds
        ? questionTypes.filter((questionType) =>
            row.QuestionTypeIds!.includes(questionType.id),
          )
        : []
      const newQuestionTypeNames = newQuestionTypes.map((type) => type.name)
      const updatedQuestion: UpdateQuestionParams = {
        text: row.text,
        questionTypes: newQuestionTypes,
      }
      await API.questions.update(newData[index].id, updatedQuestion)
      if (index > -1) {
        const item = newData[index]
        newData.splice(index, 1, {
          ...item,
          ...row,
          questionTypeNames: newQuestionTypeNames,
        })
        setData(newData)
        setEditingKey(-1)
      } else {
        newData.push({ ...row, questionTypeNames: newQuestionTypeNames })
        setData(newData)
        setEditingKey(-1)
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err)
      message.error(`Error updating question: ${errorMessage}`)
    }
  }
  const cancelEdit = () => {
    setEditingKey(-1)
  }

  //
  // For searching questions in column headers
  //
  const handleSearch = (
    selectedKeys: string[],
    confirm: (param?: FilterConfirmProps) => void,
    dataIndex: string,
  ) => {
    confirm()
    setSearchText(selectedKeys[0])
    setSearchedColumn(dataIndex)
  }
  const handleReset = (clearFilters: () => void) => {
    clearFilters()
    setSearchText('')
  }
  const getColumnSearchProps = (
    dataIndex: QuestionAttributes,
  ): TableColumnType<ExtendedQuestion> => ({
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
      close,
    }) => (
      <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
        <Input
          ref={searchInput}
          placeholder={`Search ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={(e) =>
            setSelectedKeys(e.target.value ? [e.target.value] : [])
          }
          onPressEnter={() =>
            handleSearch(selectedKeys as string[], confirm, dataIndex)
          }
          style={{ marginBottom: 8, display: 'block' }}
        />
        <Space>
          <Button
            type="primary"
            onClick={() =>
              handleSearch(selectedKeys as string[], confirm, dataIndex)
            }
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90 }}
          >
            Search
          </Button>
          <Button
            onClick={() => clearFilters && handleReset(clearFilters)}
            size="small"
            style={{ width: 90 }}
          >
            Reset
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              confirm({ closeDropdown: false })
              setSearchText((selectedKeys as string[])[0])
              setSearchedColumn(dataIndex)
            }}
          >
            Filter
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              close()
            }}
          >
            close
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
    ),
    onFilter: (value, record) => {
      if (!record[dataIndex]) {
        return false
      }
      return record[dataIndex]
        .toString()
        .toLowerCase()
        .includes((value as string).toLowerCase())
    },
    onFilterDropdownOpenChange: (visible) => {
      if (visible) {
        setTimeout(() => searchInput.current?.select(), 100)
      }
    },
    render: (text) => {
      if (dataIndex === 'questionTypeNames') {
        return (
          <span>
            {text.map((tag: string) => {
              const myQuestionType = questionTypes.find(
                (type) => type.name === tag,
              )
              if (!myQuestionType) {
                return null
              } else {
                return (
                  <QuestionTagElement
                    key={myQuestionType.id}
                    tagName={myQuestionType.name}
                    tagColor={myQuestionType.color}
                  />
                )
              }
            })}
          </span>
        )
      } else {
        return searchedColumn === dataIndex ? (
          <Highlighter
            highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
            searchWords={[searchText]}
            autoEscape
            textToHighlight={text ? text.toString() : ''}
          />
        ) : (
          text
        )
      }
    },
  })

  //
  // Column headers
  //
  const columns = [
    {
      title: 'Asked by',
      dataIndex: 'creatorName',
      key: 'creatorName',
      sorter: (
        a: { creatorName: string | any[] },
        b: { creatorName: string | any[] },
      ) => a.creatorName.length - b.creatorName.length,
      width: '15%',
      editable: false,
      ...getColumnSearchProps('creatorName'),
    },
    {
      title: 'Helper',
      dataIndex: 'helpName',
      key: 'helpName',
      width: 150,
      editable: false,
      ...getColumnSearchProps('helpName'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      editable: false,
      ...getColumnSearchProps('status'),
    },
    {
      title: 'Question Tags',
      dataIndex: 'questionTypeNames',
      key: 'questionTypeNames',
      width: 150,
      editable: true,
      ...getColumnSearchProps('questionTypeNames'),
    },
    {
      title: 'Date Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      editable: false,
      render: (text: Date) => formatDateAndTimeForExcel(text),
    },
    {
      title: 'text',
      dataIndex: 'text',
      key: 'text',
      ...getColumnSearchProps('text'),
      editable: true,
    },
    {
      title: 'Edit',
      dataIndex: 'operation',
      width: 100,
      editable: false,
      render: (_: any, record: ExtendedQuestion) => {
        const editable = isEditing(record)
        return editable ? (
          <span>
            <Typography.Link
              onClick={() => save(record.id)}
              style={{ marginRight: 8 }}
            >
              Save
            </Typography.Link>
            <Popconfirm title="Sure to cancel?" onConfirm={cancelEdit}>
              <a>Cancel</a>
            </Popconfirm>
          </span>
        ) : (
          <Typography.Link
            disabled={editingKey !== -1}
            onClick={() => edit(record)}
          >
            Edit
          </Typography.Link>
        )
      },
    },
  ]

  const mergedColumns: TableProps<ExtendedQuestion>['columns'] = columns.map(
    (col) => {
      if (!col.editable) {
        return col
      }
      return {
        ...col,
        onCell: (record: ExtendedQuestion) => ({
          record,
          inputType:
            col.dataIndex === 'questionTypeNames' ? 'questionType' : 'text',
          dataIndex:
            col.dataIndex === 'questionTypeNames'
              ? 'QuestionTypeIds'
              : col.dataIndex,
          title: col.title,
          editing: isEditing(record),
          courseId: cid,
          questionTypesForThisQueue:
            col.dataIndex === 'questionTypeNames'
              ? questionTypes.filter((questionType) => {
                  if (record.queueId) {
                    return questionType.queueId === record.queueId
                  } else {
                    return false
                  }
                })
              : [],
        }),
      }
    },
  )

  return (
    <Form form={form} component={false}>
      <Table
        components={{
          body: {
            cell: EditableCell,
          },
        }}
        bordered
        dataSource={data}
        size="small"
        columns={mergedColumns}
        rowClassName="editable-row"
        pagination={{
          onChange: cancelEdit,
        }}
      />
    </Form>
  )
}

export default EditQuestionsPage
