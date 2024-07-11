import { ReactElement } from 'react'
import Modal from 'antd/lib/modal/Modal'
import { Button, message, Card, Col, Row } from 'antd'
import styled from 'styled-components'
import { API } from '@koh/api-client'
import { AllStudentAssignmentProgress, ConfigTasks } from '@koh/common'
import { default as React, useEffect, useState } from 'react'
import { QuestionType } from '../../Questions/Shared/QuestionType'
import { ReloadOutlined } from '@ant-design/icons'
import { KOHAvatar } from '../../common/SelfAvatar'

const StudentCard = styled(Card)`
  margin-bottom: 8px;
  box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  padding-left: 8px;
  padding-right: 8px;
  color: #595959;
  .ant-card-body {
    padding: 10px 8px;

    @media (max-width: 650px) {
      padding: 10px 0px;
    }
  }
`

interface AssignmentReportModalProps {
  queueId: number
  courseId: number
  assignmentName: string
  configTasks: ConfigTasks
  visible: boolean
  onClose: () => void
}

export function AssignmentReportModal({
  queueId,
  courseId,
  assignmentName,
  configTasks,
  visible,
  onClose,
}: AssignmentReportModalProps): ReactElement {
  const [allStudentAssignmentProgress, setAllStudentAssignmentProgress] =
    useState<AllStudentAssignmentProgress>({})
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (visible) {
      API.studentTaskProgress
        .getAllAssignmentProgressForQueue(queueId, courseId, assignmentName)
        .then((response) => {
          setAllStudentAssignmentProgress(response)
          message.success('Assignment Progress Loaded')
        })
    }
  }, [visible, refreshKey, queueId, courseId, assignmentName])

  const handleRefresh = () => {
    setRefreshKey((prevKey) => prevKey + 1)
  }
  return (
    <Modal
      title={`${assignmentName} Progress Report`}
      open={visible}
      onCancel={onClose}
      width={700}
      footer={[
        <Button
          icon={<ReloadOutlined />}
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
            <StudentCard key={index}>
              <Row className="items-center">
                <Col flex="0 1 auto" className="mr-2">
                  <KOHAvatar
                    size={46}
                    name={studentDetailsAndProgress.userDetails.name}
                    photoURL={studentDetailsAndProgress.userDetails.photoURL}
                  />
                </Col>
                <Col flex="1 1">
                  <Row>
                    {Object.entries(configTasks).map(
                      ([taskKey, taskValue], index) => (
                        <QuestionType
                          key={index}
                          typeName={
                            studentDetailsAndProgress.assignmentProgress &&
                            studentDetailsAndProgress.assignmentProgress[
                              taskKey
                            ] &&
                            studentDetailsAndProgress.assignmentProgress[
                              taskKey
                            ].isDone
                              ? '✔️'
                              : taskValue.short_display_name
                          }
                          typeColor={'#f0f0f0'}
                        />
                      ),
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
            </StudentCard>
          ),
        )}
      </div>
    </Modal>
  )
}
