import { Button, Form, Input, Row, Select, Table, TableProps } from 'antd'
import {
  ChatbotAllowedHeaders,
  ChatbotAllowedHeadersList,
  ChatbotAllowedHeadersType,
} from '@koh/common'
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'

type ChatbotHeadersTableProps = {
  initialHeaders?: ChatbotAllowedHeaders
  setUpdatedHeaders: (headers: ChatbotAllowedHeaders) => void
}

const ChatbotHeadersTable: React.FC<ChatbotHeadersTableProps> = ({
  initialHeaders,
  setUpdatedHeaders,
}) => {
  const [form] = Form.useForm<ChatbotAllowedHeadersType>()
  const [headers, setHeaders] = useState<ChatbotAllowedHeadersType[]>(
    initialHeaders
      ? Object.keys(initialHeaders).map((key) => ({
          key: key as keyof ChatbotAllowedHeaders,
          value: initialHeaders[key as keyof ChatbotAllowedHeaders] ?? '',
        }))
      : [],
  )

  useEffect(() => {
    if (initialHeaders) {
      setHeaders(
        Object.keys(initialHeaders).map((key) => ({
          key: key as keyof ChatbotAllowedHeaders,
          value: initialHeaders[key as keyof ChatbotAllowedHeaders] ?? '',
        })),
      )
    }
  }, [initialHeaders])

  useEffect(() => {
    const changed: ChatbotAllowedHeadersType[] = []
    const deleted: (keyof ChatbotAllowedHeaders)[] = []
    for (const key in initialHeaders) {
      const match = headers.find((h) => h.key == key)
      if (!match) deleted.push(key as keyof ChatbotAllowedHeaders)
      else if (initialHeaders[match.key] != match.value) {
        changed.push(match)
      }
    }
    const newHeaders: ChatbotAllowedHeaders = { ...initialHeaders }
    changed.forEach((h) => (newHeaders[h.key] = h.value))
    deleted.forEach((h) => delete newHeaders[h])
    setUpdatedHeaders(newHeaders)
  }, [headers, initialHeaders, setUpdatedHeaders])

  const [editingRows, setEditingRows] = useState<{ [key: string]: boolean }>({})
  const [isCreating, setIsCreating] = useState(false)

  const isEditing = (record: ChatbotAllowedHeadersType) =>
    editingRows[record.key] === true

  const columns = [
    {
      title: 'Header',
      dataIndex: 'key',
      editable: true,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      editable: true,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      editable: false,
      render: (_: any, record: ChatbotAllowedHeadersType) => {
        return (
          <div className={'grid grid-cols-1 gap-2'}>
            {isEditing(record) ? (
              <>
                <Button
                  icon={<CheckOutlined />}
                  type={'default'}
                  onClick={() => confirmEdit(record)}
                >
                  Confirm
                </Button>
                <Button
                  icon={<CloseOutlined />}
                  color={'default'}
                  onClick={() => cancelEdit(record)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  icon={<EditOutlined />}
                  type={'default'}
                  onClick={() => toggleEdit(record)}
                >
                  Edit
                </Button>
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  onClick={() => deleteRecord(record)}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        )
      },
    },
  ]

  const mergedColumns: TableProps<ChatbotAllowedHeadersType>['columns'] =
    columns.map((col) => {
      if (!col.editable) {
        return col
      }
      return {
        ...col,
        onCell: (record: ChatbotAllowedHeadersType) => ({
          record,
          usedKeys: headers.map((h) => h.key),
          inputType: 'text',
          dataIndex: col.dataIndex,
          title: col.title,
          editing: isEditing(record),
        }),
      }
    })

  const toggleEdit = (record: ChatbotAllowedHeadersType) => {
    form.setFieldsValue({
      ...record,
    })
    setEditingRows((prev) => ({ ...prev, [record.key]: true }))
  }

  const cancelEdit = (record: ChatbotAllowedHeadersType) => {
    setEditingRows((prev) => ({ ...prev, [record.key]: false }))
  }

  const confirmEdit = async (record: ChatbotAllowedHeadersType) => {
    try {
      const row = (await form.validateFields()) as ChatbotAllowedHeadersType
      setHeaders((prev) => [...prev.filter((p) => p.key != record.key), row])
      setEditingRows((prev) => ({ ...prev, [record.key]: false }))
    } catch (_e) {}
  }

  const toggleCreate = async () => {
    form.setFieldsValue({
      key: undefined,
      value: undefined,
    })
    setIsCreating(true)
  }

  const cancelCreate = () => {
    setIsCreating(false)
  }

  const confirmCreate = async () => {
    try {
      const row = (await form.validateFields()) as ChatbotAllowedHeadersType
      setHeaders((prev) => [...prev, row])
      setIsCreating(false)
    } catch (_e) {}
  }

  const deleteRecord = (record: ChatbotAllowedHeadersType) => {
    setHeaders((prev) => prev.filter((p) => p.key != record.key))
  }

  return (
    <Form form={form} component={false}>
      <Table<ChatbotAllowedHeadersType>
        locale={{ emptyText: 'No headers defined' }}
        components={{
          body: { cell: EditableCell },
        }}
        bordered
        dataSource={headers}
        columns={mergedColumns}
        rowClassName="editable-row"
        pagination={false}
        footer={() => (
          <div>
            {isCreating && (
              <div className={'grid grid-cols-2'}>
                <EditableCell
                  className={'w-full'}
                  editing={true}
                  dataIndex={'key'}
                  record={form.getFieldsValue()}
                  usedKeys={headers.map((h) => h.key)}
                  index={0}
                />
                <EditableCell
                  className={'w-full'}
                  editing={true}
                  dataIndex={'value'}
                  record={form.getFieldsValue()}
                  usedKeys={headers.map((h) => h.key)}
                  index={0}
                />
              </div>
            )}
            <Row className={'flex justify-end'}>
              {isCreating ? (
                <>
                  <Button
                    icon={<CheckOutlined />}
                    color={'green'}
                    onClick={() => confirmCreate()}
                  >
                    Confirm
                  </Button>
                  <Button
                    icon={<CloseOutlined />}
                    color={'default'}
                    onClick={() => cancelCreate()}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => toggleCreate()}
                  >
                    Create
                  </Button>
                </>
              )}
            </Row>
          </div>
        )}
      />
    </Form>
  )
}

export default ChatbotHeadersTable

type EditableCellProps = {
  editing: boolean
  dataIndex: string
  record: ChatbotAllowedHeadersType
  usedKeys: (keyof ChatbotAllowedHeaders)[]
  index: number
  outsideTable?: boolean
  className?: string
}

const EditableCell: React.FC<React.PropsWithChildren<EditableCellProps>> = ({
  editing,
  dataIndex,
  record,
  usedKeys,
  children,
  outsideTable,
  ...restProps
}) => {
  const viableKeys = ChatbotAllowedHeadersList.filter(
    (k) => !usedKeys?.includes(k),
  )
  const inputNode =
    dataIndex == 'key' ? (
      <Select>
        {ChatbotAllowedHeadersList.map((k) => (
          <Select.Option key={k} value={k} disabled={usedKeys.includes(k)}>
            {k}
          </Select.Option>
        ))}
      </Select>
    ) : (
      <Input />
    )

  const internalNode = useMemo(() => {
    return editing ? (
      <Form.Item
        name={dataIndex}
        initialValue={
          dataIndex == 'key'
            ? ((record as Record<string, string>)[dataIndex] ?? viableKeys[0])
            : (record as Record<string, string>)[dataIndex]
        }
      >
        {inputNode}
      </Form.Item>
    ) : (
      children
    )
  }, [inputNode, dataIndex, record, children])

  return outsideTable ? (
    <div {...restProps}>{internalNode}</div>
  ) : (
    <td {...restProps}>{internalNode}</td>
  )
}
