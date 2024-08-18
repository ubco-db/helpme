import Modal from 'antd/lib/modal/Modal'
import { Button, message, Card, Col, Row } from 'antd'
import { AllStudentAssignmentProgress, ConfigTasks } from '@koh/common'
import { useEffect, useState } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
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
          message.error('Failed to load assignment progress:', errorMessage)
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
      title={`${assignmentName} Progress Report`}
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
        {Object.entries(allStudentAssignmentProgress).map(
          ([, studentDetailsAndProgress], index) => (
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
                            studentDetailsAndProgress.assignmentProgress[
                              taskKey
                            ].isDone

                          return (
                            <QuestionTagElement
                              className={isTaskDone ? '' : '!px-3'}
                              key={index}
                              tagName={
                                isTaskDone
                                  ? '✔️'
                                  : `${taskValue.short_display_name} `
                              }
                              tagColor={'#f0f0f0'}
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
                      {studentDetailsAndProgress.userDetails.name}
                    </div>
                  </Row>
                </Col>
              </Row>
            </Card>
          ),
        )}
      </div>
    </Modal>
  )
}

export default AssignmentReportModal
