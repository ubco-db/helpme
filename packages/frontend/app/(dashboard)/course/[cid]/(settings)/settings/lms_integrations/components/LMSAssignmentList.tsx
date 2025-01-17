import { SearchOutlined } from '@ant-design/icons'
import { LMSAssignmentAPIResponse } from '@koh/common'
import { Collapse, Input, List, Pagination, Spin } from 'antd'
import { useMemo, useState } from 'react'

type LMSAssignmentListProps = {
  assignments: LMSAssignmentAPIResponse[]
  loadingLMSData?: boolean
}

const LMSRosterTable: React.FC<LMSAssignmentListProps> = ({
  assignments,
  loadingLMSData = false,
}) => {
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')

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
                className={'-my-3 grid grid-cols-8 bg-gray-100 font-semibold'}
              >
                <div className={'border border-gray-200 p-4'}>
                  Assignment ID
                </div>
                <div className={'col-span-2 border border-gray-200 p-4'}>
                  Assignment Name
                </div>
                <div className={'border border-gray-200 p-4'}>Modified</div>
                <div className={'col-span-4 border border-gray-200 p-4'}>
                  Description
                </div>
              </div>
            }
            renderItem={(item: LMSAssignmentAPIResponse) => (
              <div className={'grid grid-cols-8'}>
                <div className={'border border-gray-100 p-4'}>{item.id}</div>
                <div className={'col-span-2 border border-gray-100 p-4'}>
                  {item.name}
                </div>
                <div className={'border border-gray-100 p-4'}>
                  {new Date(item.modified).toLocaleDateString()}
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
              </div>
            )}
          ></List>
        </div>
      </div>
    )
  }
}

export default LMSRosterTable
