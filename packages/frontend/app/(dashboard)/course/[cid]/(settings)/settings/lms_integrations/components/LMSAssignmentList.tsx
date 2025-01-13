import { SearchOutlined } from '@ant-design/icons'
import { LMSAssignment } from '@koh/common'
import { Collapse, Input, List, message, Pagination, Radio, Spin } from 'antd'
import { useMemo, useState } from 'react'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

type LMSAssignmentListProps = {
  courseId: number
  assignments: LMSAssignment[]
  updateCallback: (assignments: LMSAssignment[]) => void
  loadingLMSData?: boolean
}

const LMSAssignmentList: React.FC<LMSAssignmentListProps> = ({
  courseId,
  assignments,
  updateCallback,
  loadingLMSData = false,
}) => {
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<number[]>([])

  const toggleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i != id) : [id, ...prev],
    )
  }

  const handleInput = (event: any) => {
    event.preventDefault()
    setInput(event.target.value)
  }

  const handleSearch = (event: any) => {
    event.preventDefault()
    setSearch(event.target.value)
    setPage(1)
  }

  const matchingAssignments = useMemo(
    () =>
      assignments.filter((assignment) =>
        assignment.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [assignments, search],
  )

  const paginatedAssignments = useMemo(
    () => matchingAssignments.slice((page - 1) * 20, page * 20),
    [matchingAssignments, page],
  )

  const _saveItems = async () => {
    API.lmsIntegration
      .saveAssignments(courseId, selected.length > 0 ? selected : undefined)
      .then((response) => {
        if (response != undefined) {
          updateCallback(response)
        }
      })
      .catch((error) => {
        message.error(getErrorMessage(error))
      })
  }

  const _uploadItems = async () => {
    return
  }

  const getStatusCell = (item: LMSAssignment) => {
    return (
      <div className={'flex flex-col gap-2'}>
        {item.saved && (
          <div className={'font-semibold'}>Saved to HelpMe database</div>
        )}
        {item.uploaded != undefined && (
          <div className={'flex flex-col gap-1'}>
            <div className={'font-semibold'}>Uploaded to HelpMe Chatbot</div>
            <div className={'italic'}>
              Last updated: {item.uploaded.toLocaleDateString()}
            </div>
            {item.modified != undefined &&
              new Date(item.uploaded).getTime() <
                new Date(item.modified).getTime() && (
                <div className={'font-semibold'}>
                  Chatbot Document Out-of-Date!
                </div>
              )}
          </div>
        )}
        {!item.saved && item.uploaded == undefined && (
          <div className={'font-semibold italic'}>Not saved to HelpMe</div>
        )}
      </div>
    )
  }

  if (!assignments) {
    return <Spin tip="Loading..." size="large" />
  } else {
    return (
      <div>
        <div className="bg-white">
          <div
            className={
              'my-2 flex flex-col justify-start md:flex-row md:justify-between'
            }
          >
            <Input
              placeholder={'Search for assignments and press enter'}
              prefix={<SearchOutlined />}
              value={input}
              onChange={handleInput}
              onPressEnter={handleSearch}
            />
            {matchingAssignments.length > 20 && (
              <Pagination
                style={{ float: 'right' }}
                current={page}
                pageSize={20}
                total={matchingAssignments.length}
                onChange={(page) => setPage(page)}
                showSizeChanger={false}
              />
            )}
          </div>
          <List
            dataSource={paginatedAssignments}
            loading={loadingLMSData}
            size="small"
            header={
              <div
                className={'-my-3 grid grid-cols-9 bg-gray-100 font-semibold'}
              >
                <div className={'border border-gray-200 p-4'}>
                  Assignment ID
                </div>
                <div className={'col-span-2 border border-gray-200 p-4'}>
                  Assignment Name
                </div>
                <div className={'border border-gray-200 p-4'}>Due</div>
                <div className={'col-span-4 border border-gray-200 p-4'}>
                  Description
                </div>
                <div className={'border border-gray-200 p-4'}>Status</div>
              </div>
            }
            renderItem={(item: LMSAssignment) => (
              <div className={'grid grid-cols-8'}>
                <div className={'border border-gray-100 p-4'}>{item.id}</div>
                <div className={'col-span-2 border border-gray-100 p-4'}>
                  <Radio
                    checked={selected.includes(item.id)}
                    onClick={() => toggleSelect(item.id)}
                  ></Radio>
                  {item.name}
                </div>
                <div className={'border border-gray-100 p-4'}>
                  {new Date(item.due).toLocaleDateString()}
                </div>
                <div className={'col-span-4 border border-gray-100 p-4'}>
                  {(item.description != undefined &&
                    item.description.length > 0 && (
                      <Collapse>
                        <Collapse.Panel
                          key={'def'}
                          header={'Assignment Description'}
                        >
                          <div
                            dangerouslySetInnerHTML={{
                              __html: item.description,
                            }}
                          ></div>
                        </Collapse.Panel>
                      </Collapse>
                    )) || <i>No description</i>}
                </div>
                <div className={'border border-gray-100 p-4'}>
                  {getStatusCell(item)}
                </div>
              </div>
            )}
          ></List>
        </div>
      </div>
    )
  }
}

export default LMSAssignmentList
