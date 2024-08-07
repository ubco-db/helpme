/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { API } from '@/app/api'
import { SearchOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
} from 'antd'
import { useEffect, useRef, useState } from 'react'
import { pick } from 'lodash'
import type { ColumnType, FilterConfirmProps } from 'antd/es/table/interface'
import { questions } from '@koh/common'

type EditQuestionsPageProps = {
  params: {
    cid: string
  }
}

interface EditableCellProps extends React.HTMLAttributes<HTMLElement> {
  editing: boolean
  dataIndex: string
  title: any
  children: React.ReactNode
}

const possibleStatus = [
  { value: 'CantFind' },
  { value: 'TADeleted' },
  { value: 'Resolved' },
  { value: 'ConfirmedDeleted' },
  { value: 'Stale' },
]

const EditableCell: React.FC<EditableCellProps> = ({
  editing,
  dataIndex,
  title,
  children,
  ...restProps
}) => {
  return (
    <td {...restProps}>
      {editing ? (
        <Form.Item
          name={dataIndex}
          style={{ margin: 0 }}
          rules={[
            {
              required: true,
              message: `Please Input ${title}!`,
            },
          ]}
        >
          {title === 'Status' ? <Select options={possibleStatus} /> : <Input />}
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
  const [editingKey, setEditingKey] = useState(-1)
  const [data, setData] = useState<questions[]>([])
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchedColumn, setSearchedColumn] = useState('')
  const searchInput = useRef(null)

  const getData = async () => {
    return await API.questions.getAllQuestions(Number(params.cid))
  }

  useEffect(() => {
    getData().then((d) => {
      pick(d, [
        'id',
        'queueId',
        'text',
        'questionType',
        'createdAt',
        'status',
        'location',
      ])
      setData(d)
    })
  }, [])

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

  const save = async (id: number) => {
    try {
      const row = await form.validateFields()
      const newData = [...data]
      const index = newData.findIndex((item) => id === item.id)
      await API.questions.update(newData[index].id, row)
      if (index > -1) {
        const item = newData[index]
        newData.splice(index, 1, {
          ...item,
          ...row,
        })
        setData(newData)
        setEditingKey(-1)
      } else {
        newData.push(row)
        setData(newData)
        setEditingKey(-1)
      }
    } catch (errInfo) {
      message.error('Failed to save question')
    }
  }

  const edit = (record: any) => {
    form.setFieldsValue({ name: '', status: '', text: '', ...record })
    setEditingKey(record.id)
  }

  const cancel = () => {
    setEditingKey(-1)
  }

  const isEditing = (record: questions) => record.id === editingKey
  //for search bars
  const getColumnSearchProps = (dataIndex: string): ColumnType<questions> => ({
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }) => (
      <div className="p-4" onKeyDown={(e) => e.stopPropagation()}>
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
          className="mb-8 block"
        />
        <Space>
          <Button
            type="primary"
            onClick={() =>
              handleSearch(selectedKeys as string[], confirm, dataIndex)
            }
            icon={<SearchOutlined />}
            size="middle"
          >
            Search
          </Button>
          <Button
            onClick={() => clearFilters && handleReset(clearFilters)}
            size="middle"
          >
            Reset
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              close()
            }}
          >
            Close
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
    ),
  })

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
      title: 'Question Type',
      dataIndex: 'questionType',
      key: 'questionType',
      width: 150,
      editable: true,
      ...getColumnSearchProps('questionType'),
    },
    {
      title: 'Date Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      editable: false,
    },
    {
      title: 'text',
      dataIndex: 'text',
      key: 'text',
      ...getColumnSearchProps('text'),
      editable: true,
    },
    {
      title: 'operation',
      dataIndex: 'operation',
      width: 100,
      editable: false,
      // render: (_: any, record) =>
      //   <a onClick={() => editQuestion(record.id)}>Edit</a>
      render: (_: any, record: questions) => {
        const editable = isEditing(record)
        return editable ? (
          <span>
            <Typography.Link
              onClick={() => save(record.id)}
              style={{ marginRight: 8 }}
            >
              Save
            </Typography.Link>
            <Popconfirm title="Sure to cancel?" onConfirm={cancel}>
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

  const mergedColumns = columns.map((col) => {
    if (!col.editable) {
      return col
    }
    return {
      ...col,
      onCell: (record: questions) => ({
        record,
        inputType: 'text',
        dataIndex: col.dataIndex,
        title: String(col.title),
        editing: isEditing(record),
      }),
    }
  })

  return (
    <Card title="Edit Questions page">
      <Form>
        <Table
          components={{
            body: {
              cell: EditableCell,
            },
          }}
          dataSource={data}
          columns={mergedColumns as ColumnType<questions>[]}
          bordered
          rowClassName={'editable-row'}
          pagination={{
            onChange: cancel,
          }}
        />
      </Form>
    </Card>
  )
}

export default EditQuestionsPage
