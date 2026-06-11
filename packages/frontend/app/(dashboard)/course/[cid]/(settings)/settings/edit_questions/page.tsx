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
  Space,
  Table,
  TableColumnType,
  Typography,
} from 'antd'
import { useEffect, useRef, useState } from 'react'
import type { FilterConfirmProps } from 'antd/es/table/interface'
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

/*
  Question but with some extra attributes:
  - questionTypeNames: string[] - Used for searching and displaying question tags
  - QuestionTypeIds: number[] - Used for updating question tags when editing a question.
  - createdAtString: string - Used for searching, sorting, and displaying date created
*/
interface ExtendedQuestion extends questions {
  questionTypeNames: string[]
  QuestionTypeIds: number[]
  createdAtString: string
}
type QuestionAttributes = keyof ExtendedQuestion

interface EditableCellProps extends React.HTMLAttributes<HTMLElement> {
  editing: boolean
  dataIndex: string
  title: any
  inputType: 'questionType' | 'text'
  record: ExtendedQuestion | undefined
  index: number
  questionTypesForThisQueue: QuestionType[]
}

const EditableCell: React.FC<React.PropsWithChildren<EditableCellProps>> = ({
  editing,
  dataIndex,
  title,
  inputType,
  record,
  index,
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

/**
 * Contains a table allowing staff to search, sort, and edit questions.
 * Combines multiple examples from antd's offical docs for Table, plus some custom logic.
 */
const EditQuestionsPage: React.FC<EditQuestionsPageProps> = (props) => {
  const params = props.params
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
              createdAt: question.createdAt,
              createdAtString: formatDateAndTimeForExcel(question.createdAt),
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
      const newQuestionTypes = row.QuestionTypeIds
        ? questionTypes.filter((questionType) =>
            // I think typescript is having a stroke

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
      return (
        record[dataIndex]
          ?.toString()
          .toLowerCase()
          .includes((value as string).toLowerCase()) ?? false
      )
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
          <>
            {/*
              In some environments, components which return Promises or arrays do not work.
              This is due to some changes to react and @types/react, and the component
              packages have not been updated to fix these issues.
            */}
            {/* @ts-expect-error Server Component */}
            <Highlighter
              highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
              searchWords={[searchText]}
              autoEscape
              textToHighlight={text ? text.toString() : ''}
            />
          </>
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
      sorter: (a: ExtendedQuestion, b: ExtendedQuestion) => {
        const nameA = a.creatorName || ''
        const nameB = b.creatorName || ''
        return nameA.localeCompare(nameB)
      },
      width: '15%',
      editable: false,
      ...getColumnSearchProps('creatorName'),
    },
    {
      title: 'Helper',
      dataIndex: 'helpName',
      key: 'helpName',
      sorter: (a: ExtendedQuestion, b: ExtendedQuestion) => {
        const nameA = a.helpName || ''
        const nameB = b.helpName || ''
        return nameA.localeCompare(nameB)
      },
      width: 150,
      editable: false,
      ...getColumnSearchProps('helpName'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: (a: ExtendedQuestion, b: ExtendedQuestion) => {
        const statusA = a.status || ''
        const statusB = b.status || ''
        return statusA.localeCompare(statusB)
      },
      width: 150,
      editable: false,
      ...getColumnSearchProps('status'),
    },
    {
      title: 'Question Tags',
      dataIndex: 'questionTypeNames',
      key: 'questionTypeNames',
      sorter: (a: ExtendedQuestion, b: ExtendedQuestion) => {
        const questionTagsA = a.questionTypeNames.join(', ') || ''
        const questionTagsB = b.questionTypeNames.join(', ') || ''
        return questionTagsA.localeCompare(questionTagsB)
      },
      width: 150,
      editable: true,
      ...getColumnSearchProps('questionTypeNames'),
    },
    {
      title: 'Date Created',
      dataIndex: 'createdAtString',
      key: 'createdAtString',
      defaultSortOrder: 'descend',
      sorter: (a: ExtendedQuestion, b: ExtendedQuestion) =>
        a.createdAtString.localeCompare(b.createdAtString),
      width: 150,
      editable: false,
      ...getColumnSearchProps('createdAtString'),
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

  // should be of type TableProps<ExtendedQuestion>['columns'], but it causes a typeScript error for some reason
  const mergedColumns: any = columns.map((col) => {
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
  })

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
          pageSize: 20,
        }}
      />
    </Form>
  )
}

export default EditQuestionsPage
