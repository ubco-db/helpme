import Modal from 'antd/lib/modal/Modal'
import { Button, message, Card, Col, Row, Segmented } from 'antd'
import {
  AllStudentAssignmentProgress,
  AssignmentProgressWithUser,
  ConfigTasks,
} from '@koh/common'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DownSquareOutlined,
  ReloadOutlined,
  UpSquareOutlined,
} from '@ant-design/icons'
import { API } from '@/app/api'
import UserAvatar from '@/app/components/UserAvatar'
import { QuestionTagElement } from '../../../../components/QuestionTagElement'
import { getErrorMessage } from '@/app/utils/generalUtils'

interface AssignmentReportModalProps {
  queueId: number
  courseId: number
  assignmentName: string | undefined
  configTasks: ConfigTasks | undefined
  open: boolean
  onClose: () => void
}

const AssignmentReportModal: React.FC<AssignmentReportModalProps> = ({
  queueId,
  courseId,
  assignmentName,
  configTasks,
  open,
  onClose,
}) => {
  const [allStudentAssignmentProgress, setAllStudentAssignmentProgress] =
    useState<AllStudentAssignmentProgress>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshDisabled, setRefreshDisabled] = useState(false)
  const [refreshLoading, setRefreshLoading] = useState(false)
  const [sortKey, setSortKey] = useState<'time' | 'name' | 'sid'>('time')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const sortedEntries = useMemo(() => {
    const entries = Object.entries(allStudentAssignmentProgress) as [
      string,
      AssignmentProgressWithUser,
    ][]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return entries.sort(([_keyA, a], [_keyB, b]) => {
      let result = 0

      if (sortKey === 'time') {
        result = 1
      } else if (sortKey === 'name') {
        if (!a.userDetails.name || !b.userDetails.name) {
          result = 0
        } else {
          result = a.userDetails.name.localeCompare(b.userDetails.name)
        }
      } else if (sortKey === 'sid') {
        if (!a.userDetails.sid || !b.userDetails.sid) {
          result = 0
        } else {
          result = a.userDetails.sid - b.userDetails.sid
        }
      }

      return sortOrder === 'asc' ? result : -result
    })
  }, [allStudentAssignmentProgress, sortKey, sortOrder])

  useEffect(() => {
    if (open && assignmentName) {
      setRefreshLoading(true)
      API.studentTaskProgress
        .getAllAssignmentProgressForQueue(queueId, courseId, assignmentName)
        .then((response) => {
          setAllStudentAssignmentProgress(response)
          if (refreshKey > 0) {
            message.success('Assignment Progress Loaded')
          }
        })
        .catch((error) => {
          const errorMessage = getErrorMessage(error)
          message.error('Failed to load assignment progress:' + errorMessage)
        })
        .finally(() => {
          setRefreshLoading(false)
        })
    }
  }, [open, refreshKey, queueId, courseId, assignmentName])

  const handleRefresh = () => {
    setRefreshKey((prevKey) => prevKey + 1)
    setRefreshDisabled(true)
    setTimeout(() => {
      setRefreshDisabled(false)
    }, 1500)
  }
  return (
    <Modal
      title={
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <div className="flex items-center justify-center">
            {assignmentName} Progress Report
          </div>
          <div className="flex items-center justify-center gap-2">
            <Segmented
              options={[
                { label: 'Time', value: 'time' },
                { label: 'Name', value: 'name' },
                { label: 'SID', value: 'sid' },
              ]}
              value={sortKey}
              onChange={(val) => setSortKey(val as typeof sortKey)}
            />
            <Segmented
              options={[
                { value: 'asc', icon: <ArrowUpOutlined /> },
                { value: 'desc', icon: <ArrowDownOutlined /> },
              ]}
              value={sortOrder}
              onChange={(val) => setSortOrder(val as typeof sortOrder)}
            />
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={700}
      footer={[
        <Button
          icon={<ReloadOutlined />}
          disabled={refreshDisabled}
          loading={refreshLoading}
          key="refresh"
          type="default"
          onClick={handleRefresh}
        >
          Refresh
        </Button>,
        <Button key="submit" type="primary" onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      <div>
        {sortedEntries.map(([_, studentDetailsAndProgress], index) => (
          <Card key={index} size="small" classNames={{ body: 'py-1' }}>
            <Row className="items-center">
              <Col flex="0 1 auto" className="mr-2">
                <UserAvatar
                  size={46}
                  username={studentDetailsAndProgress.userDetails.name}
                  photoURL={studentDetailsAndProgress.userDetails.photoURL}
                />
              </Col>
              <Col flex="1 1">
                <Row>
                  {configTasks &&
                    Object.entries(configTasks).map(
                      ([taskKey, taskValue], index) => {
                        const isTaskDone =
                          studentDetailsAndProgress.assignmentProgress &&
                          studentDetailsAndProgress.assignmentProgress[
                            taskKey
                          ] &&
                          studentDetailsAndProgress.assignmentProgress[taskKey]
                            .isDone

                        return (
                          <QuestionTagElement
                            key={index}
                            tagName={`${taskValue.short_display_name} `}
                            tagColor={isTaskDone ? '#77e093' : '#f0f0f0'}
                          />
                        )
                      },
                    )}
                </Row>
                <Row>
                  <div
                    style={
                      // question creator name
                      {
                        fontSize: 'smaller',
                        color: '#595959',
                        display: 'inline-block',
                        marginTop: '2px',
                        marginRight: '5px',
                        fontStyle: 'italic',
                        minWidth: '120px',
                      } as React.CSSProperties
                    }
                  >
                    {studentDetailsAndProgress.userDetails.name} -{' '}
                    {studentDetailsAndProgress.userDetails.sid}
                  </div>
                </Row>
              </Col>
            </Row>
          </Card>
        ))}
      </div>
    </Modal>
  )
}

export default AssignmentReportModal
